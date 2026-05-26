// fix-pack6-weights.js — Targeted fix: Pack 6 Camisetas com peso unitário (100–300g)
// foram cadastrados como se fosse 1 camisa em vez do pack inteiro.
//
// Lógica:
//   - Filtra produtos cujo título contém "Pack 6" (case-insensitive)
//   - Para cada variante desses produtos com peso entre 100g e 300g (inclusive),
//     multiplica por 6 (representa as 6 camisetas do pack).
//   - Cap de segurança: nunca grava peso > 5000g (5 kg).
//
// Variantes com peso < 100g ou > 300g são deixadas como estão (provavelmente já
// corretas ou fora do escopo deste fix targeted).
//
// Uso (local ou via GitHub Action): node fix-pack6-weights.js
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

const PACK_MULTIPLIER = 6;
const TARGET_MIN_GRAMS = 100;
const TARGET_MAX_GRAMS = 300;
const SAFETY_CAP_GRAMS = 5000;   // 5 kg — nunca grava mais que isso
const TITLE_MATCH = /pack\s*6\b/i;

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
  console.log(`=== Fix Pack 6 Weights ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===`);
  console.log(`  Filtro título:   /pack\\s*6\\b/i`);
  console.log(`  Faixa peso alvo: ${TARGET_MIN_GRAMS}g a ${TARGET_MAX_GRAMS}g`);
  console.log(`  Multiplicador:   ×${PACK_MULTIPLIER}`);
  console.log(`  Cap segurança:   ${SAFETY_CAP_GRAMS}g\n`);

  const products = await fetchAllProducts();

  const matchedPack6 = products.filter(p => TITLE_MATCH.test(p.title));
  console.log(`Produtos com "Pack 6" no título: ${matchedPack6.length}`);

  const fixes = [];
  let inRange = 0, outOfRange = 0;
  for (const p of matchedPack6) {
    const variantsToFix = [];
    for (const ed of p.variants.edges) {
      const v = ed.node;
      const w = v.inventoryItem?.measurement?.weight;
      if (!w) continue;
      const grams = toGrams(w.value, w.unit);
      if (grams < TARGET_MIN_GRAMS || grams > TARGET_MAX_GRAMS) {
        outOfRange++;
        continue;
      }
      inRange++;
      let corrected = Math.round(grams * PACK_MULTIPLIER);
      if (corrected > SAFETY_CAP_GRAMS) corrected = SAFETY_CAP_GRAMS;
      variantsToFix.push({
        id: v.id,
        sku: v.sku,
        variantTitle: v.title,
        beforeG: grams,
        afterG: corrected
      });
    }
    if (variantsToFix.length > 0) fixes.push({ product: p, variants: variantsToFix });
  }

  console.log(`  Variantes no alvo (${TARGET_MIN_GRAMS}–${TARGET_MAX_GRAMS}g): ${inRange}`);
  console.log(`  Variantes fora do alvo (puladas):       ${outOfRange}`);
  console.log(`  Produtos a corrigir:                    ${fixes.length}\n`);

  if (fixes.length === 0) {
    console.log('Nenhum produto a corrigir. ✅');
    return;
  }

  console.log('Amostra das primeiras 10 correções:');
  fixes.slice(0, 10).forEach(f => {
    const v0 = f.variants[0];
    console.log(`  ${f.product.title.substring(0, 55).padEnd(55)} (${v0.sku || v0.variantTitle}): ${v0.beforeG}g → ${v0.afterG}g`);
  });

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Nenhuma alteração foi feita.');
    console.log('Para executar de verdade: rode sem DRY_RUN=1');
    return;
  }

  console.log('\nAplicando correções...');
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
  console.log(`  Produtos auditados:       ${products.length}`);
  console.log(`  Pack 6 detectados:        ${matchedPack6.length}`);
  console.log(`  Variantes corrigidas:     ${updated}`);
  console.log(`  Falhas:                   ${failed}`);
}

main().catch(e => { console.error('FALHA:', e); process.exit(1); });
