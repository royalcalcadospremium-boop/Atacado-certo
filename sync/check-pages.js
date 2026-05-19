// Quick check: lista as 3 pages das LPs e seu templateSuffix
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
    const m = line.replace(/\r$/, '').match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return { ...process.env, ...env };
}
const env = loadEnv();

async function gql(q, v={}) {
  const r = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-Shopify-Access-Token':env.SHOPIFY_ADMIN_TOKEN},
    body: JSON.stringify({query:q, variables:v})
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors||j));
  return j.data;
}

for (const handle of ['atacado','dropshipping','varejo']) {
  const d = await gql(`query($q:String!){pages(first:5, query:$q){edges{node{id title handle templateSuffix isPublished onlineStoreUrl}}}}`, {q:`handle:${handle}`});
  const found = d.pages.edges.find(e=>e.node.handle===handle);
  if (found) {
    console.log(`/pages/${handle}:`);
    console.log(`  id: ${found.node.id}`);
    console.log(`  templateSuffix: "${found.node.templateSuffix}"`);
    console.log(`  isPublished: ${found.node.isPublished}`);
    console.log(`  onlineStoreUrl: ${found.node.onlineStoreUrl}`);
  } else {
    console.log(`/pages/${handle}: NÃO ENCONTRADA`);
  }
}
