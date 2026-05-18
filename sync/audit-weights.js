// audit-weights.js — Audita peso e dimensões de todos os produtos no Shopify.
//
// Reporta produtos com:
//   - Peso = 0 (provavelmente esquecido de cadastrar)
//   - Variantes com pesos DIFERENTES dentro do mesmo produto (incomum em calçados)
//   - Outliers estatísticos por categoria (peso 3× acima da média de produtos similares)
//   - Sem inventory_management (não rastreados — separado, mas útil saber)
//
// Saída:
//   - Markdown no $GITHUB_STEP_SUMMARY (visível direto na UI do GitHub Actions)
//   - CSV em audit-weights-report.csv (artifact downloadável)
//
// Uso: AUDIT_MODE=1 node audit-weights.js (rodado pelo workflow auditoria-peso.yml)

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
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
  if (!env[k]) { console.error(`Falta ${k} no .env`); process.exit(1); }
}

const SUMMARY_FILE = process.env.GITHUB_STEP_SUMMARY || '/tmp/summary.md';
const CSV_FILE = join(__dirname, 'audit-weights-report.csv');

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

// Categoria heurística baseada em title/handle/productType
function detectCategory(title, handle, productType) {
  const text = (title + ' ' + handle + ' ' + (productType || '')).toLowerCase();
  if (/chinelo|sandal/.test(text)) return 'chinelo';
  if (/t[eê]nis|sneaker|airmax|nike|adidas|mizuno/.test(text)) return 'tenis';
  if (/bon[eé]|cap|hat/.test(text)) return 'bone';
  if (/camiseta|t-shirt|shirt/.test(text)) return 'camiseta';
  if (/bermuda|short/.test(text)) return 'bermuda';
  if (/cal[çc]a|pants|jeans/.test(text)) return 'calca';
  return 'outros';
}

// Pesos esperados por categoria (em gramas, faixa razoável)
const EXPECTED_RANGES = {
  chinelo:   { min: 100,  max: 600,  label: '100g – 600g' },
  tenis:     { min: 400,  max: 1400, label: '400g – 1.4kg' },
  bone:      { min: 30,   max: 250,  label: '30g – 250g' },
  camiseta:  { min: 80,   max: 400,  label: '80g – 400g' },
  bermuda:   { min: 120,  max: 600,  label: '120g – 600g' },
  calca:     { min: 200,  max: 900,  label: '200g – 900g' },
  outros:    { min: 0,    max: Infinity, label: '—' }
};

async function fetchAllProducts() {
  console.log('Buscando produtos do Shopify (paginated)...');
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
              tags
              status
              variants(first: 100) {
                edges {
                  node {
                    id
                    sku
                    title
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                      measurement {
                        weight { value unit }
                      }
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

function audit(products) {
  const findings = {
    zeroWeight: [],
    inconsistentUnits: [],
    inconsistentVariantWeights: [],
    outliersByCategory: {},
    summary: {
      totalProducts: products.length,
      totalVariants: 0,
      productsWithAllVariantsZero: 0,
      productsWithSomeVariantZero: 0,
      productsByCategory: {}
    }
  };

  // Coleta estatísticas por categoria
  const categoryWeights = {};

  for (const p of products) {
    const cat = detectCategory(p.title, p.handle, p.productType);
    findings.summary.productsByCategory[cat] = (findings.summary.productsByCategory[cat] || 0) + 1;

    const variants = p.variants.edges.map(e => e.node);
    findings.summary.totalVariants += variants.length;

    const weights = variants.map(v => {
      const w = v.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) : 0;
      return { variant: v, grams: g, unit: w?.unit || null };
    });

    // 1. Todos pesos = 0 ?
    const allZero = weights.every(w => w.grams === 0);
    const someZero = weights.some(w => w.grams === 0) && !allZero;
    if (allZero) {
      findings.summary.productsWithAllVariantsZero++;
      findings.zeroWeight.push({
        productId: p.id, title: p.title, handle: p.handle, category: cat, variantCount: variants.length, severity: 'ALTO'
      });
    } else if (someZero) {
      findings.summary.productsWithSomeVariantZero++;
      findings.zeroWeight.push({
        productId: p.id, title: p.title, handle: p.handle, category: cat,
        variantCount: variants.length,
        zeroVariants: weights.filter(w => w.grams === 0).map(w => w.variant.title).join(' | '),
        severity: 'MÉDIO'
      });
    }

    // 2. Unidades inconsistentes dentro do mesmo produto?
    const units = new Set(weights.filter(w => w.unit).map(w => w.unit));
    if (units.size > 1) {
      findings.inconsistentUnits.push({
        productId: p.id, title: p.title, handle: p.handle,
        units: [...units].join(', ')
      });
    }

    // 3. Pesos diferentes entre variantes (suspeito em calçados — mesma cor/modelo deveria ter mesmo peso)
    const nonZeroWeights = weights.filter(w => w.grams > 0).map(w => w.grams);
    if (nonZeroWeights.length > 1) {
      const min = Math.min(...nonZeroWeights);
      const max = Math.max(...nonZeroWeights);
      if (max > min * 1.5) {
        findings.inconsistentVariantWeights.push({
          productId: p.id, title: p.title, handle: p.handle, category: cat,
          minG: min, maxG: max, variance: ((max - min) / min * 100).toFixed(0) + '%'
        });
      }
    }

    // 4. Coleta para outliers por categoria
    if (!allZero && nonZeroWeights.length > 0) {
      const avg = nonZeroWeights.reduce((a, b) => a + b, 0) / nonZeroWeights.length;
      categoryWeights[cat] = categoryWeights[cat] || [];
      categoryWeights[cat].push({ productId: p.id, title: p.title, handle: p.handle, avgG: avg });
    }
  }

  // 5. Outliers por categoria — fora da faixa esperada + 3× a média da categoria
  for (const [cat, list] of Object.entries(categoryWeights)) {
    const expectedRange = EXPECTED_RANGES[cat];
    findings.outliersByCategory[cat] = [];
    const median = list.map(x => x.avgG).sort((a, b) => a - b)[Math.floor(list.length / 2)];
    for (const item of list) {
      const outOfRange = item.avgG < expectedRange.min || item.avgG > expectedRange.max;
      const outlierVsMedian = median > 0 && (item.avgG < median / 3 || item.avgG > median * 3);
      if (outOfRange || outlierVsMedian) {
        findings.outliersByCategory[cat].push({
          ...item,
          expected: expectedRange.label,
          actual: item.avgG < 1000 ? `${Math.round(item.avgG)} g` : `${(item.avgG / 1000).toFixed(2)} kg`,
          reason: outOfRange ? `fora da faixa ${expectedRange.label}` : `outlier vs mediana ${Math.round(median)}g`
        });
      }
    }
  }

  return findings;
}

function writeReports(findings) {
  // ===== Markdown summary (GitHub Step Summary) =====
  const md = [];
  md.push('# 📦 Auditoria de Peso — Royal Atacado');
  md.push('');
  md.push(`**Data:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  md.push(`**Total produtos auditados:** ${findings.summary.totalProducts}`);
  md.push(`**Total variantes:** ${findings.summary.totalVariants}`);
  md.push('');
  md.push('## Resumo por categoria');
  md.push('');
  md.push('| Categoria | Produtos | Faixa esperada |');
  md.push('|---|---|---|');
  for (const [cat, count] of Object.entries(findings.summary.productsByCategory)) {
    md.push(`| ${cat} | ${count} | ${EXPECTED_RANGES[cat]?.label || '—'} |`);
  }
  md.push('');

  // 1. Zero weight
  md.push(`## 🚨 Produtos com peso = 0  (${findings.zeroWeight.length})`);
  if (findings.zeroWeight.length === 0) {
    md.push('Nenhum produto com peso zerado. ✅');
  } else {
    md.push('');
    md.push('Esses produtos não vão calcular frete corretamente. **Ação:** cadastrar peso no Shopify Admin → Produtos → Variantes → Weight.');
    md.push('');
    md.push('| Severidade | Categoria | Produto | Handle | Variantes c/ peso 0 |');
    md.push('|---|---|---|---|---|');
    for (const item of findings.zeroWeight.slice(0, 200)) {
      md.push(`| ${item.severity} | ${item.category} | ${item.title} | \`${item.handle}\` | ${item.zeroVariants || 'TODAS'} |`);
    }
    if (findings.zeroWeight.length > 200) md.push(`\n_(${findings.zeroWeight.length - 200} produtos adicionais — ver CSV completo)_`);
  }
  md.push('');

  // 2. Inconsistent units
  md.push(`## ⚠️ Produtos com unidades de peso mistas  (${findings.inconsistentUnits.length})`);
  if (findings.inconsistentUnits.length === 0) {
    md.push('Todos os produtos usam unidade consistente. ✅');
  } else {
    md.push('');
    md.push('Variantes do mesmo produto estão em unidades diferentes (g/kg/oz/lb). Padroniza pra gramas.');
    md.push('');
    md.push('| Produto | Handle | Unidades |');
    md.push('|---|---|---|');
    for (const item of findings.inconsistentUnits) {
      md.push(`| ${item.title} | \`${item.handle}\` | ${item.units} |`);
    }
  }
  md.push('');

  // 3. Inconsistent variant weights
  md.push(`## ⚠️ Variantes do mesmo produto c/ peso muito diferente  (${findings.inconsistentVariantWeights.length})`);
  if (findings.inconsistentVariantWeights.length === 0) {
    md.push('Variantes consistentes. ✅');
  } else {
    md.push('');
    md.push('Diferença > 50% entre menor e maior peso. Comum em calçados se houve digitação errada de tamanhos.');
    md.push('');
    md.push('| Produto | Categoria | Min | Max | Variação |');
    md.push('|---|---|---|---|---|');
    for (const item of findings.inconsistentVariantWeights.slice(0, 100)) {
      md.push(`| ${item.title} | ${item.category} | ${item.minG}g | ${item.maxG}g | ${item.variance} |`);
    }
    if (findings.inconsistentVariantWeights.length > 100) md.push(`\n_(${findings.inconsistentVariantWeights.length - 100} adicionais no CSV)_`);
  }
  md.push('');

  // 4. Outliers by category
  md.push('## 🔍 Outliers por categoria (peso fora do razoável)');
  md.push('');
  for (const [cat, list] of Object.entries(findings.outliersByCategory)) {
    if (list.length === 0) continue;
    md.push(`### ${cat}  (${list.length} produtos suspeitos)`);
    md.push('');
    md.push('| Produto | Peso médio | Esperado | Razão |');
    md.push('|---|---|---|---|');
    for (const item of list.slice(0, 50)) {
      md.push(`| ${item.title} | ${item.actual} | ${item.expected} | ${item.reason} |`);
    }
    if (list.length > 50) md.push(`_(${list.length - 50} adicionais no CSV)_`);
    md.push('');
  }

  appendFileSync(SUMMARY_FILE, md.join('\n'));
  console.log(`\n📊 Resumo escrito em ${SUMMARY_FILE}`);

  // ===== CSV completo =====
  const csvLines = ['severity,categoria,issue,product_title,product_handle,product_id,details'];
  for (const item of findings.zeroWeight) {
    csvLines.push([item.severity, item.category, 'peso_zero', JSON.stringify(item.title), item.handle, item.productId, JSON.stringify(item.zeroVariants || 'TODAS')].join(','));
  }
  for (const item of findings.inconsistentUnits) {
    csvLines.push(['MEDIO', '-', 'unidades_mistas', JSON.stringify(item.title), item.handle, item.productId, JSON.stringify(item.units)].join(','));
  }
  for (const item of findings.inconsistentVariantWeights) {
    csvLines.push(['MEDIO', item.category, 'variantes_inconsistentes', JSON.stringify(item.title), item.handle, item.productId, `"${item.minG}g-${item.maxG}g (${item.variance})"`].join(','));
  }
  for (const [cat, list] of Object.entries(findings.outliersByCategory)) {
    for (const item of list) {
      csvLines.push(['BAIXO', cat, 'outlier_peso', JSON.stringify(item.title), item.handle, item.productId, JSON.stringify(`${item.actual} (${item.reason})`)].join(','));
    }
  }
  writeFileSync(CSV_FILE, csvLines.join('\n'), 'utf8');
  console.log(`📋 CSV completo em ${CSV_FILE} (${csvLines.length - 1} linhas)`);
}

async function main() {
  console.log('=== Auditoria de Peso — Royal Atacado ===\n');
  const products = await fetchAllProducts();
  console.log('Auditando...');
  const findings = audit(products);
  writeReports(findings);

  console.log('\n=== Resumo ===');
  console.log(`  Produtos com TODAS variantes peso=0:    ${findings.summary.productsWithAllVariantsZero}`);
  console.log(`  Produtos com ALGUMAS variantes peso=0:  ${findings.summary.productsWithSomeVariantZero}`);
  console.log(`  Unidades mistas (kg/g/oz):              ${findings.inconsistentUnits.length}`);
  console.log(`  Variantes inconsistentes (>50% diff):   ${findings.inconsistentVariantWeights.length}`);
  let totalOutliers = 0;
  for (const list of Object.values(findings.outliersByCategory)) totalOutliers += list.length;
  console.log(`  Outliers por categoria:                 ${totalOutliers}`);
}

main().catch(e => { console.error('FALHA:', e); process.exit(1); });
