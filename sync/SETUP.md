# Setup — Sync Preços Atacado (Olist → Shopify)

Sincronização que lê a Lista de Preços **ATACADO** do Olist (ex-Tiny ERP) e grava o preço de atacado em um metafield de cada produto no Shopify (`custom.preco_atacado`). O tema lê esse metafield e exibe os 2 preços nos cards e na página de produto.

## Pré-requisitos

- Node.js 20+
- Conta Olist com API v3 habilitada
- Loja Shopify com permissão para criar Custom Apps

---

## 1) Gerar credenciais Olist (API v3 / OAuth)

1. Entre em https://erp.tiny.com.br
2. Configurações → API → **API v3** → **Criar aplicação**
3. Preencha:
   - **Nome:** `Royal Atacado - Sync Preços`
   - **URL de redirecionamento:** `http://localhost:3000/oauth/callback`
   - **Escopos:** marque tudo relacionado a **Produtos** e **Listas de Preços** (leitura)
4. Salve → você recebe **Client ID** e **Client Secret**

## 2) Gerar credencial Shopify (Admin API)

1. Shopify Admin → Configurações (engrenagem) → **Apps e canais de vendas**
2. **Desenvolver apps** → confirme se pedir → **Criar um app**
3. Nome: `Sync Preços Atacado`
4. **Configuração da Admin API** → escopos:
   - `read_products`
   - `write_products`
5. **Instalar app** → copie o **Admin API access token** (`shpat_...`)
6. Confirme o domínio `.myshopify.com` em Configurações → Domínios

## 3) Setup local

```bash
cd sync
cp .env.example .env
# Edite .env preenchendo TINY_CLIENT_ID, TINY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN

# Rode o bootstrap OAuth (abre browser pra você autorizar)
npm run auth
# Após autorizar, o arquivo .env recebe TINY_ACCESS_TOKEN e TINY_REFRESH_TOKEN automaticamente.

# Teste em modo simulado (não grava nada):
npm run sync:dry

# Quando estiver OK, rode de fato:
npm run sync
```

## 4) Automatizar via GitHub Actions (rodar 1x por dia)

1. No repositório GitHub: **Settings → Secrets and variables → Actions → New repository secret**
2. Crie 5 secrets:
   - `TINY_CLIENT_ID`
   - `TINY_CLIENT_SECRET`
   - `TINY_REFRESH_TOKEN` (pegue do `.env` após `npm run auth`)
   - `SHOPIFY_STORE_DOMAIN` (ex: `royalatacado.myshopify.com`)
   - `SHOPIFY_ADMIN_TOKEN`
3. (Opcional) Variable: `OLIST_PRICELIST_NAME` (default `ATACADO`)
4. O workflow `.github/workflows/sync-precos.yml` roda automaticamente todo dia às 04h BRT.
5. Pra rodar manualmente: aba **Actions → Sync preços de atacado → Run workflow**.

---

## Como funciona

```
┌────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Olist v3 API  │ →  │ sync-precos.js   │ →  │  Shopify Admin   │
│  Lista ATACADO │    │ - lê Olist       │    │  metafield       │
│  por SKU       │    │ - mapeia por SKU │    │  custom.preco_   │
│                │    │ - grava Shopify  │    │  atacado         │
└────────────────┘    └──────────────────┘    └──────────────────┘
                                                       │
                                                       ↓
                                              ┌──────────────────┐
                                              │  Tema Shopify    │
                                              │  rc-product-card │
                                              │  product-info    │
                                              │  → 2 preços!     │
                                              └──────────────────┘
```

**Mapeamento de SKU:** `Olist.codigo === Shopify.variant.sku`. Garanta que estão idênticos nos dois sistemas (geralmente já estão pela integração nativa).

**Fallback no tema:** Se um produto **não tiver** o metafield (ex: sincronização ainda não rodou, SKU não encontrado, produto novo), o card usa `settings.atacado_discount_percent` (configurável no admin do tema, default 15%) sobre o preço de varejo.

---

## Troubleshooting

**"Lista ATACADO não encontrada"**
- O nome da lista no Olist precisa bater com `OLIST_PRICELIST_NAME` (case-insensitive). Default: `ATACADO`. Altere no `.env` se sua lista tem outro nome.

**"SKU não encontrado no Shopify"**
- O SKU do produto no Olist (campo "Código") deve ser idêntico ao SKU da variant no Shopify.
- Verifique no Olist (aba "Dados gerais" → "Código SKU") e no Shopify Admin (produto → Variants → SKU).

**Erro 401 do Olist**
- O refresh_token expirou (após 30 dias sem uso). Rode `npm run auth` de novo.

**Erro 401/403 do Shopify**
- Token sem permissão. Vá no Admin App e adicione `write_products`. Pode ser necessário reinstalar.
