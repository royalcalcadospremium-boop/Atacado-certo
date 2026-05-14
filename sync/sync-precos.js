// Sincroniza preços do Olist (Tiny ERP v3) para o Shopify.
//
// DUAS GRAVAÇÕES por produto:
//   1. variant.price       = PREÇO DE VAREJO (precoPromocional da aba Dados Gerais do Olist)
//   2. product.metafield   = PREÇO DE ATACADO (precoPromocional da Lista ATACADO do Olist)
//      custom.preco_atacado
//
// A Shopify Function "atacado-tier-discount" lê o metafield e aplica desconto progressivo
// quando o carrinho atinge 10/50/100/200+ pares.
//
// Estratégia otimizada:
//  - 1 chamada GET /listas-precos/{id ATACADO} retorna TODOS os 7000+ preços atacado de uma vez
//  - Iteração paginada de /produtos para varejo
//  - Pre-fetch Shopify (cursor) → índice sku → variantGid + productGid
//  - Bulk updates: productVariantsBulkUpdate (em batch por produto) + metafieldsSet (até 25 por chamada)
//
// Uso:
//   node oauth-flow.js       # 1ª vez, gera refresh_token
//   DRY_RUN=1 node sync-precos.js   # preview
//   node sync-precos.js              # executa

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '.env');
const DRY_RUN = process.env.DRY_RUN === '1';

function loadEnv() {
  const raw = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const clean = line.replace(/\r$/, '');
    const m = clean.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function saveEnvKeys(updates) {
  let raw = readFileSync(ENV_PATH, 'utf8');
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(raw)) raw = raw.replace(re, `${k}=${v}`);
    else raw += `\n${k}=${v}`;
  }
  writeFileSync(ENV_PATH, raw);
}

const env = loadEnv();
const required = ['TINY_CLIENT_ID', 'TINY_CLIENT_SECRET', 'TINY_REFRESH_TOKEN',
                  'SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_TOKEN'];
for (const k of required) {
  if (!env[k]) { console.error(`Falta ${k} no .env`); process.exit(1); }
}

const METAFIELD_NS = env.SHOPIFY_METAFIELD_NAMESPACE || 'custom';
const METAFIELD_KEY = env.SHOPIFY_METAFIELD_KEY || 'preco_atacado';
const USE_PROMO = env.OLIST_USE_PROMO_PRICE !== '0';
const OLIST_LIST_NAME = (env.OLIST_LIST_NAME || 'ATACADO').toUpperCase().trim();
const OLIST_API_BASE = 'https://api.tiny.com.br/public-api/v3';
const OLIST_TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

// ---------- retry helper ----------
async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, options); }
    catch (err) {
      lastErr = err;
      const wait = 1000 * Math.pow(2, i);
      console.error(`  ! fetch falhou (${i + 1}/${attempts}) — aguardando ${wait}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ---------- Olist v3 ----------
async function refreshOlistToken() {
  const res = await fetchWithRetry(OLIST_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.TINY_CLIENT_ID,
      client_secret: env.TINY_CLIENT_SECRET,
      refresh_token: env.TINY_REFRESH_TOKEN
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Falha renovar token Olist: ' + JSON.stringify(data));
  env.TINY_ACCESS_TOKEN = data.access_token;
  if (data.refresh_token) env.TINY_REFRESH_TOKEN = data.refresh_token;
  env.TINY_TOKEN_EXPIRES_AT = String(Date.now() + (data.expires_in * 1000) - 60_000);
  saveEnvKeys({
    TINY_ACCESS_TOKEN: env.TINY_ACCESS_TOKEN,
    TINY_REFRESH_TOKEN: env.TINY_REFRESH_TOKEN,
    TINY_TOKEN_EXPIRES_AT: env.TINY_TOKEN_EXPIRES_AT
  });
}

async function ensureOlistToken() {
  const expiresAt = Number(env.TINY_TOKEN_EXPIRES_AT || 0);
  if (!env.TINY_ACCESS_TOKEN || Date.now() >= expiresAt) await refreshOlistToken();
}

async function olistGET(path) {
  await ensureOlistToken();
  const url = `${OLIST_API_BASE}${path}`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${env.TINY_ACCESS_TOKEN}` } });
  if (res.status === 401) { await refreshOlistToken(); return olistGET(path); }
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    return olistGET(path);
  }
  if (!res.ok) throw new Error(`Olist ${res.status} em ${path}: ${await res.text()}`);
  return res.json();
}

async function* iterateOlistProducts() {
  let offset = 0;
  const limit = 100;
  while (true) {
    const data = await olistGET(`/produtos?limit=${limit}&offset=${offset}`);
    const items = data.itens || [];
    if (items.length === 0) break;
    for (const item of items) yield item;
    if (items.length < limit) break;
    offset += limit;
  }
}

async function getAtacadoListId() {
  const data = await olistGET('/listas-precos');
  const lists = data.itens || [];
  const target = lists.find(l => (l.descricao || '').trim().toUpperCase() === OLIST_LIST_NAME);
  if (!target) throw new Error(`Lista de preços "${OLIST_LIST_NAME}" não encontrada. Disponíveis: ${lists.map(l => l.descricao).join(', ')}`);
  return target.id;
}

// Retorna Map sku → atacadoBRL (em reais)
async function fetchAtacadoPrices(listId) {
  const data = await olistGET(`/listas-precos/${listId}`);
  const excecoes = data.excecoes || [];
  const map = new Map();
  for (const e of excecoes) {
    const sku = (e.codigo || '').trim();
    if (!sku) continue;
    const promo = Number(e.precoPromocional || 0);
    const normal = Number(e.preco || 0);
    const v = (USE_PROMO && promo > 0) ? promo : normal;
    if (v > 0) map.set(sku, v);
  }
  return map;
}

// ---------- Shopify Admin ----------
async function shopifyGraphQL(query, variables = {}) {
  const res = await fetchWithRetry(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`, {
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

// Índice: Map<productGid, { title, variants: [{variantGid, sku}] }>
// Também: Map<sku, { productGid, variantGid }>
async function buildShopifyIndex() {
  console.log('Indexando produtos do Shopify...');
  const byProduct = new Map();
  const bySku = new Map();
  let cursor = null;
  let pages = 0;

  while (true) {
    const data = await shopifyGraphQL(
      `query($cursor: String) {
        products(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              variants(first: 100) {
                edges { node { id sku } }
              }
            }
          }
        }
      }`,
      { cursor }
    );
    pages++;
    for (const edge of data.products.edges) {
      const p = edge.node;
      const variantsArr = [];
      for (const v of p.variants.edges) {
        const sku = (v.node.sku || '').trim();
        if (!sku) continue;
        variantsArr.push({ variantGid: v.node.id, sku });
        bySku.set(sku, { productGid: p.id, variantGid: v.node.id });
      }
      if (variantsArr.length > 0) byProduct.set(p.id, { title: p.title, variants: variantsArr });
    }
    if (pages % 10 === 0) console.log(`  ${pages} páginas (${bySku.size} SKUs)`);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  console.log(`Índice Shopify pronto: ${byProduct.size} produtos · ${bySku.size} SKUs em ${pages} páginas.\n`);
  return { byProduct, bySku };
}

async function bulkUpdateVariantPrices(productGid, variantsData) {
  // variantsData: [{ id: variantGid, price: "79.90" }]
  const data = await shopifyGraphQL(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
       productVariantsBulkUpdate(productId: $productId, variants: $variants) {
         productVariants { id price }
         userErrors { field message }
       }
     }`,
    { productId: productGid, variants: variantsData }
  );
  const errs = data.productVariantsBulkUpdate.userErrors;
  if (errs && errs.length) throw new Error('variantsBulkUpdate: ' + JSON.stringify(errs));
  return data.productVariantsBulkUpdate.productVariants.length;
}

async function setMetafieldsBatch(metafields) {
  const data = await shopifyGraphQL(
    `mutation($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         metafields { id key }
         userErrors { field message }
       }
     }`,
    { metafields }
  );
  const errs = data.metafieldsSet.userErrors;
  if (errs && errs.length) throw new Error('metafieldsSet: ' + JSON.stringify(errs));
  return data.metafieldsSet.metafields.length;
}

// ---------- main ----------
function pickVarejoPrice(item) {
  const sku = (item.sku || item.codigo || '').trim();
  const precos = item.precos || item;
  const promo = Number(precos.precoPromocional ?? 0);
  const normal = Number(precos.preco ?? 0);
  const v = (USE_PROMO && promo > 0) ? promo : normal;
  return { sku, value: v };
}

async function run() {
  console.log(`\n=== Sync VAREJO + ATACADO Olist → Shopify (${DRY_RUN ? 'DRY-RUN' : 'EXECUTANDO'}) ===`);
  console.log(`variant.price = varejo (precoPromocional Dados Gerais)`);
  console.log(`${METAFIELD_NS}.${METAFIELD_KEY} = atacado (precoPromocional Lista ${OLIST_LIST_NAME})\n`);

  // Fase 1: índice Shopify
  const { byProduct, bySku } = await buildShopifyIndex();

  // Fase 2A: preços atacado em 1 chamada
  console.log(`Buscando preços da Lista ${OLIST_LIST_NAME}...`);
  const listId = await getAtacadoListId();
  console.log(`Lista ID: ${listId}`);
  const atacadoBySku = await fetchAtacadoPrices(listId);
  console.log(`Pre-fetch atacado: ${atacadoBySku.size} SKUs.\n`);

  // Fase 2B: itera Olist produtos pra pegar varejo
  console.log('Lendo produtos do Olist (varejo)...');
  // queue: Map<productGid, { variants: [{variantGid, varejo}], atacadoValue, productTitle }>
  const productQueue = new Map();
  const skuAtacadoUsed = new Map(); // sku → atacado (pra debug)
  let total = 0, skipped = 0, missing = 0, missingAtacado = 0;

  for await (const item of iterateOlistProducts()) {
    total++;
    const { sku, value: varejo } = pickVarejoPrice(item);
    if (!sku || !varejo || varejo <= 0) { skipped++; continue; }

    const hit = bySku.get(sku);
    if (!hit) { missing++; continue; }

    const atacado = atacadoBySku.get(sku);
    if (!atacado) {
      missingAtacado++;
      // Se não tem atacado, ainda atualiza varejo no variant.price
    }

    let entry = productQueue.get(hit.productGid);
    if (!entry) {
      entry = {
        productTitle: byProduct.get(hit.productGid)?.title || '',
        variants: [],
        atacadoValue: atacado || null
      };
      productQueue.set(hit.productGid, entry);
    }
    // Adiciona variante (se ainda não tiver)
    if (!entry.variants.find(v => v.variantGid === hit.variantGid)) {
      entry.variants.push({ variantGid: hit.variantGid, varejo, sku });
    }
    if (atacado && !entry.atacadoValue) entry.atacadoValue = atacado;
    if (atacado) skuAtacadoUsed.set(sku, atacado);

    if (total % 1000 === 0) console.log(`  Olist: ${total} produtos lidos (${productQueue.size} a atualizar)`);
  }

  console.log(`\nResumo da leitura:`);
  console.log(`  Total Olist lido:           ${total}`);
  console.log(`  Sem preço/sku (ignorados):  ${skipped}`);
  console.log(`  Sem match no Shopify:       ${missing}`);
  console.log(`  Sem preço atacado:          ${missingAtacado}`);
  console.log(`  Produtos a atualizar:       ${productQueue.size}`);

  if (DRY_RUN) {
    let i = 0;
    for (const [gid, info] of productQueue) {
      if (i++ < 15) {
        const v = info.variants[0];
        console.log(`  · ${v.sku} | varejo R$ ${v.varejo.toFixed(2)} | atacado R$ ${(info.atacadoValue || 0).toFixed(2)} (${info.variants.length} variants) | ${info.productTitle}`);
      }
    }
    console.log(`\n[DRY-RUN] ${productQueue.size} produtos seriam atualizados.`);
    return;
  }

  // Fase 3A: bulk update variant prices (varejo no .price)
  console.log(`\nAtualizando variant.price em ${productQueue.size} produtos...`);
  let pricesWritten = 0, pricesFailed = 0;
  const productsArr = Array.from(productQueue.entries());
  for (let i = 0; i < productsArr.length; i++) {
    const [productGid, info] = productsArr[i];
    const variantsInput = info.variants.map(v => ({
      id: v.variantGid,
      price: v.varejo.toFixed(2)
    }));
    try {
      await bulkUpdateVariantPrices(productGid, variantsInput);
      pricesWritten += variantsInput.length;
    } catch (err) {
      pricesFailed += variantsInput.length;
      console.error(`  ✗ prices ${info.productTitle.substring(0, 40)}: ${err.message}`);
    }
    if (i % 20 === 19) {
      console.log(`  ${i + 1}/${productsArr.length} produtos — ${pricesWritten} variants escritas`);
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.log(`Prices: ${pricesWritten} variants atualizadas (${pricesFailed} falhas)\n`);

  // Fase 3B: metafields atacado em batches de 25
  console.log(`Gravando metafield ${METAFIELD_NS}.${METAFIELD_KEY} em batches...`);
  const metafieldsList = productsArr
    .filter(([, info]) => info.atacadoValue && info.atacadoValue > 0)
    .map(([productGid, info]) => ({
      ownerId: productGid,
      namespace: METAFIELD_NS,
      key: METAFIELD_KEY,
      type: 'number_decimal',
      value: info.atacadoValue.toFixed(2)
    }));
  let mfWritten = 0, mfFailed = 0;
  for (let i = 0; i < metafieldsList.length; i += 25) {
    const slice = metafieldsList.slice(i, i + 25);
    try {
      const n = await setMetafieldsBatch(slice);
      mfWritten += n;
    } catch (err) {
      mfFailed += slice.length;
      console.error(`  ✗ metafield batch: ${err.message}`);
    }
    if ((i / 25) % 5 === 0) console.log(`  batch ${Math.floor(i / 25) + 1}/${Math.ceil(metafieldsList.length / 25)}`);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nResumo final:`);
  console.log(`  Produtos lidos no Olist:       ${total}`);
  console.log(`  variant.price atualizados:     ${pricesWritten}`);
  console.log(`  metafield preço atacado:       ${mfWritten}`);
  console.log(`  Falhas (prices):               ${pricesFailed}`);
  console.log(`  Falhas (metafields):           ${mfFailed}`);
}

run().catch(err => {
  console.error('\nFalha:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
