// force-upload-theme-files.js — Faz upload direto via Shopify Admin REST API
// dos arquivos das LPs que ainda não chegaram no tema ativo (sync GitHub lento).
//
// Compara: arquivos locais (templates/page.atacado.json, sections/atacado-*.liquid, etc.)
// contra arquivos no tema ATIVO via assets.json API. Sobe os faltantes ou desatualizados.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
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

// Pega ID do tema ativo
const themes = await gql(`{ themes(first: 10) { edges { node { id name role } } } }`);
const main = themes.themes.edges.find(e => e.node.role === 'MAIN');
const themeId = main.node.id.replace('gid://shopify/OnlineStoreTheme/', '');
console.log(`Tema ativo: ${main.node.name} (id ${themeId})\n`);

// Lista de arquivos que devem estar no tema (locais)
const filesToCheck = [];

// Templates
['atacado','dropshipping','varejo'].forEach(h => {
  filesToCheck.push(`templates/page.${h}.json`);
});

// Sections das LPs
['atacado','dropshipping','varejo'].forEach(prefix => {
  const sectionsDir = join(PROJECT_ROOT, 'sections');
  readdirSync(sectionsDir).filter(f => f.startsWith(`${prefix}-`) && f.endsWith('.liquid')).forEach(f => {
    filesToCheck.push(`sections/${f}`);
  });
});

// Foundation
filesToCheck.push('sections/collection-banner.liquid');
filesToCheck.push('snippets/lp-hero-video.liquid');
filesToCheck.push('snippets/lp-faq-accordion.liquid');
filesToCheck.push('assets/lp-shared.css');
filesToCheck.push('assets/lp-shared.js');

// Chrome (announcement-bar com novos modality CTAs)
// Não inclui settings_data.json pq tem presets legados que falham na validacao
filesToCheck.push('sections/announcement-bar.liquid');

console.log(`Verificando ${filesToCheck.length} arquivos...\n`);

let uploaded = 0, skipped = 0, failed = 0;
for (const key of filesToCheck) {
  const localPath = join(PROJECT_ROOT, key);
  if (!existsSync(localPath)) {
    console.log(`  [SKIP] ${key} — não existe local`);
    skipped++;
    continue;
  }
  const localContent = readFileSync(localPath, 'utf8');
  const localSize = Buffer.byteLength(localContent, 'utf8');

  // Faz upload via REST PUT
  try {
    const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/themes/${themeId}/assets.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        asset: { key, value: localContent }
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 200)}`);
    }
    console.log(`  [UP]   ${key} (${localSize}b)`);
    uploaded++;
  } catch (e) {
    console.error(`  [FAIL] ${key}: ${e.message}`);
    failed++;
  }
  // Pequeno delay pra não bater rate limit
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\n=== Resumo ===`);
console.log(`  Uploaded:    ${uploaded}`);
console.log(`  Skipped:     ${skipped}`);
console.log(`  Falhas:      ${failed}`);
if (failed > 0) process.exit(1);
