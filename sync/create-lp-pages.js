// create-lp-pages.js — Cria as 3 páginas das landing pages (atacado, dropshipping, varejo)
// via Shopify Admin GraphQL API.
//
// Cada page é criada com:
//   - title
//   - handle
//   - templateSuffix (aponta pro page.{handle}.json criado nas Etapas 2-4)
//   - body (pequeno fallback caso o template não renderize)
//
// Idempotente: se a página já existe (mesmo handle), pula sem erro.
//
// Uso: node create-lp-pages.js (precisa SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN no env)

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

const PAGES = [
  {
    handle: 'atacado',
    title: 'Atacado',
    templateSuffix: 'atacado',
    body: '<p>Compre no Atacado e Multiplique sua Margem. 10+ pares, melhor preço, entrega rápida com nota fiscal.</p>'
  },
  {
    handle: 'dropshipping',
    title: 'Dropshipping',
    templateSuffix: 'dropshipping',
    body: '<p>Venda sem estoque. Pegue qualquer quantidade. A Royal embala e envia pelo seu nome.</p>'
  },
  {
    handle: 'varejo',
    title: 'Varejo',
    templateSuffix: 'varejo',
    body: '<p>Tênis originais com frete grátis acima de R$150. Pague em até 12x sem juros.</p>'
  }
];

async function findPageByHandle(handle) {
  const data = await shopifyGraphQL(
    `query($handle: String!) {
       pages(first: 1, query: $handle) {
         edges { node { id handle title templateSuffix } }
       }
     }`,
    { handle: `handle:${handle}` }
  );
  const edge = data.pages.edges.find(e => e.node.handle === handle);
  return edge ? edge.node : null;
}

async function createPage(page) {
  const data = await shopifyGraphQL(
    `mutation($page: PageCreateInput!) {
       pageCreate(page: $page) {
         page { id handle title templateSuffix }
         userErrors { field message }
       }
     }`,
    {
      page: {
        title: page.title,
        handle: page.handle,
        templateSuffix: page.templateSuffix,
        body: page.body,
        isPublished: true
      }
    }
  );
  const errs = data.pageCreate.userErrors;
  if (errs && errs.length) throw new Error('pageCreate: ' + JSON.stringify(errs));
  return data.pageCreate.page;
}

async function updatePageTemplate(pageId, templateSuffix) {
  const data = await shopifyGraphQL(
    `mutation($id: ID!, $page: PageUpdateInput!) {
       pageUpdate(id: $id, page: $page) {
         page { id handle templateSuffix }
         userErrors { field message }
       }
     }`,
    { id: pageId, page: { templateSuffix } }
  );
  const errs = data.pageUpdate.userErrors;
  if (errs && errs.length) throw new Error('pageUpdate: ' + JSON.stringify(errs));
  return data.pageUpdate.page;
}

async function main() {
  console.log('=== Criando 3 pages das Landing Pages ===\n');
  let created = 0, existed = 0, fixed = 0, failed = 0;

  for (const page of PAGES) {
    try {
      const existing = await findPageByHandle(page.handle);
      if (existing) {
        console.log(`  [EXISTE] /pages/${page.handle} — id ${existing.id}`);
        existed++;
        if (existing.templateSuffix !== page.templateSuffix) {
          console.log(`     ↳ corrigindo templateSuffix: ${existing.templateSuffix || '(none)'} → ${page.templateSuffix}`);
          await updatePageTemplate(existing.id, page.templateSuffix);
          fixed++;
        }
      } else {
        const newPage = await createPage(page);
        console.log(`  [CRIADO] /pages/${newPage.handle} — id ${newPage.id} — template ${newPage.templateSuffix}`);
        created++;
      }
    } catch (e) {
      console.error(`  [FAIL] /pages/${page.handle}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`  Criadas:                ${created}`);
  console.log(`  Já existiam:            ${existed}`);
  console.log(`  Template corrigido:     ${fixed}`);
  console.log(`  Falhas:                 ${failed}`);
  console.log(`\nURLs ao vivo (depois de Shopify atualizar):`);
  for (const p of PAGES) console.log(`  https://${env.SHOPIFY_STORE_DOMAIN.replace('.myshopify.com','')}.com.br/pages/${p.handle}`);

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FALHA:', e); process.exit(1); });
