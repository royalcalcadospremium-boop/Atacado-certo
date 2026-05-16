# Apple Design Restructure — Subsistema 0: Foundation

**Status:** approved (user delegated decisions)
**Date:** 2026-05-16
**Author:** Royal Calçados Premium + Claude
**Source of truth:** `Apple Design/DESIGN.md`

---

## 1. Context

Royal Calçados Atacado (Shopify theme) is being restructured **fielmente** (faithfully) to the Apple Design system documented in `Apple Design/DESIGN.md`. The user has explicitly delegated all sub-decisions for this Foundation phase to the implementer.

The restructure is split into 7 subsystems, executed in technical order:

| # | Subsystem | Spec status |
|---|---|---|
| **0** | **Foundation (this spec)** | **active** |
| 1 | Global chrome (header, footer, announcement, menus) | pending |
| 2 | Home (`index` + home sections) | pending |
| 3 | Collections (7 collection templates + sections) | pending |
| 4 | Product (templates + recommendations) | pending |
| 5 | Cart + drawer + mini-cart | pending |
| 6 | Search + static pages + customer + 404 | pending |

Subsistemas 1+ depend on Foundation. Foundation is **purely additive** — it does not re-skin any existing page.

---

## 2. Goals (Subsistema 0)

1. Establish the canonical CSS token layer (`--ad-*` namespace) covering every color, typography, spacing, radius, and component spec from `Apple Design/DESIGN.md`.
2. Set up font loading: SF Pro via system stack first; Inter Variable self-hosted from Shopify CDN as the cross-platform fallback.
3. Ship the base component snippets that every subsequent subsystem will consume.
4. Inject the foundation into `layout/theme.liquid` so it is globally available without breaking any current page.

---

## 3. Non-Goals (Subsistema 0)

- **Do not** re-skin any existing page, section, or snippet.
- **Do not** migrate or modify the existing `snippets/css-variables.liquid` (legacy tokens stay alive for non-migrated pages).
- **Do not** remove any legacy CSS, JS, or asset.
- **Do not** change Shopify section schemas or theme settings.
- **Do not** touch the existing announcement bar, header, footer, popups, or cart — those belong to Subsistemas 1 and 5.

The contract: **after Foundation ships, every current page must render visually identical to today.** Foundation only loads new tokens and snippets into memory; nothing consumes them yet.

---

## 4. Decisions (made by implementer, per user delegation)

### 4.1 Font strategy: Inter Variable self-hosted
- **Primary stack:** `system-ui, -apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", "Segoe UI", Roboto, sans-serif`.
  - Apple devices (macOS/iOS/Safari) resolve `system-ui`/`-apple-system` to **real SF Pro** — no download, perfect Apple feel.
  - Non-Apple devices (the majority of the Royal audience) fall back to **Inter Variable**, the closest open-source equivalent (explicitly endorsed by `DESIGN.md` lines 366–371).
- **Files:** `assets/inter-var.woff2` (upright, variable on `wght 100..900`) + `assets/inter-var-italic.woff2` (italic, variable on `wght 100..900`). Inter v4 ships these as two separate variable files; there is no `slnt` axis in the official distribution.
- **Loading:** `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the upright file only; italic loads on demand when first used.
- **`font-display: swap`** to avoid invisible-text blocking LCP.
- Two `@font-face` declarations, one per file, both with `font-weight: 100 900`.

**Rationale:** the user's audience is predominantly Windows/Android. Without a fallback font, those visitors would see Segoe UI / Roboto — the Apple feel collapses. Self-hosted (over Google Fonts) avoids extra DNS hits and improves LCP, which matters for atacado mobile.

### 4.2 Token namespace: `--ad-*`
All Apple Design tokens are prefixed `--ad-` (Apple Design). This:
- Avoids collision with the existing `--text-color`, `--accent-color`, `--primary-button-*` tokens from `snippets/css-variables.liquid`.
- Makes grepping trivial during the migration (`rg --ad-` finds every consumer).
- Signals "this is the new system" unambiguously when both systems coexist.

### 4.3 Coexistence with legacy CSS
- `snippets/css-variables.liquid` stays untouched.
- New tokens live in a sibling snippet `snippets/apple-design-tokens.liquid`, rendered immediately after the legacy `css-variables` render in `theme.liquid`.
- Pages not yet migrated keep using legacy `--accent-color`, etc.
- As each subsystem is rewritten, it switches to `--ad-*`.
- Legacy variables are deleted only in a final cleanup spec, after the last subsystem ships.

### 4.4 Files shipped in Foundation
| File | Purpose |
|---|---|
| `assets/inter-var.woff2` | Inter Variable upright (download from rsms/inter v4) |
| `assets/inter-var-italic.woff2` | Inter Variable italic |
| `snippets/apple-design-tokens.liquid` | `:root { --ad-* }` for every color, typography, spacing, radius value in `DESIGN.md` + `@font-face` declarations for Inter |
| `assets/apple-foundation.css` | Utility classes: typography utilities (`.ad-hero-display`, `.ad-display-lg`, …), pill helper (`.ad-pill`), `.ad-tile`, `.ad-card`, button class chassis, the single product-shadow rule, and the system-wide `transform: scale(0.95)` active-state mixin |
| `snippets/apple-button.liquid` | Universal button component (8 variants) |
| `snippets/apple-tile.liquid` | Universal full-bleed tile component (5 variants) |
| `snippets/apple-card.liquid` | Store-utility-card component |

### 4.5 Files modified in Foundation
| File | Change |
|---|---|
| `layout/theme.liquid` | Inject `{% render 'apple-design-tokens' %}` and `<link rel="stylesheet" href="{{ 'apple-foundation.css' \| asset_url }}">` in `<head>`, immediately after the existing `{% render 'css-variables' %}` and `theme.css` link |

No section schemas, no settings, no Liquid logic in any other file changes.

---

## 5. Token catalog

All tokens are sourced directly from `Apple Design/DESIGN.md`. Names follow `--ad-<category>-<key>`.

### 5.1 Colors + elevation primitives (24 tokens — 21 colors, 1 shadow, 2 borders)
```
--ad-color-primary:           #0066cc
--ad-color-primary-focus:     #0071e3
--ad-color-primary-on-dark:   #2997ff
--ad-color-ink:               #1d1d1f
--ad-color-body:              #1d1d1f
--ad-color-body-on-dark:      #ffffff
--ad-color-body-muted:        #cccccc
--ad-color-ink-muted-80:      #333333
--ad-color-ink-muted-48:      #7a7a7a
--ad-color-divider-soft:      #f0f0f0
--ad-color-hairline:          #e0e0e0
--ad-color-canvas:            #ffffff
--ad-color-canvas-parchment:  #f5f5f7
--ad-color-surface-pearl:     #fafafc
--ad-color-surface-tile-1:    #272729
--ad-color-surface-tile-2:    #2a2a2c
--ad-color-surface-tile-3:    #252527
--ad-color-surface-black:     #000000
--ad-color-surface-chip-translucent: #d2d2d7
--ad-color-on-primary:        #ffffff
--ad-color-on-dark:           #ffffff
--ad-shadow-product:          0 3px 30px 5px rgba(0,0,0,0.22)
--ad-border-soft:             1px solid rgba(0,0,0,0.04)
--ad-border-hairline:         1px solid #e0e0e0
```

### 5.2 Typography (16 styles, each as size/weight/lh/tracking)
Each typography token from `DESIGN.md` maps to a set of four CSS custom properties: `--ad-type-<style>-size`, `--ad-type-<style>-weight`, `--ad-type-<style>-lh`, `--ad-type-<style>-track`. The 16 styles, in declaration order: `hero-display`, `display-lg`, `display-md`, `lead`, `lead-airy`, `tagline`, `body-strong`, `body`, `dense-link`, `caption`, `caption-strong`, `button-large`, `button-utility`, `fine-print`, `micro-legal`, `nav-link`.

Plus:
```
--ad-font-display: system-ui, -apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", "SF Pro Display", "Segoe UI", Roboto, sans-serif
--ad-font-text:    system-ui, -apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", "SF Pro Text", "Segoe UI", Roboto, sans-serif
```

`apple-foundation.css` includes `.ad-hero-display`, `.ad-display-lg`, … one class per style, each setting the four properties from the matching tokens.

### 5.3 Spacing (9 tokens)
```
--ad-space-xxs:     4px
--ad-space-xs:      8px
--ad-space-sm:      12px
--ad-space-md:      17px
--ad-space-lg:      24px
--ad-space-xl:      32px
--ad-space-xxl:     48px
--ad-space-section: 80px
```

### 5.4 Radii (7 tokens)
```
--ad-radius-none: 0
--ad-radius-xs:   5px
--ad-radius-sm:   8px
--ad-radius-md:   11px
--ad-radius-lg:   18px
--ad-radius-pill: 9999px
--ad-radius-full: 9999px
```

### 5.5 Breakpoints (informational, not CSS vars — used only in `apple-foundation.css` media queries)
- 480px (small phone)
- 640px (phone)
- 734px (tablet portrait)
- 833px (tablet landscape)
- 1068px (small desktop)
- 1440px (content lock)

---

## 6. Component snippets

### 6.1 `apple-button.liquid`
Universal button with a `variant` parameter. Renders an `<a>` (if `href` provided) or `<button>` (if not). Always includes the `transform: scale(0.95)` active-state via `apple-foundation.css`.

| Variant | Class | Source spec |
|---|---|---|
| `primary` | `.ad-btn .ad-btn--primary` | `button-primary` — Action Blue pill, body type, padding 11×22 |
| `secondary-pill` | `.ad-btn .ad-btn--secondary-pill` | Transparent w/ Action Blue border, full pill |
| `dark-utility` | `.ad-btn .ad-btn--dark-utility` | Ink fill, 8px radius, button-utility type |
| `pearl-capsule` | `.ad-btn .ad-btn--pearl-capsule` | Pearl Button surface, 11px radius |
| `store-hero` | `.ad-btn .ad-btn--store-hero` | Action Blue pill, button-large type (18px/300), padding 14×28 |
| `icon-circular` | `.ad-btn .ad-btn--icon-circular` | 44×44 translucent chip over photography |
| `text-link` | `.ad-btn .ad-btn--text-link` | Inline Action Blue link |
| `text-link-on-dark` | `.ad-btn .ad-btn--text-link-on-dark` | Inline Sky Link Blue (#2997ff) for dark tiles |

Usage:
```liquid
{% render 'apple-button',
   variant: 'primary',
   href: '/collections/all',
   label: 'Comprar',
   aria_label: 'Ver todos os produtos' %}
```

### 6.2 `apple-tile.liquid`
Universal full-bleed section tile. Edge-to-edge, zero radius, 80px vertical section padding. Body slot is yielded via a block parameter.

| Variant | Class | Source spec |
|---|---|---|
| `light` | `.ad-tile .ad-tile--light` | `product-tile-light` — Pure White canvas, ink text |
| `parchment` | `.ad-tile .ad-tile--parchment` | Parchment canvas, ink text |
| `dark-1` | `.ad-tile .ad-tile--dark-1` | Surface Tile 1 (#272729), white text |
| `dark-2` | `.ad-tile .ad-tile--dark-2` | Surface Tile 2 (#2a2a2c), white text |
| `dark-3` | `.ad-tile .ad-tile--dark-3` | Surface Tile 3 (#252527), white text |

Usage:
```liquid
{% capture body %}
  <h1 class="ad-display-lg">Royal Atacado</h1>
{% endcapture %}
{% render 'apple-tile', variant: 'dark-1', body: body %}
```

### 6.3 `apple-card.liquid`
Store utility card: white canvas, 1px hairline border, 18px radius, 24px padding. Slots for image, title, price, action.

Usage:
```liquid
{% render 'apple-card',
   product: product,
   image: product.featured_image,
   title: product.title,
   price: product.price,
   href: product.url %}
```

---

## 7. CSS chassis (`apple-foundation.css`)

The single CSS file implementing:

1. **Reset minimum:** none — we do not override Shopify's base CSS. The system relies on token classes applied explicitly.
2. **Token classes:** one CSS class per typography style (e.g., `.ad-hero-display { font: 600 56px/1.07 var(--ad-font-display); letter-spacing: -0.28px; }`).
3. **Layout helpers:** `.ad-stack`, `.ad-center`, `.ad-section-pad`.
4. **Pill helper:** `.ad-pill` (radius pill, padding 11×22). Used by buttons + search input + sticky bar CTAs.
5. **Tile chassis:** `.ad-tile { padding: var(--ad-space-section) 0; }` + per-variant background/color.
6. **Card chassis:** `.ad-card { border: var(--ad-border-hairline); border-radius: var(--ad-radius-lg); padding: var(--ad-space-lg); background: var(--ad-color-canvas); }`.
7. **Product shadow:** `.ad-product-shadow { box-shadow: var(--ad-shadow-product); }` — the **only** drop-shadow rule in the entire system.
8. **Active-state mixin:** `.ad-press:active { transform: scale(0.95); transition: transform 120ms ease-out; }` — applied by every button variant.
9. **Focus ring:** `.ad-focus:focus-visible { outline: 2px solid var(--ad-color-primary-focus); outline-offset: 2px; }`.
10. **Sub-nav frosted & sticky bar:** `.ad-frosted { background: rgba(245,245,247,0.8); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); }`.

No global rules touch `body`, `html`, `*`, or any Shopify-managed selector. The chassis is **opt-in via class**.

---

## 8. Theme.liquid injection

Single change in `layout/theme.liquid`, right after the existing `{% render 'css-variables' %}` on line 67:

```liquid
{% render 'css-variables' %}
{% render 'apple-design-tokens' %}     {# NEW #}

{{ content_for_header }}
{% include "setbg" %}
<link rel="stylesheet" href="{{ 'theme.css' | asset_url }}">
<link rel="stylesheet" href="{{ 'royal-custom.css' | asset_url }}">
<link rel="stylesheet" href="{{ 'apple-foundation.css' | asset_url }}">  {# NEW #}
```

Two lines. Nothing else in `theme.liquid` changes.

---

## 9. Success criteria

The Foundation ships successfully when **all** of the following are true:

1. `:root` exposes every `--ad-*` token listed in §5, queryable via DevTools `getComputedStyle(document.documentElement).getPropertyValue('--ad-color-primary')` returning `"#0066cc"`.
2. Inter Variable loads on a Windows Chrome session; SF Pro resolves natively on macOS Safari.
3. Every current page (home, a sample collection, a sample product, cart, FAQ, customer login) renders **pixel-identical** to its pre-Foundation state — `git diff` of screenshots shows zero changes.
4. LCP on the homepage (Chrome DevTools throttled to Slow 4G) is within ±200ms of pre-Foundation baseline.
5. `apple-foundation.css` is < 25 KB uncompressed.
6. `inter-var.woff2` is < 110 KB (Inter v4 variable target).
7. No console errors on any page after deployment.
8. Theme settings panel still loads in Shopify admin (sanity check that no schema broke).

---

## 10. Verification plan

For each criterion above, the implementer runs the check before marking the subsystem complete. Specifically:

| Check | Command/action |
|---|---|
| Tokens present | DevTools console on staging URL: `getComputedStyle(document.documentElement).getPropertyValue('--ad-color-primary').trim()` |
| Fonts loading | DevTools → Network → filter "Font" → confirm `inter-var.woff2` 200 on Win/Chrome; not requested on macOS/Safari |
| No regression | Visual diff of homepage + 1 collection + 1 product + cart vs. main branch screenshots |
| LCP | Lighthouse mobile run, before vs. after |
| Bundle size | `wc -c assets/apple-foundation.css`, `wc -c assets/inter-var.woff2` |
| Console | Manually open each page, confirm zero red errors |

---

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Inter file size hurts FCP | Low | Medium | Variable woff2 + `font-display: swap` + preload only the regular file |
| Two CSS systems coexist and bloat `<head>` | Medium | Low | `apple-foundation.css` is < 25 KB; legacy CSS is untouched. Final cleanup spec removes legacy after migration |
| Backdrop-filter not supported on old browsers | Medium | Low | `.ad-frosted` falls back to solid `--ad-color-canvas-parchment` (the rule sets both `background` and the filter; unsupported browsers ignore the filter) |
| Shopify admin schema break | Very low | High | No schema/setting change in this spec — only Liquid renders and a CSS link in `theme.liquid` |
| `system-ui` resolving inconsistently on older Safari | Low | Low | The fallback chain explicitly lists `-apple-system, BlinkMacSystemFont` before Inter |
| Asset upload limits (Shopify caps individual files at 20 MB) | None | None | Both `.woff2` files combined are < 250 KB |

---

## 12. Out of scope (deferred to later subsystems)

- Any visual change to header, footer, announcement bar, popups, cart-drawer, mini-cart → Subsistema 1.
- Home redesign → Subsistema 2.
- Collection grid redesign → Subsistema 3.
- Product page redesign → Subsistema 4.
- Cart page redesign → Subsistema 5.
- Search, blog, article, FAQ, team, contact, customer pages, 404, password → Subsistema 6.
- Removal of legacy `--accent-color`, `--primary-button-*` etc. → final cleanup spec after Subsistema 6.

---

## 13. Open questions

None. All sub-decisions were delegated by the user to the implementer for this Foundation phase.
