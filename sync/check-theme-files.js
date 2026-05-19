// Lista templates do tema ATIVO via Shopify Admin API.
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

// 1) Active theme ID
const themes = await gql(`{ themes(first: 10) { edges { node { id name role } } } }`);
const main = themes.themes.edges.find(e => e.node.role === 'MAIN');
console.log('Active theme:', main.node.name, main.node.id);

// 2) Files in the active theme that match page.*.json (REST API needed; GraphQL doesn't expose theme files)
const tid = main.node.id.replace('gid://shopify/OnlineStoreTheme/', '');
const restRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/themes/${tid}/assets.json`, {
  headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN }
});
const restJson = await restRes.json();
const tpls = (restJson.assets || []).filter(a => a.key.startsWith('templates/page.') || a.key.startsWith('sections/atacado') || a.key.startsWith('sections/dropshipping') || a.key.startsWith('sections/varejo') || a.key.startsWith('sections/collection-banner'));
console.log('\nArquivos das LPs no tema ATIVO:');
for (const a of tpls.sort((a,b) => a.key.localeCompare(b.key))) {
  console.log(`  ${a.key} (${a.size}b, modificado ${a.updated_at})`);
}
console.log(`\nTotal templates/page.* + LP sections: ${tpls.length}`);
