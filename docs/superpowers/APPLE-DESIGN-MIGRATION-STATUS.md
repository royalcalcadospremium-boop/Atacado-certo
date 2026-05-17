# Apple Design Migration — Status Holístico

**Repo:** Royal Calçados Atacado (Shopify theme)
**Source of truth:** `Apple Design/DESIGN.md` (562 linhas, instalado via `npx getdesign@latest add apple`)
**URL live:** https://royalatacado.com.br/
**Iniciado:** 2026-05-16
**Última sessão:** 2026-05-17

---

## Visão geral

Restruturação completa do tema Shopify Royal Calçados, aplicando **fielmente** o design system Apple documentado em `Apple Design/DESIGN.md`. Trabalho dividido em 7 subsistemas executados em ordem técnica via skills `superpowers:brainstorming` → `writing-plans` → `subagent-driven-development` / `executing-plans`.

**Resultado tangível em produção:** chrome Apple (header preto 44px + sub-nav frosted) ATIVO, footer Apple parchment ATIVO, collection pages com cards Apple ATIVO. Home, Product e Cart sincronizando.

---

## Status por subsistema

| # | Subsistema | Spec | Plan | Code | Pushed | Deployed | Verificado |
|---|---|---|---|---|---|---|---|
| **0** | Foundation (tokens + Inter + snippets base) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ Playwright |
| **1** | Chrome (header + footer + announcement) | — | ✓ | ✓ | ✓ | 2/3 ✓ | ✓ Playwright |
| **2** | Home (`apple-home.liquid` + activation) | — | — | ✓ | ✓ | ⚠️ manual save | — |
| **3** | Collections (collection-template) | — | — | ✓ | ✓ | ✓ | ✓ Playwright |
| **4** | Product (product-template) | — | — | ✓ | ✓ | ⏳ sync pending | — |
| **5** | Cart (cart-template) | — | — | ✓ | ✓ | ⏳ sync pending | — |
| **6** | Search + Static + Customer + 404 | — | — | — | — | — | — |

---

## O que foi entregue

### Subsistema 0 — Foundation (commits c01f333..62c79e1, tag `subsistema-0-complete`)
- `assets/inter-var.woff2` (352 KB) + `inter-var-italic.woff2` (388 KB) — Inter Variable self-hosted
- `snippets/apple-design-tokens.liquid` — **105 tokens `--ad-*`** (24 cores/elevação + 64 typography + 8 spacings + 7 radii + 2 font stacks) + `@font-face` Inter
- `assets/apple-foundation.css` (11.3 KB) — utilitárias .ad-* (16 estilos typography, layout helpers, tile/card/btn chassis, product-shadow, press mixin, frosted)
- `snippets/apple-button.liquid` — 8 variantes (primary, secondary-pill, dark-utility, pearl-capsule, store-hero, icon-circular, text-link, text-link-on-dark)
- `snippets/apple-tile.liquid` — 5 variantes de superfície (light, parchment, dark-1/2/3)
- `snippets/apple-card.liquid` — store-utility-card
- `layout/theme.liquid` — 2 linhas injetadas no `<head>` (tokens snippet + foundation.css link)

**Spec:** [`docs/superpowers/specs/2026-05-16-apple-foundation-design.md`](specs/2026-05-16-apple-foundation-design.md)
**Plan:** [`docs/superpowers/plans/2026-05-16-apple-foundation-implementation.md`](plans/2026-05-16-apple-foundation-implementation.md)
**Baselines:** [`baselines/subsistema-0/`](baselines/subsistema-0/) (7 screenshots pre-deploy)

### Subsistema 1 — Chrome (commits d32eadc..0654079)
- `sections/header.liquid` (976 → 272 linhas) — **global-nav 44px black** + **sub-nav-frosted 52px parchment + backdrop-blur**. Mobile collapsa para hamburger + logo centralizado. Schema com logo, navigation_menu, brand_tagline, cta_text/url, sub_link blocks (max 5).
- `sections/footer.liquid` (562 → 185 linhas) — parchment 64px padding, grid auto-fit, headings caption-strong, links dense-link 17px/2.41 leading, hairline border + legal row em fine-print. 3 tipos de bloco (link_list, rich_text, contact). Fallback de 4 colunas (Comprar/Conta/Royal/Suporte) quando customizer empty.
- `sections/announcement-bar.liquid` (Apple-pure) — **bloqueado no cache Shopify** (ver pendência abaixo)
- `sections/apple-strip.liquid` — criado como workaround de rename (depois revertido, agora órfão)

**Plan:** [`docs/superpowers/plans/2026-05-16-apple-chrome-implementation.md`](plans/2026-05-16-apple-chrome-implementation.md)
**Evidência:** [`baselines/subsistema-1-after/`](baselines/subsistema-1-after/) (4 screenshots + STATUS.md)

### Subsistema 2 — Home (commits 8108e18..4597723)
- `sections/apple-home.liquid` (379 linhas) — section ÚNICA, block-driven, com 3 tipos:
  - `tile` (5 surface variants, 3 image alignments, hero/display size, eyebrow + headline + tagline + 2 CTAs)
  - `collection_grid` (Apple cards de uma coleção, 2-5 cols)
  - `brand_strip` (1-8 logos com links)
- Preset "Home Apple" com 4 blocos demo (hero, mais vendidos, atacado dark-1, drop parchment)
- `config/settings_data.json` editado: `content_for_index: ["apple-home-main"]` + section definition com 4 blocos pré-populados

### Subsistema 3 — Collections (commit 8ce7815)
- `sections/collection-template.liquid` (1146 → 171 linhas) — header + sort bar + Apple cards grid (4/3/2/1 cols responsive) + native pagination + empty state
- **ATIVO em produção:** todas as 8 collection.*.liquid templates herdam automaticamente

### Subsistema 4 — Product (commit e8e859e)
- `sections/product-template.liquid` (1253 → 278 linhas) — 2-col layout: gallery sticky left (parchment + product-shadow + thumbs swap) + info right (vendor + display-md title + lead price + configurator chips + qty + primary pill + secondary WhatsApp + description). Floating sticky bar revealed via IntersectionObserver. Schema.org Product/Offer preservada.

### Subsistema 5 — Cart (commit d989ed8)
- `sections/cart-template.liquid` (673 → 266 linhas) — empty state apple-button + header + 2-col (items list 1fr + sticky summary 380px parchment card radius-lg) + line items (media 120px + name body-strong + variant caption + qty + price + remove text-link) + subtotal display-md + CTA store-hero + debounced auto-update via fetch ao cart.js.

---

## Pendências conhecidas (next session)

### 🔴 Crítica: Announcement bar Shopify cache
A versão Apple-pure de `sections/announcement-bar.liquid` está no GitHub mas o Shopify ainda serve a **versão antiga** com 3 modality badges azul gradient. Após 4+ pushes e tentativas de nudge/rename, o cache persiste.

**Fix manual no Shopify Admin (30 segundos):**
1. Admin → **Loja virtual → Temas → ⋯ → Editar código**
2. Abrir `Sections/announcement-bar.liquid`
3. Apertar **Salvar** (sem editar nada — só salvar)
4. Cache é invalidado, versão GitHub é puxada

### 🟡 Home Apple precisa de Save no customizer
`settings_data.json` foi editado com `content_for_index: ["apple-home-main"]` e a seção pré-populada com 4 blocos. Mas Shopify (por design) ignora edições GitHub de `settings_data.json` quando há estado conservado do customizer.

**Fix manual:**
1. Admin → **Loja virtual → Temas → Personalizar**
2. Apertar **Salvar** (sem editar)
   - OR: Removar as seções antigas (slideshow, royal_*) e adicionar "Home Apple"

### 🟡 Product + Cart sync pending
Commits e8e859e (product) e d989ed8 (cart) foram pushed. Histórico mostra que Shopify leva 1-15 minutos para sincronizar sections. Em re-verificação posterior devem estar ativos.

### ⚪ Subsistema 6 — não iniciado
Search, static pages (FAQ, contact, team), customer pages (login, register, account), blog, article, 404, password. Volume estimado: 8-12 arquivos médios. Estratégia: dispatch parallel agents em 1-2 sessões.

---

## Métricas

- **Linhas removidas:** ~4,800 (sections antigas substituídas)
- **Linhas adicionadas:** ~2,200 (Apple-pure)
- **Redução:** ~54%
- **Commits Apple:** 19
- **Tags:** `subsistema-0-complete`
- **Bundle CSS adicional:** apple-foundation.css = 11.3 KB
- **Bundle font adicional:** Inter Variable = 740 KB total (preload só upright = 352 KB)
- **LCP impact:** dentro do orçamento (não medido pós-Subsistema 1-5, recomendado Lighthouse run)

---

## Filosofia (que orienta TODAS as decisões)

Conforme `Apple Design/DESIGN.md`:

- **UI chrome recedes so the product can speak.** Single blue accent (#0066cc), zero gradient decorativo, UMA SÓ drop-shadow (em produto), edge-to-edge tiles, alta whitespace.
- **SF Pro Display + SF Pro Text via system stack; Inter Variable fallback.** Negative letter-spacing em display sizes para o "Apple tight" headline feel.
- **Pills (`{rounded.pill}` 9999px) para todo CTA primary.** Compact 8px utility, 18px utility cards, 11px pearl button.
- **Body em 17px, line-height 1.47, weight 400.** Não 16px. Diferenciação intencional Apple.
- **Weight 500 deliberadamente ausente.** Escala 300 / 400 / 600 / 700.
- **Alternância luz/escuro como divider.** Sem borders, sem shadows, a cor de superfície é o divisor.

---

## Recomendações pro próximo passo

1. **Fazer os 2 Save manuais** (announcement-bar.liquid no editor de código + Personalizar → Save) — desbloqueia os 2 pendentes acima
2. **Verificar Product + Cart no live** após 15 min de sync — devem estar Apple
3. **Rodar Lighthouse mobile** para confirmar LCP < 2.5s
4. **Sessão futura: Subsistema 6** (search/static/customer)
5. **Subsistema 7 (cleanup)** — deletar sections órfãs: announcement-bar.liquid original, apple-strip.liquid, sections de home antigas (royal_*, slideshow), mega-menu.liquid, desktop-menu.liquid, mobile-menu.liquid, snippets/css-variables.liquid legacy tokens
