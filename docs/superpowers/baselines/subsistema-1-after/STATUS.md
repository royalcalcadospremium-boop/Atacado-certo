# Subsistema 1 — Status pós-deploy

**Data:** 2026-05-16
**URL live:** https://royalatacado.com.br/

## ✅ Funcionando em produção

- **Apple global-nav (44px black bar)** — Royal logo + 8 nav-links 12px centrados + search/account/bag icons direita. Sticky no topo.
- **Apple sub-nav-frosted (52px parchment + backdrop-blur)** — "Royal Atacado" tagline 21px + (configurável) sub-links + CTA pill primary. Sticky abaixo do global-nav.
- **Apple footer parchment** — 4 colunas dense-link 17px/2.41 (Comprar, Conta, Royal, Suporte), copyright fine-print, hairline border acima do legal row.
- **Mobile responsivo** — global-nav colapsa pra hamburger + logo centralizado + bag icon. Sub-nav esconde os sub-links (mantém só tagline).

## ⚠️ Pendência conhecida

- **Announcement bar antiga (modalities-bar azul/gradient com badges ATACADO/DROPSHIPPING/VAREJO) continua aparecendo no topo.**

**Causa:** Cache persistente do Shopify na seção `announcement-bar`. Após 4 commits/pushes (a versão Apple-pure está no GitHub há ~15+ min e o Shopify reconhece o repo), o arquivo `sections/announcement-bar.liquid` não foi re-deployado para o tema live, mesmo com tentativas de nudge (comment change) e workaround de rename (`apple-strip.liquid`).

**Resolução manual no Shopify Admin:**

1. Abrir Shopify Admin → **Loja virtual → Temas → Editar código**
2. Navegar até `Sections/announcement-bar.liquid`
3. Apertar `Save` (mesmo sem editar nada)
4. Isso força o Shopify a re-compilar a seção e pegar o conteúdo Apple-pure do GitHub

**Alternativa:** Em **Personalizar tema**, abrir a seção "Barra de anúncio" e clicar Save — também invalida o cache.

## Arquivos modificados em Subsistema 1

- `sections/announcement-bar.liquid` (Apple-pure, mas Shopify ainda serve OLD)
- `sections/apple-strip.liquid` (criado como workaround, agora órfão)
- `sections/header.liquid` (Apple-pure, **deployed**)
- `sections/footer.liquid` (Apple-pure com fallback, **deployed**)
- `layout/theme.liquid` (referência mantida em `announcement-bar`)

## Próximo passo

**Subsistema 2: Home** — `templates/index.liquid` + sections de home (featured-collection, image-with-text, mosaic, logo-list, modelos-vendidos, offers). É aqui que entram os product-tiles Apple alternando luz/escuro.
