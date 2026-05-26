// auto-blog.js — Auto blog post generator for Royal Calçados Atacado.
// Reads next topic from sync/blog-topics.json, generates HTML via GitHub Models
// (gpt-4o-mini, free tier), grabs a product image from the Shopify catalog,
// and POSTs the article as DRAFT (published=false) via the Shopify Admin REST API.
//
// Idempotent: tracks progress in sync/blog-state.json. If all topics consumed,
// logs a warning and exits 0 (workflow won't fail).
//
// Uso: node auto-blog.js
// Variáveis de ambiente: DRY_RUN=1 para gerar sem postar.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '.env');
const TOPICS_PATH = join(__dirname, 'blog-topics.json');
const STATE_PATH = join(__dirname, 'blog-state.json');

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
for (const k of ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_TOKEN', 'GITHUB_TOKEN']) {
  if (!env[k]) { console.error(`Falta ${k}`); process.exit(1); }
}

const DRY_RUN = process.env.DRY_RUN === '1';

const SHOPIFY_API_VERSION = '2025-01';
const GH_MODELS_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';
const GH_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `Você é um redator SEO especialista em e-commerce brasileiro de atacado de calçados e roupas. Escreve para Royal Calçados Atacado (royalatacado.com.br) — uma loja brasileira que vende atacado, dropshipping e varejo de marcas como Nike, Adidas, Mizuno, Puma, Hugo Boss, Tommy Hilfiger.

REGRAS DE ESCRITA:
- Português brasileiro natural, sem clichês de IA ("no mundo de hoje", "vamos explorar", "em conclusão")
- Tom direto, prático, com exemplos concretos do nicho (calçados, revenda, sacolão)
- Estrutura: H1 (título do post) → intro de 2-3 parágrafos → 4-6 seções com H2 → conclusão com CTA
- Use H3 dentro das H2 quando fizer sentido
- Inclua tabelas, listas numeradas, e listas com marcadores quando enriquecer o conteúdo
- 800-1200 palavras
- INCLUA links internos: <a href="/collections/{handle}">texto</a> usando os handles fornecidos
- Termine com um CTA forte linkando uma coleção relevante
- NÃO inventa estatísticas falsas ("87% dos revendedores..."). Use generalizações honestas
- NÃO promete preços específicos (varia toda hora)
- Use a primeira pessoa do plural ("nós", "nossa loja") representando a Royal

SAÍDA: APENAS HTML válido (sem markdown, sem \`\`\`html\`\`\`). Pronto pra colar direto no campo body_html do Shopify.`;

function userPrompt(topic) {
  return `Escreva um post de blog para Royal Calçados Atacado com estes parâmetros:

Título: ${topic.title}
Palavra-chave principal: ${topic.primary_keyword}
Audiência: ${topic.audience}
Tom: ${topic.tone}
Intenção de busca: ${topic.intent}
Coleções pra linkar internamente: ${(topic.category_links || []).join(', ')}

Para cada coleção mencionada, use o handle como /collections/{handle}.

Gere o HTML completo do corpo do post.`;
}

async function withRetry(label, fn, attempts = 3, backoffMs = 3000) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.status === 429) throw e;
      if (i < attempts) {
        console.warn(`  ! ${label} tentativa ${i} falhou: ${e.message}. Retry em ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastErr;
}

async function shopifyREST(path, options = {}) {
  const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  if (!res.ok) {
    const err = new Error(`Shopify REST ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function callGitHubModels(topic) {
  const body = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(topic) }
    ],
    model: GH_MODEL,
    temperature: 0.7,
    max_tokens: 3000
  };
  const res = await fetch(GH_MODELS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`GitHub Models ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('GitHub Models: resposta vazia');
  return content.trim().replace(/^```html\s*/i, '').replace(/```$/g, '').trim();
}

async function getBlogId() {
  const data = await shopifyREST('blogs.json');
  if (!data?.blogs?.length) throw new Error('Nenhum blog encontrado na loja');
  return data.blogs[0].id;
}

async function getCollectionIdByHandle(handle) {
  try {
    const custom = await shopifyREST(`custom_collections.json?handle=${encodeURIComponent(handle)}`);
    if (custom?.custom_collections?.length) return custom.custom_collections[0].id;
  } catch (e) { /* try smart next */ }
  try {
    const smart = await shopifyREST(`smart_collections.json?handle=${encodeURIComponent(handle)}`);
    if (smart?.smart_collections?.length) return smart.smart_collections[0].id;
  } catch (e) { /* fall through */ }
  return null;
}

async function fetchImageForCollection(handle) {
  if (!handle) return null;
  const collectionId = await getCollectionIdByHandle(handle);
  if (!collectionId) {
    console.log(`  ! Coleção "${handle}" não encontrada — pulando imagem`);
    return null;
  }
  const data = await shopifyREST(`products.json?collection_id=${collectionId}&limit=20`);
  const products = (data?.products || []).filter(p => p.images && p.images.length > 0);
  if (!products.length) return null;
  const pick = products[Math.floor(Math.random() * products.length)];
  return pick.images[0].src || null;
}

function extractSummary(html, maxLen = 150) {
  const firstP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const raw = (firstP ? firstP[1] : html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (raw.length <= maxLen) return raw;
  const cut = raw.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut) + '...';
}

function loadTopics() {
  if (!existsSync(TOPICS_PATH)) {
    console.error(`Arquivo não encontrado: ${TOPICS_PATH}`);
    process.exit(1);
  }
  let topics;
  try {
    topics = JSON.parse(readFileSync(TOPICS_PATH, 'utf8'));
  } catch (e) {
    console.error(`JSON inválido em ${TOPICS_PATH}: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(topics) || topics.length === 0) {
    console.error(`blog-topics.json precisa ser um array não-vazio`);
    process.exit(1);
  }
  return topics;
}

function loadState() {
  if (!existsSync(STATE_PATH)) return { next_index: 0 };
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch (e) {
    console.warn(`blog-state.json inválido, resetando: ${e.message}`);
    return { next_index: 0 };
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function main() {
  console.log(`=== Auto Blog (${DRY_RUN ? 'DRY_RUN' : 'LIVE'}) ===`);

  const topics = loadTopics();
  const state = loadState();
  const idx = state.next_index ?? 0;

  if (idx >= topics.length) {
    console.warn(`All topics used (${topics.length}/${topics.length}) — regenerate blog-topics.json`);
    return;
  }

  const topic = topics[idx];
  console.log(`Topic [${idx + 1}/${topics.length}]: ${topic.slug}`);
  console.log(`Title: ${topic.title}`);

  console.log(`Calling GitHub Models (${GH_MODEL})...`);
  const html = await withRetry('GitHub Models', () => callGitHubModels(topic));
  console.log(`  ✓ Generated ${html.length} chars of HTML`);

  const firstCategory = (topic.category_links || [])[0];
  let imageUrl = null;
  if (firstCategory) {
    console.log(`Fetching image from collection "${firstCategory}"...`);
    try {
      imageUrl = await withRetry('Fetch image', () => fetchImageForCollection(firstCategory));
      if (imageUrl) console.log(`  ✓ Got image: ${imageUrl}`);
      else console.log(`  ! No image found — continuing without`);
    } catch (e) {
      console.warn(`  ! Image fetch failed: ${e.message} — continuing without`);
    }
  }

  const summary = extractSummary(html);
  const tags = ['auto-blog', topic.audience, topic.intent].filter(Boolean).join(',');

  if (DRY_RUN) {
    console.log('\n[DRY_RUN] Não publicando. Prévia:');
    console.log(`  tags:    ${tags}`);
    console.log(`  summary: ${summary}`);
    console.log(`  image:   ${imageUrl || '(none)'}`);
    console.log(`  html (primeiros 300 chars): ${html.slice(0, 300)}...`);
    return;
  }

  console.log(`Discovering blog_id...`);
  const blogId = await withRetry('Get blog', () => getBlogId());

  console.log(`Creating article in Shopify (blog_id: ${blogId})...`);
  const article = {
    blog_id: blogId,
    title: topic.title,
    body_html: html,
    tags,
    published: false,
    summary_html: summary
  };
  if (imageUrl) article.image = { src: imageUrl };

  const created = await withRetry('Create article',
    () => shopifyREST(`blogs/${blogId}/articles.json`, {
      method: 'POST',
      body: JSON.stringify({ article })
    })
  );
  const articleId = created?.article?.id;
  console.log(`  ✓ Article created (id: ${articleId}, published: false)`);

  const nextIndex = idx + 1;
  saveState({
    next_index: nextIndex,
    last_published_at: new Date().toISOString(),
    last_topic_slug: topic.slug,
    last_article_id: articleId
  });
  console.log(`State updated: next_index=${nextIndex}`);
}

main().catch(e => {
  if (e.status === 429) console.error('Rate limit (429) — tentar de novo na próxima execução agendada.');
  console.error('FALHA:', e.message || e);
  process.exit(1);
});
