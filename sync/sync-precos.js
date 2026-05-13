// Sincroniza PREÇO DE VAREJO do Olist (Tiny ERP v3) para metafields do Shopify.
//
// Estratégia OTIMIZADA:
// 1) Pre-fetch de TODOS os produtos Shopify via cursor pagination (~80 calls)
//    e monta índice em memória: { sku → productGid }
// 2) Itera todos os produtos Olist (com paginação interna)
// 3) Cada hit no índice → enfileira em batch
// 4) Persiste em batches de 25 metafields por mutação (metafieldsSet)
//
// Tempo esperado: ~5 minutos pra ~9k produtos (versus ~3-4h da versão item-a-item).
//
// Origem: /produtos do Olist → campo `precos.precoPromocional` (Dados Gerais)
// Destino: product.metafields.custom.preco_varejo
// Mapeamento: Olist.sku === Shopify.variant.sku
//
// Uso:
//   1) `npm run sync:dry` — simula sem gravar (mostra lista + estatística)
//   2) `npm run sync` — executa de fato

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '.env');
const DRY_RUN = process.env.DRY_RUN === '1';

// ---------- env helpers ----------
function loadEnv() {
  const raw = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
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
const METAFIELD_KEY = env.SHOPIFY_METAFIELD_KEY || 'preco_varejo';
const USE_PROMO = env.OLIST_USE_PROMO_PRICE !== '0';
const OLIST_API_BASE = 'https://api.tiny.com.br/public-api/v3';
const OLIST_TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

// ---------- retry helper ----------
async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
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
  if (!res.ok) throw new Error('Falha ao renovar token Olist: ' + JSON.stringify(data));
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

// Pré-baixa todos os produtos do Shopify com cursor pagination.
// Retorna Map: sku → { productGid, productTitle }
async function buildShopifyIndex() {
  console.log('Indexando produtos do Shopify (pode levar 1-3 min)...');
  const index = new Map();
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
                edges { node { sku } }
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
      for (const v of p.variants.edges) {
        const sku = v.node.sku;
        if (sku && !index.has(sku)) {
          index.set(sku, { productGid: p.id, productTitle: p.title });
        }
      }
    }
    if (pages % 10 === 0) console.log(`  ${pages} páginas (${index.size} SKUs)`);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  console.log(`Índice Shopify pronto: ${index.size} SKUs em ${pages} páginas.\n`);
  return index;
}

// Envia até 25 metafields numa única mutation
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
function pickRetailPrice(item) {
  const sku = item.sku || item.codigo;
  const precos = item.precos || item;
  const promo = Number(precos.precoPromocional ?? 0);
  const normal = Number(precos.preco ?? 0);
  const value = (USE_PROMO && promo > 0) ? promo : normal;
  return { sku, value };
}

async function run() {
  console.log(`\n=== Sync VAREJO Olist → Shopify (${DRY_RUN ? 'DRY-RUN' : 'EXECUTANDO'}) ===`);
  console.log(`Origem: /produtos (preco_promocional = preço de varejo)`);
  console.log(`Destino: ${METAFIELD_NS}.${METAFIELD_KEY}\n`);

  // Fase 1: índice Shopify
  const shopifyIndex = await buildShopifyIndex();

  // Fase 2: itera Olist e agrupa metafields a aplicar
  console.log('Lendo produtos do Olist...');
  const queue = new Map(); // productGid → { value, sku, title }
  let total = 0, skipped = 0, missing = 0;

  for await (const item of iterateOlistProducts()) {
    total++;
    const { sku, value } = pickRetailPrice(item);
    if (!sku || !value || value <= 0) { skipped++; continue; }
    const hit = shopifyIndex.get(sku);
    if (!hit) { missing++; continue; }
    // Se mesmo product já está na queue, mantém o primeiro preço encontrado
    // (todas as variantes do mesmo produto geralmente têm o mesmo preço)
    if (!queue.has(hit.productGid)) {
      queue.set(hit.productGid, { value, sku, title: hit.productTitle });
    }
    if (total % 1000 === 0) console.log(`  Olist: ${total} produtos lidos (${queue.size} a atualizar)`);
  }

  console.log(`\nOlist lido: ${total} itens · ${queue.size} produtos a atualizar · ${missing} sem match · ${skipped} ignorados`);

  if (DRY_RUN) {
    let n = 0;
    for (const [gid, info] of queue) {
      if (n < 20) console.log(`  · ${info.sku} → R$ ${info.value.toFixed(2)} (${info.title})`);
      n++;
    }
    console.log(`\n[DRY-RUN] ${queue.size} metafields seriam escritos.`);
    return;
  }

  // Fase 3: grava em batches de 25
  console.log(`\nGravando ${queue.size} metafields em batches de 25...`);
  const entries = Array.from(queue.entries());
  let written = 0, failed = 0;

  for (let i = 0; i < entries.length; i += 25) {
    const slice = entries.slice(i, i + 25);
    const metafields = slice.map(([gid, info]) => ({
      ownerId: gid,
      namespace: METAFIELD_NS,
      key: METAFIELD_KEY,
      type: 'number_decimal',
      value: info.value.toFixed(2)
    }));
    try {
      const n = await setMetafieldsBatch(metafields);
      written += n;
      if ((i / 25) % 10 === 0) {
        console.log(`  batch ${Math.floor(i / 25) + 1}/${Math.ceil(entries.length / 25)} — ${written} escritos`);
      }
    } catch (err) {
      failed += slice.length;
      console.error(`  ✗ batch ${i / 25}: ${err.message}`);
    }
    // pequeno respiro pra rate limit (Shopify: 2000 cost / 100 restore-rate)
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nResumo final:`);
  console.log(`  Produtos Olist lidos:       ${total}`);
  console.log(`  Sem match no Shopify:       ${missing}`);
  console.log(`  Sem preço/sku (ignorados):  ${skipped}`);
  console.log(`  Metafields escritos:        ${written}`);
  console.log(`  Falhas:                     ${failed}`);
}

run().catch(err => {
  console.error('\nFalha:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
