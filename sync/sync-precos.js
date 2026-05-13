// Sincroniza PREÇO DE VAREJO do Olist (Tiny ERP v3) para metafields do Shopify.
//
// Fonte: /produtos do Olist → campo `preco_promocional` (Dados Gerais)
//        Esse é o "Preço promocional Varejo" que o Fellipe usa.
// Destino: product.metafields.custom.preco_varejo no Shopify
// Mapeamento: Olist.codigo === Shopify.variant.sku
//
// O preço de atacado já está em Shopify.product.variant.price (vindo da integração nativa Olist).
//
// Uso:
//   1) Configurar .env (use .env.example como referência)
//   2) `npm run auth` — 1ª vez, gera refresh_token
//   3) `npm run sync:dry` — simula, mostra o que vai mudar sem gravar
//   4) `npm run sync` — executa de fato

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
const required = [
  'TINY_CLIENT_ID', 'TINY_CLIENT_SECRET', 'TINY_REFRESH_TOKEN',
  'SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_TOKEN'
];
for (const k of required) {
  if (!env[k]) {
    console.error(`Falta ${k} no .env. Configure antes de rodar.`);
    process.exit(1);
  }
}

const METAFIELD_NS = env.SHOPIFY_METAFIELD_NAMESPACE || 'custom';
const METAFIELD_KEY = env.SHOPIFY_METAFIELD_KEY || 'preco_varejo';
const USE_PROMO = env.OLIST_USE_PROMO_PRICE !== '0';

const OLIST_API_BASE = 'https://api.tiny.com.br/public-api/v3';
const OLIST_TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

// ---------- Olist v3 ----------
async function refreshOlistToken() {
  const res = await fetch(OLIST_TOKEN_URL, {
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
  if (!env.TINY_ACCESS_TOKEN || Date.now() >= expiresAt) {
    await refreshOlistToken();
  }
}

async function olistGET(path) {
  await ensureOlistToken();
  const url = `${OLIST_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.TINY_ACCESS_TOKEN}` }
  });
  if (res.status === 401) {
    await refreshOlistToken();
    return olistGET(path);
  }
  if (res.status === 429) {
    // rate limit: aguarda 5s e tenta de novo (1x)
    await new Promise(r => setTimeout(r, 5000));
    const retry = await fetch(url, { headers: { Authorization: `Bearer ${env.TINY_ACCESS_TOKEN}` } });
    if (!retry.ok) throw new Error(`Olist ${retry.status} em ${path}: ${await retry.text()}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`Olist ${res.status} em ${path}: ${await res.text()}`);
  return res.json();
}

// Lista produtos com paginação. Retorna iterador async de produtos {id, sku, preco, precoPromocional}
async function* iterateOlistProducts() {
  let offset = 0;
  const limit = 100;
  while (true) {
    const data = await olistGET(`/produtos?limit=${limit}&offset=${offset}`);
    const items = data.itens || data.produtos || data.data || [];
    if (items.length === 0) break;
    for (const item of items) yield item;
    if (items.length < limit) break;
    offset += limit;
  }
}

// ---------- Shopify Admin ----------
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
  if (!res.ok || json.errors) {
    throw new Error('Shopify GQL: ' + JSON.stringify(json.errors || json));
  }
  return json.data;
}

async function findShopifyProductBySku(sku) {
  const data = await shopifyGraphQL(
    `query($q: String!) {
       productVariants(first: 1, query: $q) {
         edges { node { id sku product { id title } } }
       }
     }`,
    { q: `sku:${sku}` }
  );
  const edge = data.productVariants.edges[0];
  return edge ? edge.node : null;
}

async function setProductMetafield(productGid, value) {
  const data = await shopifyGraphQL(
    `mutation($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         metafields { id key value }
         userErrors { field message }
       }
     }`,
    {
      metafields: [{
        ownerId: productGid,
        namespace: METAFIELD_NS,
        key: METAFIELD_KEY,
        type: 'number_decimal',
        value: String(value)
      }]
    }
  );
  const errs = data.metafieldsSet.userErrors;
  if (errs && errs.length) throw new Error('metafieldsSet: ' + JSON.stringify(errs));
}

// ---------- main ----------
function pickRetailPrice(item) {
  // item esperado do Olist v3: { id, sku, codigo, descricao, precos: { preco, precoPromocional, precoCusto } }
  const sku = item.sku || item.codigo || item.codigoSku;
  const precos = item.precos || item;
  const promo = Number(precos.precoPromocional ?? item.precoPromocional ?? 0);
  const normal = Number(precos.preco ?? item.preco ?? 0);
  // Usa preço promocional se houver E setting permitir; caso contrário, preço normal
  const value = (USE_PROMO && promo > 0) ? promo : normal;
  return { sku, value };
}

async function run() {
  console.log(`\n=== Sync VAREJO Olist → Shopify (${DRY_RUN ? 'DRY-RUN' : 'EXECUTANDO'}) ===`);
  console.log(`Origem: /produtos (preco_promocional = preço de varejo)`);
  console.log(`Destino: ${METAFIELD_NS}.${METAFIELD_KEY}`);
  console.log();

  let touched = 0, skipped = 0, missing = 0, total = 0;
  const skuCache = new Set(); // evita reprocessar SKUs duplicados (variações no Olist)

  for await (const item of iterateOlistProducts()) {
    total++;
    const { sku, value } = pickRetailPrice(item);

    if (!sku) { skipped++; continue; }
    if (!value || value <= 0) { skipped++; continue; }
    if (skuCache.has(sku)) { skipped++; continue; }
    skuCache.add(sku);

    const variant = await findShopifyProductBySku(sku);
    if (!variant) { missing++; continue; }

    if (DRY_RUN) {
      console.log(`  · ${sku} → R$ ${value.toFixed(2)} (${variant.product.title})`);
    } else {
      try {
        await setProductMetafield(variant.product.id, value.toFixed(2));
        console.log(`  ✓ ${sku} → R$ ${value.toFixed(2)} (${variant.product.title})`);
      } catch (err) {
        console.error(`  ✗ ${sku}: ${err.message}`);
      }
    }
    touched++;

    // suaviza rate limit do Shopify Admin API
    if (touched % 20 === 0) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nResumo:`);
  console.log(`  Total Olist:          ${total}`);
  console.log(`  Atualizados:          ${touched}`);
  console.log(`  Sem match no Shopify: ${missing}`);
  console.log(`  Ignorados (sem preço/sku/duplicados): ${skipped}`);
}

run().catch(err => {
  console.error('\nFalha:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
