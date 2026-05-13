# Setup — Sync Preço de Varejo (Olist → Shopify)

Sincronização que lê o **preço promocional** (Dados Gerais) de cada produto no Olist (ex-Tiny ERP) via API v3 OAuth e grava em `product.metafields.custom.preco_varejo` no Shopify. O tema lê esse metafield e exibe os 2 preços nos cards (`1 par` = varejo, `10+ pares` = atacado).

**Arquitetura:**
```
Olist API v3 OAuth         sync/sync-precos.js          Shopify Admin GraphQL
/produtos                  ─────────────►                metafields custom.preco_varejo
precos.precoPromocional                                  (lido pelo rc-product-card.liquid)
```

Mapeamento por SKU (`Olist.sku ⇄ Shopify.variant.sku`).

## Pré-requisitos

- Node.js 20+
- App OAuth criado no Olist (Configurações → Aplicativos)
- Custom App no Shopify Admin com escopos `read_products` + `write_products`

---

## 1) Olist: criar app OAuth v3

1. Em `https://erp.olist.com/aplicativos_api` (precisa da extensão **"Gestão de Aplicativos"** instalada na Loja de Extensões)
2. **+ novo aplicativo**
3. Preencher:
   - **Nome:** `Royal Atacado Sync`
   - **URL de Redirecionamento:** `http://localhost:3000/oauth/callback`
   - **Permissões:** marque "Produtos" e "Lista de Preços" (leitura)
4. Salvar → copie **Client ID** e **Client Secret**

## 2) Shopify: Admin API token

1. Shopify Admin → Configurações → Apps → **Desenvolver apps**
2. Reutilize um app existente OU crie um novo
3. Em **Configuração da Admin API**, marque `read_products` + `write_products`
4. **Instalar app** → revele o **Admin API access token** (`shpat_...`)

## 3) Setup local

```bash
cd sync
cp .env.example .env
# Edite .env: preencha TINY_CLIENT_ID, TINY_CLIENT_SECRET,
# SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN

# Bootstrap OAuth (1ª vez) — abre browser pra você autorizar:
node oauth-flow.js
# Após autorizar, o .env recebe TINY_ACCESS_TOKEN e TINY_REFRESH_TOKEN.

# Simulação (não grava):
DRY_RUN=1 node sync-precos.js

# Execução real:
node sync-precos.js
```

Tempo esperado: **~1 minuto** pra ~9k produtos no Olist e ~4k SKUs no Shopify (estratégia: pre-fetch do Shopify em memória + batches de 25 metafields por mutation).

## 4) Automatizar via GitHub Actions (sync diário)

1. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**
2. Crie 5 secrets:
   - `TINY_CLIENT_ID`
   - `TINY_CLIENT_SECRET`
   - `TINY_REFRESH_TOKEN` (pegue do `sync/.env` após `node oauth-flow.js`)
   - `SHOPIFY_STORE_DOMAIN` (ex: `812091-2.myshopify.com`)
   - `SHOPIFY_ADMIN_TOKEN`
3. **Opcional:** crie um Personal Access Token (PAT) com escopo `repo` + `actions:write` e adicione como secret `GH_PAT` — isso permite que o workflow atualize automaticamente o secret `TINY_REFRESH_TOKEN` quando o Olist rotaciona. Se você não criar, a rotação não funciona e em ~30 dias o sync para — basta rodar `node oauth-flow.js` localmente de novo nesse caso.
4. O workflow `.github/workflows/sync-precos.yml` roda automaticamente todo dia às 04h BRT.
5. Pra rodar manualmente: aba **Actions → Sync preço de varejo (Olist → Shopify) → Run workflow**.

---

## Detalhes técnicos

- **Origem do preço:** `precos.precoPromocional` (campo "Preço promocional" da aba Dados Gerais do Olist). Se zero/vazio, cai pra `precos.preco`.
- **Destino:** `product.metafields.custom.preco_varejo` (tipo `number_decimal`, valor em reais com 2 casas).
- **Mapeamento:** SKU. Se um SKU do Olist não existe como variant no Shopify, é ignorado (esperado pra produtos do ERP que não foram importados pra loja).
- **Idempotente:** Pode rodar várias vezes sem problema — sempre sobrescreve com o valor atual.
- **Resiliente:** Retry exponencial em falhas de rede (1s/2s/4s/8s). Erros isolados em batches não derrubam o sync inteiro.

---

## Troubleshooting

**"Falta TINY_REFRESH_TOKEN no .env"**
- Rode `node oauth-flow.js` localmente uma vez pra fazer o bootstrap.

**Erro 401 do Olist**
- O refresh_token expirou (Olist mantém só 30 dias offline). Rode `node oauth-flow.js` de novo.

**Erro 401/403 do Shopify**
- O app foi desinstalado ou o token foi revogado. Reinstale o app (Admin → Configurações → Apps → "Desenvolver apps" → o app → Instalar) e revele um token novo.

**"Sem match no Shopify" alto**
- Esperado se o Olist tem mais produtos que o Shopify (ex: 9k Olist vs 4k Shopify). Apenas SKUs presentes em ambos são sincronizados.

**Quero forçar reprocessar tudo**
- Já é sempre `metafieldsSet` (upsert), então rodar de novo já reprocessa todos os 349 com o valor atual do Olist.
