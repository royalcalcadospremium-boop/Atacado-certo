// fix-weights-fallback.js — Aplica pesos padrão por categoria em produtos
// que ainda têm peso = 0 depois do sync principal.
//
// Categorias (detecção heurística por título/handle/productType):
//   chinelo  → 250 g
//   tenis    → 800 g
//   bone     → 100 g
//   camiseta → 200 g
//   bermuda  → 350 g
//   calca    → 550 g
//   outros   → 400 g (default seguro)
//
// Roda APÓS sync-precos.js. Idempotente — só atualiza produtos com peso=0.
// Uso (no GitHub Actions): node fix-weights-fallback.js

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '.env');

function loadEnv() {
  if (!existsSync(ENV_PATH)) return process.env;
  const raw = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const clean = line.replace(/\r$/, '');
    const m = clean.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return { ...process.env, ...env };
}

const env = loadEnv();
for (const k of ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_TOKEN']) {
  if (!env[k]) { console.error(`Falta ${k}`); process.exit(1); }
}

const DRY_RUN = process.env.DRY_RUN === '1';

const CATEGORY_DEFAULTS_G = {
  chinelo: 250,
  tenis: 800,
  bone: 100,
  camiseta: 200,
  bermuda: 350,
  calca: 550,
  outros: 400
};

function detectCategory(title, handle, productType) {
  const text = (title + ' ' + handle + ' ' + (productType || '')).toLowerCase();
  if (/chinelo|sandal|slide/.test(text)) return 'chinelo';
  if (/t[eê]nis|sneaker|airmax|alphafly|nike|adidas|mizuno|new.?balance|puma|vans|asics|cloudboom|on.cloud/.test(text)) return 'tenis';
  if (/bon[eé]|cap|hat/.test(text)) return 'bone';
  if (/camiseta|t-shirt|oversize|malhao|suedine/.test(text)) return 'camiseta';
  if (/bermuda|short/.test(text)) return 'bermuda';
  if (/cal[çc]a|pants|jeans/.test(text)) return 'calca';
  return 'outros';
}

async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('Shopify GQL: ' + JSON.stringify(json.errors || json));
  return json.data;
}

async function fetchProductsWithZeroWeight() {
  console.log('Buscando produtos com peso zero...');
  const all = [];
  let cursor = null;
  let pages = 0;
  while (true) {
    const data = await shopifyGraphQL(
      `query($cursor: String) {
        products(first: 100, after: $cursor, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              productType
              variants(first: 100) {
                edges {
                  node {
                    id
                    sku
                    title
                    inventoryItem {
                      id
                      measurement { weight { value unit } }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { cursor }
    );
    for (const edge of data.products.edges) {
      const p = edge.node;
      const variantsZero = p.variants.edges
        .map(e => e.node)
        .filter(v => {
          const w = v.inventoryItem?.measurement?.weight;
          const val = w ? Number(w.value) || 0 : 0;
          const unit = (w?.unit || 'GRAMS').toUpperCase();
          const grams = unit === 'KILOGRAMS' ? val * 1000 : (unit === 'POUNDS' ? val * 453.6 : val);
          return grams === 0;
        });
      if (variantsZero.length > 0) all.push({ product: p, zeroVariants: variantsZero });
    }
    pages++;
    if (pages % 5 === 0) console.log(`  ${pages} páginas (${all.length} prods c/ peso 0)`);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  console.log(`Total: ${all.length} produtos com pelo menos 1 variante peso 0.\n`);
  return all;
}

async function bulkUpdateWeight(productGid, variants) {
  const data = await shopifyGraphQL(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
       productVariantsBulkUpdate(productId: $productId, variants: $variants) {
         productVariants { id }
         userErrors { field message }
       }
     }`,
    { productId: productGid, variants }
  );
  const errs = data.productVariantsBulkUpdate.userErrors;
  if (errs && errs.length) throw new Error('bulkUpdate: ' + JSON.stringify(errs));
  return data.productVariantsBulkUpdate.productVariants.length;
}

async function main() {
  console.log(`=== Fallback Pesos por Categoria ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`);
  const list = await fetchProductsWithZeroWeight();

  // Agrupa por categoria para relatório
  const byCat = {};
  for (const item of list) {
    const cat = detectCategory(item.product.title, item.product.handle, item.product.productType);
    byCat[cat] = (byCat[cat] || 0) + 1;
  }
  console.log('Distribuição por categoria:');
  for (const [cat, count] of Object.entries(byCat).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count} produtos → ${CATEGORY_DEFAULTS_G[cat]} g`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('[DRY-RUN] Nenhuma alteração foi feita.');
    return;
  }

  let updated = 0, failed = 0;
  for (let i = 0; i < list.length; i++) {
    const { product, zeroVariants } = list[i];
    const cat = detectCategory(product.title, product.handle, product.productType);
    const grams = CATEGORY_DEFAULTS_G[cat];

    const variantsInput = zeroVariants.map(v => ({
      id: v.id,
      inventoryItem: {
        measurement: { weight: { value: grams, unit: 'GRAMS' } }
      }
    }));

    try {
      await bulkUpdateWeight(product.id, variantsInput);
      updated += variantsInput.length;
    } catch (e) {
      failed += variantsInput.length;
      if (failed < 5) console.error(`  ✗ ${product.title}: ${e.message}`);
    }
    if (i % 20 === 19) {
      console.log(`  ${i + 1}/${list.length} produtos (${updated} variantes atualizadas)`);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`  Produtos auditados:        ${list.length}`);
  console.log(`  Variantes atualizadas:     ${updated}`);
  console.log(`  Falhas:                    ${failed}`);
}

main().catch(e => { console.error('FALHA:', e); process.exit(1); });
