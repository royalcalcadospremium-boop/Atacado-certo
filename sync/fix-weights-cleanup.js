// fix-weights-cleanup.js — Cleanup one-shot: corrige produtos com peso unitário
// absurdamente alto (provável bug onde valor em GRAMAS foi multiplicado por 1000
// virando KG, ou onde KG foi gravado como GRAMS).
//
// Lógica:
//   - Busca todas variantes ativas
//   - Para cada variante, lê peso em gramas
//   - Se peso > 5.000 g (5 kg) por unidade, divide por 1000
//     (calçado / chinelo / acessório nunca pesa > 5 kg unitário)
//   - Cap final: > 50.000 g (50 kg) força para o default da categoria
//
// Uso (local ou via GitHub Action): node fix-weights-cleanup.js
// Variáveis de ambiente: DRY_RUN=1 para simular sem gravar.

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

// Limite acima do qual peso unitário é considerado bug de unidade.
const PER_UNIT_MAX_GRAMS = 5000;   // 5 kg — qualquer produto da loja é menor que isso
const HARD_CAP_GRAMS     = 50000;  // 50 kg — se persistir acima disso, força fallback

// Pesos default por categoria (gramas) — mesmos do fix-weights-fallback.js
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

function toGrams(value, unit) {
  if (value == null) return 0;
  const v = Number(value) || 0;
  const u = String(unit || 'GRAMS').toUpperCase();
  switch (u) {
    case 'GRAMS': case 'G': return v;
    case 'KILOGRAMS': case 'KG': return v * 1000;
    case 'OUNCES': case 'OZ': return v * 28.3495;
    case 'POUNDS': case 'LB': return v * 453.592;
    default: return v;
  }
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

async function fetchAllProducts() {
  console.log('Buscando produtos...');
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
    for (const edge of data.products.edges) all.push(edge.node);
    pages++;
    if (pages % 5 === 0) console.log(`  ${pages} páginas (${all.length} produtos)`);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  console.log(`Total: ${all.length} produtos em ${pages} páginas.\n`);
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
  console.log(`=== Cleanup de Pesos Absurdos ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`);
  const products = await fetchAllProducts();

  // Coleta variantes problemáticas
  const fixes = [];
  let totalVariants = 0;
  for (const p of products) {
    const cat = detectCategory(p.title, p.handle, p.productType);
    const fallbackG = CATEGORY_DEFAULTS_G[cat];
    const variantsToFix = [];

    for (const ed of p.variants.edges) {
      totalVariants++;
      const v = ed.node;
      const w = v.inventoryItem?.measurement?.weight;
      if (!w) continue;
      const grams = toGrams(w.value, w.unit);
      if (grams <= PER_UNIT_MAX_GRAMS) continue; // já está OK

      // Corrige: divide por 1000 até cair em faixa razoável
      let corrected = grams;
      while (corrected > PER_UNIT_MAX_GRAMS) corrected = corrected / 1000;
      // Se ficou < 1 g (overshoot), usa fallback da categoria
      if (corrected < 1) corrected = fallbackG;
      // Se ainda absurdo após loop (>50kg, dados muito corrompidos), fallback
      if (corrected > HARD_CAP_GRAMS) corrected = fallbackG;

      corrected = Math.round(corrected);

      variantsToFix.push({
        id: v.id,
        sku: v.sku,
        variantTitle: v.title,
        beforeG: grams,
        afterG: corrected
      });
    }

    if (variantsToFix.length > 0) {
      fixes.push({ product: p, category: cat, variants: variantsToFix });
    }
  }

  console.log(`Total variantes: ${totalVariants}`);
  console.log(`Produtos com peso unitário > ${PER_UNIT_MAX_GRAMS} g: ${fixes.length}`);

  if (fixes.length === 0) {
    console.log('Nenhum produto a corrigir. ✅');
    return;
  }

  // Relatório de amostragem
  console.log('\nAmostra das primeiras 10 correções:');
  fixes.slice(0, 10).forEach(f => {
    const v0 = f.variants[0];
    console.log(`  [${f.category}] ${f.product.title} (${v0.sku || v0.variantTitle}): ${v0.beforeG} g → ${v0.afterG} g`);
  });

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Nenhuma alteração foi feita.');
    console.log(`Para executar de verdade: rode sem DRY_RUN=1`);
    return;
  }

  let updated = 0, failed = 0;
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    const variantsInput = f.variants.map(v => ({
      id: v.id,
      inventoryItem: {
        measurement: { weight: { value: v.afterG, unit: 'GRAMS' } }
      }
    }));

    try {
      await bulkUpdateWeight(f.product.id, variantsInput);
      updated += variantsInput.length;
    } catch (e) {
      failed += variantsInput.length;
      if (failed < 5) console.error(`  ✗ ${f.product.title}: ${e.message}`);
    }
    if (i % 20 === 19) {
      console.log(`  ${i + 1}/${fixes.length} produtos (${updated} variantes corrigidas)`);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`  Produtos auditados:    ${products.length}`);
  console.log(`  Variantes corrigidas:  ${updated}`);
  console.log(`  Falhas:                ${failed}`);
}

main().catch(e => { console.error('FALHA:', e); process.exit(1); });
