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
- NÃO use H1 (o tema já exibe o título do post como H1)
- Estrutura: parágrafo "Resposta rápida" (40-60 palavras que respondem direto à pergunta do título, em <p><strong>Resposta rápida:</strong> ...</p>) → intro curta → 4-6 seções com H2 → conclusão com CTA
- Escreva H2 em forma de pergunta quando possível ("Quanto custa...?", "Como...?") e responda na primeira frase logo abaixo — é o formato que Google e IAs (ChatGPT, Gemini, Perplexity) citam
- Use H3 dentro das H2 quando fizer sentido
- Parágrafos curtos (2-4 frases), uma ideia por parágrafo
- Cite a Royal Calçados Atacado pelo nome ao menos 2 vezes (ajuda as IAs a associarem o assunto à marca)
- Inclua tabelas, listas numeradas, e listas com marcadores quando enriquecer o conteúdo
- 800-1200 palavras
- INCLUA links internos: <a href="/collections/{handle}">texto</a> usando os handles fornecidos
- Termine com um CTA forte linkando uma coleção relevante
- NÃO inventa estatísticas falsas ("87% dos revendedores..."). Use generalizações honestas
- NÃO promete preços específicos (varia toda hora)
- Use a primeira pessoa do plural ("nós", "nossa loja") representando a Royal

SAÍDA: APENAS um objeto JSON válido, sem markdown, com as chaves:
{
  "html": "corpo do post em HTML (sem H1, sem a seção de perguntas frequentes)",
  "meta_title": "título SEO com até 60 caracteres, palavra-chave no início",
  "meta_description": "descrição SEO com 140-155 caracteres, com a palavra-chave e um convite à ação",
  "image_alt": "texto alternativo descritivo para a imagem de capa",
  "faq": [ { "q": "pergunta real que o público busca", "a": "resposta direta de 1-3 frases" } ]
}
O "faq" deve ter de 4 a 6 perguntas diferentes das H2 do corpo.`;

function userPrompt(topic) {
  return `Escreva um post de blog para Royal Calçados Atacado com estes parâmetros:

Título: ${topic.title}
Palavra-chave principal: ${topic.primary_keyword}
Audiência: ${topic.audience}
Tom: ${topic.tone}
Intenção de busca: ${topic.intent}
Coleções pra linkar internamente: ${(topic.category_links || []).join(', ')}

Para cada coleção mencionada, use o handle como /collections/{handle}.

Responda somente com o objeto JSON pedido.`;
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
    max_tokens: 4000,
    response_format: { type: 'json_object' }
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
  return parseModelOutput(content);
}

// Aceita o JSON pedido; se o modelo devolver só HTML, segue com HTML puro.
function parseModelOutput(content) {
  const raw = content.trim().replace(/^```(?:json|html)?\s*/i, '').replace(/```$/g, '').trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    out = { html: raw };
  }
  if (!out.html || typeof out.html !== 'string') throw new Error('GitHub Models: JSON sem "html"');
  // Garante H1 único: o tema já renderiza o título do artigo como H1.
  out.html = out.html.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/gi, '').trim();
  out.faq = Array.isArray(out.faq)
    ? out.faq.filter(f => f && typeof f.q === 'string' && typeof f.a === 'string' && f.q.trim() && f.a.trim())
        .slice(0, 8).map(f => ({ q: f.q.trim(), a: f.a.trim() }))
    : [];
  return out;
}

function clip(text, max) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
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
  const generated = await withRetry('GitHub Models', () => callGitHubModels(topic));
  const html = generated.html;
  console.log(`  ✓ Generated ${html.length} chars of HTML, ${generated.faq.length} FAQ`);

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

  const summary = extractSummary(html.replace(/<p[^>]*>\s*<strong>\s*Resposta r[aá]pida:?\s*<\/strong>/i, '<p>'));
  const metaTitle = clip(generated.meta_title || topic.title, 60);
  const metaDescription = clip(generated.meta_description || summary, 155);
  const tags = ['auto-blog', topic.audience, topic.intent].filter(Boolean).join(',');

  if (DRY_RUN) {
    console.log('\n[DRY_RUN] Não publicando. Prévia:');
    console.log(`  tags:    ${tags}`);
    console.log(`  summary: ${summary}`);
    console.log(`  meta_title (${metaTitle.length}): ${metaTitle}`);
    console.log(`  meta_description (${metaDescription.length}): ${metaDescription}`);
    console.log(`  faq: ${generated.faq.map(f => f.q).join(' | ')}`);
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
    summary_html: summary,
    metafields: [
      { namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: metaTitle },
      { namespace: 'global', key: 'description_tag', type: 'multi_line_text_field', value: metaDescription }
    ]
  };
  if (topic.slug) article.handle = topic.slug;
  if (generated.faq.length) {
    // Lido pelo tema: FAQ visível no artigo + schema FAQPage.
    article.metafields.push({ namespace: 'seo', key: 'faq', type: 'json', value: JSON.stringify(generated.faq) });
  }
  if (imageUrl) article.image = { src: imageUrl, alt: clip(generated.image_alt || topic.title, 120) };

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
