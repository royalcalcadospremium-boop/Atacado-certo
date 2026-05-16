# Apple Foundation Implementation Plan (Subsistema 0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Apple Design Foundation — a purely additive layer of CSS tokens (`--ad-*`), self-hosted Inter Variable fonts, and base component snippets (`apple-button`, `apple-tile`, `apple-card`) — into the Royal Calçados theme without changing how any existing page renders.

**Architecture:** All new tokens live in `snippets/apple-design-tokens.liquid` (rendered into `<head>` after the legacy `css-variables`). All new classes live in `assets/apple-foundation.css` (loaded after `royal-custom.css`). All new components are opt-in Liquid snippets. The legacy CSS system is untouched. Verification is visual + DevTools, not unit-test based (this is a Shopify Liquid theme, not a Node/Python project).

**Tech Stack:** Shopify Liquid, vanilla CSS (no preprocessor), Inter v4 Variable woff2 (from `rsms/inter` GitHub releases).

**Reference spec:** [`docs/superpowers/specs/2026-05-16-apple-foundation-design.md`](../specs/2026-05-16-apple-foundation-design.md)

**Source of truth for tokens:** [`Apple Design/DESIGN.md`](../../../Apple Design/DESIGN.md)

---

## Verification approach (read this before starting)

There is no test runner in this theme. "Tests" in this plan mean three things:

1. **Static checks:** `grep` / `wc -c` / `git diff` confirming a file contains the expected content and is the expected size.
2. **DevTools spot-checks:** loading the staging URL in Chrome and reading values via the console. The agent cannot do this directly — these steps are queued for the human (Royal) to run, and the agent reports them as "manual verification required".
3. **Visual diff:** if Royal grants Playwright access, the agent can navigate the deployed Shopify theme via `mcp__plugin_playwright_playwright__browser_navigate` and screenshot key pages before/after.

If a step says "manual: …", that step is a check Royal runs in the browser. The agent marks it `- [ ]` and reports the check in the task summary so Royal can do it.

---

## Task 1: Download Inter Variable fonts

**Files:**
- Create: `assets/inter-var.woff2`
- Create: `assets/inter-var-italic.woff2`

The Inter v4 release ships these two files inside the official release zip (`Inter-4.1.zip → web/InterVariable.woff2` and `web/InterVariable-Italic.woff2`).

- [ ] **Step 1.1: Download Inter v4.1 release zip**

```bash
curl -L -o /tmp/inter-4.1.zip https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
```

Expected: file `/tmp/inter-4.1.zip`, size approximately 50–60 MB.

- [ ] **Step 1.2: Extract the two Variable woff2 files**

```bash
unzip -j /tmp/inter-4.1.zip "Inter Web/InterVariable.woff2" -d assets/
mv "assets/InterVariable.woff2" "assets/inter-var.woff2"
unzip -j /tmp/inter-4.1.zip "Inter Web/InterVariable-Italic.woff2" -d assets/
mv "assets/InterVariable-Italic.woff2" "assets/inter-var-italic.woff2"
```

If the path `Inter Web/` does not exist in the zip, run `unzip -l /tmp/inter-4.1.zip | grep -i variable.woff2` to find the actual path and adjust. On Windows in bash, the space may need escaping; if it fails, fall back to `unzip /tmp/inter-4.1.zip -d /tmp/inter-extract && cp /tmp/inter-extract/Inter*/InterVariable*.woff2 assets/` then rename.

- [ ] **Step 1.3: Verify sizes**

```bash
wc -c assets/inter-var.woff2 assets/inter-var-italic.woff2
```

Expected: each file between 250 KB and 350 KB. If either is < 100 KB, the file is corrupt or empty — re-download.

- [ ] **Step 1.4: Clean up temp zip**

```bash
rm /tmp/inter-4.1.zip
```

- [ ] **Step 1.5: Commit**

```bash
git add assets/inter-var.woff2 assets/inter-var-italic.woff2
git commit -m "$(cat <<'EOF'
feat(foundation): adicionar Inter Variable self-hosted (Subsistema 0)

Inter v4.1 Variable em duas variantes (upright + italic), servidos do
CDN do Shopify para evitar dependência do Google Fonts e melhorar LCP.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `snippets/apple-design-tokens.liquid`

**Files:**
- Create: `snippets/apple-design-tokens.liquid`

This snippet declares every `--ad-*` token and the two `@font-face` rules for Inter. It is rendered into `<head>` so the tokens are inherited everywhere.

- [ ] **Step 2.1: Write the snippet**

Create `snippets/apple-design-tokens.liquid` with this exact content:

```liquid
{%- comment -%}
  Apple Design tokens — single source of truth for the --ad-* namespace.
  Token values are taken verbatim from Apple Design/DESIGN.md.
  This snippet is additive and does NOT override legacy theme tokens.
{%- endcomment -%}

<link rel="preload" href="{{ 'inter-var.woff2' | asset_url }}" as="font" type="font/woff2" crossorigin>

<style>
  @font-face {
    font-family: "Inter Variable";
    src: url("{{ 'inter-var.woff2' | asset_url }}") format("woff2-variations"),
         url("{{ 'inter-var.woff2' | asset_url }}") format("woff2");
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Inter Variable";
    src: url("{{ 'inter-var-italic.woff2' | asset_url }}") format("woff2-variations"),
         url("{{ 'inter-var-italic.woff2' | asset_url }}") format("woff2");
    font-weight: 100 900;
    font-style: italic;
    font-display: swap;
  }

  :root {
    /* ── Colors ─────────────────────────────────────── */
    --ad-color-primary:               #0066cc;
    --ad-color-primary-focus:         #0071e3;
    --ad-color-primary-on-dark:       #2997ff;
    --ad-color-ink:                   #1d1d1f;
    --ad-color-body:                  #1d1d1f;
    --ad-color-body-on-dark:          #ffffff;
    --ad-color-body-muted:            #cccccc;
    --ad-color-ink-muted-80:          #333333;
    --ad-color-ink-muted-48:          #7a7a7a;
    --ad-color-divider-soft:          #f0f0f0;
    --ad-color-hairline:              #e0e0e0;
    --ad-color-canvas:                #ffffff;
    --ad-color-canvas-parchment:      #f5f5f7;
    --ad-color-surface-pearl:         #fafafc;
    --ad-color-surface-tile-1:        #272729;
    --ad-color-surface-tile-2:        #2a2a2c;
    --ad-color-surface-tile-3:        #252527;
    --ad-color-surface-black:         #000000;
    --ad-color-surface-chip-translucent: rgba(210, 210, 215, 0.64);
    --ad-color-on-primary:            #ffffff;
    --ad-color-on-dark:               #ffffff;

    /* ── Elevation primitives ──────────────────────── */
    --ad-shadow-product:              0 3px 30px 5px rgba(0, 0, 0, 0.22);
    --ad-border-soft:                 1px solid rgba(0, 0, 0, 0.04);
    --ad-border-hairline:             1px solid #e0e0e0;

    /* ── Spacing ───────────────────────────────────── */
    --ad-space-xxs:                   4px;
    --ad-space-xs:                    8px;
    --ad-space-sm:                    12px;
    --ad-space-md:                    17px;
    --ad-space-lg:                    24px;
    --ad-space-xl:                    32px;
    --ad-space-xxl:                   48px;
    --ad-space-section:               80px;

    /* ── Radii ─────────────────────────────────────── */
    --ad-radius-none:                 0;
    --ad-radius-xs:                   5px;
    --ad-radius-sm:                   8px;
    --ad-radius-md:                   11px;
    --ad-radius-lg:                   18px;
    --ad-radius-pill:                 9999px;
    --ad-radius-full:                 9999px;

    /* ── Font stacks ───────────────────────────────── */
    --ad-font-display: system-ui, -apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    --ad-font-text:    system-ui, -apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", "SF Pro Text", "Segoe UI", Roboto, sans-serif;

    /* ── Typography: hero-display ──────────────────── */
    --ad-type-hero-display-size:      56px;
    --ad-type-hero-display-weight:    600;
    --ad-type-hero-display-lh:        1.07;
    --ad-type-hero-display-track:     -0.28px;

    /* ── Typography: display-lg ────────────────────── */
    --ad-type-display-lg-size:        40px;
    --ad-type-display-lg-weight:      600;
    --ad-type-display-lg-lh:          1.10;
    --ad-type-display-lg-track:       0;

    /* ── Typography: display-md ────────────────────── */
    --ad-type-display-md-size:        34px;
    --ad-type-display-md-weight:      600;
    --ad-type-display-md-lh:          1.47;
    --ad-type-display-md-track:       -0.374px;

    /* ── Typography: lead ──────────────────────────── */
    --ad-type-lead-size:              28px;
    --ad-type-lead-weight:            400;
    --ad-type-lead-lh:                1.14;
    --ad-type-lead-track:             0.196px;

    /* ── Typography: lead-airy ─────────────────────── */
    --ad-type-lead-airy-size:         24px;
    --ad-type-lead-airy-weight:       300;
    --ad-type-lead-airy-lh:           1.5;
    --ad-type-lead-airy-track:        0;

    /* ── Typography: tagline ───────────────────────── */
    --ad-type-tagline-size:           21px;
    --ad-type-tagline-weight:         600;
    --ad-type-tagline-lh:             1.19;
    --ad-type-tagline-track:          0.231px;

    /* ── Typography: body-strong ───────────────────── */
    --ad-type-body-strong-size:       17px;
    --ad-type-body-strong-weight:     600;
    --ad-type-body-strong-lh:         1.24;
    --ad-type-body-strong-track:      -0.374px;

    /* ── Typography: body ──────────────────────────── */
    --ad-type-body-size:              17px;
    --ad-type-body-weight:            400;
    --ad-type-body-lh:                1.47;
    --ad-type-body-track:             -0.374px;

    /* ── Typography: dense-link ────────────────────── */
    --ad-type-dense-link-size:        17px;
    --ad-type-dense-link-weight:      400;
    --ad-type-dense-link-lh:          2.41;
    --ad-type-dense-link-track:       0;

    /* ── Typography: caption ───────────────────────── */
    --ad-type-caption-size:           14px;
    --ad-type-caption-weight:         400;
    --ad-type-caption-lh:             1.43;
    --ad-type-caption-track:          -0.224px;

    /* ── Typography: caption-strong ────────────────── */
    --ad-type-caption-strong-size:    14px;
    --ad-type-caption-strong-weight:  600;
    --ad-type-caption-strong-lh:      1.29;
    --ad-type-caption-strong-track:   -0.224px;

    /* ── Typography: button-large ──────────────────── */
    --ad-type-button-large-size:      18px;
    --ad-type-button-large-weight:    300;
    --ad-type-button-large-lh:        1.0;
    --ad-type-button-large-track:     0;

    /* ── Typography: button-utility ────────────────── */
    --ad-type-button-utility-size:    14px;
    --ad-type-button-utility-weight:  400;
    --ad-type-button-utility-lh:      1.29;
    --ad-type-button-utility-track:   -0.224px;

    /* ── Typography: fine-print ────────────────────── */
    --ad-type-fine-print-size:        12px;
    --ad-type-fine-print-weight:      400;
    --ad-type-fine-print-lh:          1.0;
    --ad-type-fine-print-track:       -0.12px;

    /* ── Typography: micro-legal ───────────────────── */
    --ad-type-micro-legal-size:       10px;
    --ad-type-micro-legal-weight:     400;
    --ad-type-micro-legal-lh:         1.3;
    --ad-type-micro-legal-track:      -0.08px;

    /* ── Typography: nav-link ──────────────────────── */
    --ad-type-nav-link-size:          12px;
    --ad-type-nav-link-weight:        400;
    --ad-type-nav-link-lh:            1.0;
    --ad-type-nav-link-track:         -0.12px;
  }
</style>
```

- [ ] **Step 2.2: Verify the file**

```bash
wc -l snippets/apple-design-tokens.liquid
grep -c "^    --ad-" snippets/apple-design-tokens.liquid
```

Expected: roughly 165 lines; at least 87 token lines starting with `    --ad-`.

- [ ] **Step 2.3: Commit**

```bash
git add snippets/apple-design-tokens.liquid
git commit -m "$(cat <<'EOF'
feat(foundation): adicionar snippet apple-design-tokens (Subsistema 0)

Declara todo o namespace --ad-* (24 tokens de cor/elevação, 16 estilos
tipográficos x 4 propriedades, 8 spacings, 7 radii, 2 font stacks) +
@font-face para Inter Variable. Valores extraídos verbatim de
Apple Design/DESIGN.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `assets/apple-foundation.css`

**Files:**
- Create: `assets/apple-foundation.css`

The CSS chassis: typography utility classes, layout helpers, button chassis, tile chassis, card chassis, product-shadow, press-active mixin, focus ring, frosted background.

- [ ] **Step 3.1: Write the CSS**

Create `assets/apple-foundation.css` with this exact content:

```css
/*
 * apple-foundation.css — Subsistema 0
 * Apple Design chassis: opt-in utility classes consumed by Liquid snippets.
 * All rules are scoped to the .ad-* namespace. No global selectors.
 */

/* ── Typography utilities ────────────────────────────────────────── */
.ad-hero-display    { font-family: var(--ad-font-display); font-size: var(--ad-type-hero-display-size);    font-weight: var(--ad-type-hero-display-weight);    line-height: var(--ad-type-hero-display-lh);    letter-spacing: var(--ad-type-hero-display-track); }
.ad-display-lg      { font-family: var(--ad-font-display); font-size: var(--ad-type-display-lg-size);      font-weight: var(--ad-type-display-lg-weight);      line-height: var(--ad-type-display-lg-lh);      letter-spacing: var(--ad-type-display-lg-track); }
.ad-display-md      { font-family: var(--ad-font-text);    font-size: var(--ad-type-display-md-size);      font-weight: var(--ad-type-display-md-weight);      line-height: var(--ad-type-display-md-lh);      letter-spacing: var(--ad-type-display-md-track); }
.ad-lead            { font-family: var(--ad-font-display); font-size: var(--ad-type-lead-size);            font-weight: var(--ad-type-lead-weight);            line-height: var(--ad-type-lead-lh);            letter-spacing: var(--ad-type-lead-track); }
.ad-lead-airy       { font-family: var(--ad-font-text);    font-size: var(--ad-type-lead-airy-size);       font-weight: var(--ad-type-lead-airy-weight);       line-height: var(--ad-type-lead-airy-lh);       letter-spacing: var(--ad-type-lead-airy-track); }
.ad-tagline         { font-family: var(--ad-font-display); font-size: var(--ad-type-tagline-size);         font-weight: var(--ad-type-tagline-weight);         line-height: var(--ad-type-tagline-lh);         letter-spacing: var(--ad-type-tagline-track); }
.ad-body-strong     { font-family: var(--ad-font-text);    font-size: var(--ad-type-body-strong-size);     font-weight: var(--ad-type-body-strong-weight);     line-height: var(--ad-type-body-strong-lh);     letter-spacing: var(--ad-type-body-strong-track); }
.ad-body            { font-family: var(--ad-font-text);    font-size: var(--ad-type-body-size);            font-weight: var(--ad-type-body-weight);            line-height: var(--ad-type-body-lh);            letter-spacing: var(--ad-type-body-track); }
.ad-dense-link      { font-family: var(--ad-font-text);    font-size: var(--ad-type-dense-link-size);      font-weight: var(--ad-type-dense-link-weight);      line-height: var(--ad-type-dense-link-lh);      letter-spacing: var(--ad-type-dense-link-track); }
.ad-caption         { font-family: var(--ad-font-text);    font-size: var(--ad-type-caption-size);         font-weight: var(--ad-type-caption-weight);         line-height: var(--ad-type-caption-lh);         letter-spacing: var(--ad-type-caption-track); }
.ad-caption-strong  { font-family: var(--ad-font-text);    font-size: var(--ad-type-caption-strong-size);  font-weight: var(--ad-type-caption-strong-weight);  line-height: var(--ad-type-caption-strong-lh);  letter-spacing: var(--ad-type-caption-strong-track); }
.ad-button-large    { font-family: var(--ad-font-text);    font-size: var(--ad-type-button-large-size);    font-weight: var(--ad-type-button-large-weight);    line-height: var(--ad-type-button-large-lh);    letter-spacing: var(--ad-type-button-large-track); }
.ad-button-utility  { font-family: var(--ad-font-text);    font-size: var(--ad-type-button-utility-size);  font-weight: var(--ad-type-button-utility-weight);  line-height: var(--ad-type-button-utility-lh);  letter-spacing: var(--ad-type-button-utility-track); }
.ad-fine-print      { font-family: var(--ad-font-text);    font-size: var(--ad-type-fine-print-size);      font-weight: var(--ad-type-fine-print-weight);      line-height: var(--ad-type-fine-print-lh);      letter-spacing: var(--ad-type-fine-print-track); }
.ad-micro-legal     { font-family: var(--ad-font-text);    font-size: var(--ad-type-micro-legal-size);     font-weight: var(--ad-type-micro-legal-weight);     line-height: var(--ad-type-micro-legal-lh);     letter-spacing: var(--ad-type-micro-legal-track); }
.ad-nav-link        { font-family: var(--ad-font-text);    font-size: var(--ad-type-nav-link-size);        font-weight: var(--ad-type-nav-link-weight);        line-height: var(--ad-type-nav-link-lh);        letter-spacing: var(--ad-type-nav-link-track); }

/* ── Layout helpers ──────────────────────────────────────────────── */
.ad-stack { display: flex; flex-direction: column; }
.ad-stack > * + * { margin-top: var(--ad-space-md); }
.ad-stack--xs > * + * { margin-top: var(--ad-space-xs); }
.ad-stack--sm > * + * { margin-top: var(--ad-space-sm); }
.ad-stack--lg > * + * { margin-top: var(--ad-space-lg); }
.ad-stack--xl > * + * { margin-top: var(--ad-space-xl); }

.ad-center { display: flex; flex-direction: column; align-items: center; text-align: center; }

.ad-section-pad { padding-top: var(--ad-space-section); padding-bottom: var(--ad-space-section); }

/* ── Product shadow (the ONLY drop-shadow in the system) ────────── */
.ad-product-shadow { box-shadow: var(--ad-shadow-product); }

/* ── Press / active state mixin (system-wide) ───────────────────── */
.ad-press { transition: transform 120ms ease-out; }
.ad-press:active { transform: scale(0.95); }

/* ── Focus ring ──────────────────────────────────────────────────── */
.ad-focus:focus-visible { outline: 2px solid var(--ad-color-primary-focus); outline-offset: 2px; }

/* ── Frosted background (sub-nav, sticky bar) ───────────────────── */
.ad-frosted {
  background-color: rgba(245, 245, 247, 0.8);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
          backdrop-filter: saturate(180%) blur(20px);
}

/* ── Pill helper ─────────────────────────────────────────────────── */
.ad-pill { border-radius: var(--ad-radius-pill); }

/* ── Button chassis (apple-button.liquid renders these) ─────────── */
.ad-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  cursor: pointer;
  text-decoration: none;
  background: none;
  font-family: var(--ad-font-text);
  transition: transform 120ms ease-out, background-color 120ms ease-out, color 120ms ease-out;
}
.ad-btn:active { transform: scale(0.95); }
.ad-btn:focus-visible { outline: 2px solid var(--ad-color-primary-focus); outline-offset: 2px; }
.ad-btn[disabled],
.ad-btn[aria-disabled="true"] { color: var(--ad-color-ink-muted-48); cursor: not-allowed; }

.ad-btn--primary {
  background-color: var(--ad-color-primary);
  color: var(--ad-color-on-primary);
  font-size: var(--ad-type-body-size); font-weight: var(--ad-type-body-weight); line-height: 1; letter-spacing: var(--ad-type-body-track);
  border-radius: var(--ad-radius-pill);
  padding: 11px 22px;
}

.ad-btn--secondary-pill {
  background-color: transparent;
  color: var(--ad-color-primary);
  border: 1px solid var(--ad-color-primary);
  font-size: var(--ad-type-body-size); font-weight: var(--ad-type-body-weight); line-height: 1; letter-spacing: var(--ad-type-body-track);
  border-radius: var(--ad-radius-pill);
  padding: 10px 21px; /* -1px to compensate the 1px border */
}

.ad-btn--dark-utility {
  background-color: var(--ad-color-ink);
  color: var(--ad-color-on-dark);
  font-size: var(--ad-type-button-utility-size); font-weight: var(--ad-type-button-utility-weight); line-height: var(--ad-type-button-utility-lh); letter-spacing: var(--ad-type-button-utility-track);
  border-radius: var(--ad-radius-sm);
  padding: 8px 15px;
}

.ad-btn--pearl-capsule {
  background-color: var(--ad-color-surface-pearl);
  color: var(--ad-color-ink-muted-80);
  border: 3px solid var(--ad-color-divider-soft);
  font-size: var(--ad-type-caption-size); font-weight: var(--ad-type-caption-weight); line-height: 1; letter-spacing: var(--ad-type-caption-track);
  border-radius: var(--ad-radius-md);
  padding: 5px 11px; /* -3px to compensate the 3px border */
}

.ad-btn--store-hero {
  background-color: var(--ad-color-primary);
  color: var(--ad-color-on-primary);
  font-size: var(--ad-type-button-large-size); font-weight: var(--ad-type-button-large-weight); line-height: var(--ad-type-button-large-lh); letter-spacing: var(--ad-type-button-large-track);
  border-radius: var(--ad-radius-pill);
  padding: 14px 28px;
}

.ad-btn--icon-circular {
  background-color: var(--ad-color-surface-chip-translucent);
  color: var(--ad-color-ink);
  border-radius: var(--ad-radius-full);
  width: 44px; height: 44px;
  padding: 0;
}

.ad-btn--text-link {
  background: none;
  color: var(--ad-color-primary);
  font-size: var(--ad-type-body-size); font-weight: var(--ad-type-body-weight); line-height: var(--ad-type-body-lh); letter-spacing: var(--ad-type-body-track);
  padding: 0;
}
.ad-btn--text-link:hover { text-decoration: underline; }

.ad-btn--text-link-on-dark {
  background: none;
  color: var(--ad-color-primary-on-dark);
  font-size: var(--ad-type-body-size); font-weight: var(--ad-type-body-weight); line-height: var(--ad-type-body-lh); letter-spacing: var(--ad-type-body-track);
  padding: 0;
}
.ad-btn--text-link-on-dark:hover { text-decoration: underline; }

/* ── Tile chassis (apple-tile.liquid renders these) ─────────────── */
.ad-tile {
  width: 100%;
  padding: var(--ad-space-section) 24px;
  border-radius: var(--ad-radius-none);
  text-align: center;
}
.ad-tile--light      { background-color: var(--ad-color-canvas);           color: var(--ad-color-ink); }
.ad-tile--parchment  { background-color: var(--ad-color-canvas-parchment); color: var(--ad-color-ink); }
.ad-tile--dark-1     { background-color: var(--ad-color-surface-tile-1);   color: var(--ad-color-on-dark); }
.ad-tile--dark-2     { background-color: var(--ad-color-surface-tile-2);   color: var(--ad-color-on-dark); }
.ad-tile--dark-3     { background-color: var(--ad-color-surface-tile-3);   color: var(--ad-color-on-dark); }

/* ── Card chassis (apple-card.liquid renders these) ─────────────── */
.ad-card {
  background-color: var(--ad-color-canvas);
  border: var(--ad-border-hairline);
  border-radius: var(--ad-radius-lg);
  padding: var(--ad-space-lg);
  color: var(--ad-color-ink);
}
.ad-card__media { border-radius: var(--ad-radius-sm); overflow: hidden; }
.ad-card__media img { display: block; width: 100%; height: auto; }
.ad-card__title { margin: var(--ad-space-md) 0 var(--ad-space-xxs); }
.ad-card__price { margin: 0 0 var(--ad-space-sm); }

/* ── Responsive: tile padding tightens on small screens ─────────── */
@media (max-width: 734px) {
  .ad-tile { padding: 48px 20px; }
}
@media (max-width: 419px) {
  .ad-hero-display { font-size: 28px; }
  .ad-display-lg   { font-size: 34px; }
}
```

- [ ] **Step 3.2: Verify file size**

```bash
wc -c assets/apple-foundation.css
```

Expected: between 5,000 and 25,000 bytes (the spec caps it at 25 KB).

- [ ] **Step 3.3: Commit**

```bash
git add assets/apple-foundation.css
git commit -m "$(cat <<'EOF'
feat(foundation): adicionar apple-foundation.css (Subsistema 0)

CSS chassis com utilitárias de tipografia (16 estilos), layout helpers,
buttons (9 variantes), tiles (5 variantes), cards, product-shadow,
press-active mixin, focus ring e frosted background. Tudo escopado ao
namespace .ad-* (opt-in, sem seletores globais).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `snippets/apple-button.liquid`

**Files:**
- Create: `snippets/apple-button.liquid`

Universal button snippet with `variant` parameter. Renders `<a>` if `href` given, else `<button>`.

- [ ] **Step 4.1: Write the snippet**

Create `snippets/apple-button.liquid` with this exact content:

```liquid
{%- comment -%}
  apple-button — Apple Design universal button.
  Required:
    variant: one of primary | secondary-pill | dark-utility | pearl-capsule
             | store-hero | icon-circular | text-link | text-link-on-dark
    label:   visible text (omit for icon-circular if aria_label provided)
  Optional:
    href:        if present, renders as <a>; else as <button type="button">
    type:        button type (default "button")
    aria_label:  required when label is empty (icon-circular)
    class:       extra classes
    id:          element id
    data:        a hash of data-* attributes, e.g. data: { product_id: 123 }
    target:      <a target>; ignored on <button>
    rel:         <a rel>; ignored on <button>
    icon:        inline SVG markup placed before the label
{%- endcomment -%}

{%- assign _variant = variant | default: 'primary' -%}
{%- assign _class = 'ad-btn ad-btn--' | append: _variant -%}
{%- if class -%}{%- assign _class = _class | append: ' ' | append: class -%}{%- endif -%}

{%- capture _attrs -%}
  {%- if id %} id="{{ id }}"{%- endif -%}
  {%- if aria_label %} aria-label="{{ aria_label | escape }}"{%- endif -%}
  {%- if data -%}
    {%- for kv in data -%} data-{{ kv[0] | replace: '_', '-' }}="{{ kv[1] | escape }}"{%- endfor -%}
  {%- endif -%}
{%- endcapture -%}

{%- if href -%}
  <a class="{{ _class }}" href="{{ href }}"{% if target %} target="{{ target }}"{% endif %}{% if rel %} rel="{{ rel }}"{% endif %}{{ _attrs }}>
    {%- if icon %}<span class="ad-btn__icon" aria-hidden="true">{{ icon }}</span>{%- endif -%}
    {%- if label %}{{ label }}{%- endif -%}
  </a>
{%- else -%}
  <button class="{{ _class }}" type="{{ type | default: 'button' }}"{{ _attrs }}>
    {%- if icon %}<span class="ad-btn__icon" aria-hidden="true">{{ icon }}</span>{%- endif -%}
    {%- if label %}{{ label }}{%- endif -%}
  </button>
{%- endif -%}
```

- [ ] **Step 4.2: Verify the snippet**

```bash
wc -l snippets/apple-button.liquid
grep -c "ad-btn--" snippets/apple-button.liquid
```

Expected: ~40 lines; at least 1 occurrence of `ad-btn--` (the dynamic class assignment).

- [ ] **Step 4.3: Commit**

```bash
git add snippets/apple-button.liquid
git commit -m "$(cat <<'EOF'
feat(foundation): adicionar snippet apple-button (Subsistema 0)

Componente universal de botão com 9 variantes (primary, secondary-pill,
dark-utility, pearl-capsule, store-hero, icon-circular, text-link,
text-link-on-dark). Renderiza <a> se href fornecido, senão <button>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create `snippets/apple-tile.liquid`

**Files:**
- Create: `snippets/apple-tile.liquid`

Full-bleed tile section with 5 surface variants. Body slot received as parameter.

- [ ] **Step 5.1: Write the snippet**

Create `snippets/apple-tile.liquid` with this exact content:

```liquid
{%- comment -%}
  apple-tile — Apple Design full-bleed section tile.
  Required:
    variant: one of light | parchment | dark-1 | dark-2 | dark-3
    body:    Liquid string (pre-rendered HTML) to place inside the tile
  Optional:
    tag:     wrapper element (default "section")
    id:      element id
    class:   extra classes
    aria_label: aria-label for the section
{%- endcomment -%}

{%- assign _variant = variant | default: 'light' -%}
{%- assign _tag = tag | default: 'section' -%}
{%- assign _class = 'ad-tile ad-tile--' | append: _variant -%}
{%- if class -%}{%- assign _class = _class | append: ' ' | append: class -%}{%- endif -%}

<{{ _tag }}
  class="{{ _class }}"
  {%- if id %} id="{{ id }}"{%- endif -%}
  {%- if aria_label %} aria-label="{{ aria_label | escape }}"{%- endif -%}
>
  {{ body }}
</{{ _tag }}>
```

- [ ] **Step 5.2: Verify the snippet**

```bash
wc -l snippets/apple-tile.liquid
```

Expected: ~20 lines.

- [ ] **Step 5.3: Commit**

```bash
git add snippets/apple-tile.liquid
git commit -m "$(cat <<'EOF'
feat(foundation): adicionar snippet apple-tile (Subsistema 0)

Componente universal de tile full-bleed com 5 variantes de superfície
(light, parchment, dark-1, dark-2, dark-3). Body recebido como
parâmetro Liquid (HTML pré-renderizado).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create `snippets/apple-card.liquid`

**Files:**
- Create: `snippets/apple-card.liquid`

Store-utility-card component: white canvas, 1px hairline, 18px radius, 24px padding. Slots for image, title, price, action.

- [ ] **Step 6.1: Write the snippet**

Create `snippets/apple-card.liquid` with this exact content:

```liquid
{%- comment -%}
  apple-card — Apple Design store utility card.
  Optional:
    image:      Shopify image object OR a URL string
    image_alt:  alt text (defaults to title)
    title:      string
    subtitle:   string (shown below title in caption type)
    price:      already-formatted price string (use {{ money }} upstream)
    price_was:  optional crossed-out original price
    href:       if present, the whole card wraps in an <a>
    action_label: text for the inline text-link CTA (default: "Comprar")
    aria_label: aria-label for the wrapping link (defaults to title)
    class:      extra classes
{%- endcomment -%}

{%- assign _class = 'ad-card' -%}
{%- if class -%}{%- assign _class = _class | append: ' ' | append: class -%}{%- endif -%}

{%- capture _inner -%}
  {%- if image -%}
    {%- if image.src -%}
      <div class="ad-card__media">
        <img src="{{ image | image_url: width: 600 }}" alt="{{ image_alt | default: title | escape }}" loading="lazy" width="{{ image.width }}" height="{{ image.height }}">
      </div>
    {%- else -%}
      <div class="ad-card__media">
        <img src="{{ image }}" alt="{{ image_alt | default: title | escape }}" loading="lazy">
      </div>
    {%- endif -%}
  {%- endif -%}

  {%- if title -%}
    <h3 class="ad-card__title ad-body-strong">{{ title }}</h3>
  {%- endif -%}
  {%- if subtitle -%}
    <p class="ad-card__subtitle ad-caption">{{ subtitle }}</p>
  {%- endif -%}
  {%- if price -%}
    <p class="ad-card__price ad-body">
      {{ price }}
      {%- if price_was -%}<span class="ad-card__price-was ad-caption"> <s>{{ price_was }}</s></span>{%- endif -%}
    </p>
  {%- endif -%}

  {%- if action_label or href -%}
    <span class="ad-card__action ad-btn ad-btn--text-link">{{ action_label | default: 'Comprar' }}</span>
  {%- endif -%}
{%- endcapture -%}

{%- if href -%}
  <a class="{{ _class }}" href="{{ href }}" aria-label="{{ aria_label | default: title | escape }}">
    {{ _inner }}
  </a>
{%- else -%}
  <div class="{{ _class }}">
    {{ _inner }}
  </div>
{%- endif -%}
```

- [ ] **Step 6.2: Verify the snippet**

```bash
wc -l snippets/apple-card.liquid
grep -c "ad-card__" snippets/apple-card.liquid
```

Expected: ~55 lines; at least 6 occurrences of `ad-card__`.

- [ ] **Step 6.3: Commit**

```bash
git add snippets/apple-card.liquid
git commit -m "$(cat <<'EOF'
feat(foundation): adicionar snippet apple-card (Subsistema 0)

Componente store-utility-card: canvas branco, hairline 1px, radius 18px,
padding 24px. Slots para image, title, subtitle, price (com price_was
opcional), action_label.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Inject Foundation into `layout/theme.liquid`

**Files:**
- Modify: `layout/theme.liquid` (2 insertions in `<head>`)

The Foundation snippet and CSS load after the existing `css-variables` and `theme.css` so that legacy rules remain authoritative on non-migrated pages, and `--ad-*` is purely additive.

- [ ] **Step 7.1: Read current state of theme.liquid around the injection points**

```bash
sed -n '65,75p' layout/theme.liquid
```

Expected: shows lines 65–75 of the head, including line 67 `    {% render 'css-variables' %}` and line 72 `    <link rel="stylesheet" href="{{ 'royal-custom.css' | asset_url }}">`.

- [ ] **Step 7.2: Apply the two insertions**

Use the Edit tool to make two precise edits:

**Edit A** — insert tokens snippet right after `{% render 'css-variables' %}`:
```
OLD:
    {% render 'social-meta-tags' %}
    {% render 'css-variables' %}

    {{ content_for_header }}

NEW:
    {% render 'social-meta-tags' %}
    {% render 'css-variables' %}
    {% render 'apple-design-tokens' %}

    {{ content_for_header }}
```

**Edit B** — insert foundation CSS right after `royal-custom.css`:
```
OLD:
    <link rel="stylesheet" href="{{ 'theme.css' | asset_url }}">
    <link rel="stylesheet" href="{{ 'royal-custom.css' | asset_url }}">

    {% render 'microdata-schema' %}

NEW:
    <link rel="stylesheet" href="{{ 'theme.css' | asset_url }}">
    <link rel="stylesheet" href="{{ 'royal-custom.css' | asset_url }}">
    <link rel="stylesheet" href="{{ 'apple-foundation.css' | asset_url }}">

    {% render 'microdata-schema' %}
```

- [ ] **Step 7.3: Verify both insertions landed correctly**

```bash
grep -n "apple-design-tokens" layout/theme.liquid
grep -n "apple-foundation.css" layout/theme.liquid
```

Expected: each grep returns exactly one match line, with the apple-design-tokens line preceding the apple-foundation.css line.

- [ ] **Step 7.4: Verify nothing else changed**

```bash
git diff layout/theme.liquid | grep -E "^[+-]" | grep -v "^[+-]{3}"
```

Expected: exactly two `+` lines (the two insertions) and zero `-` lines.

- [ ] **Step 7.5: Commit**

```bash
git add layout/theme.liquid
git commit -m "$(cat <<'EOF'
feat(foundation): injetar apple tokens + apple-foundation.css em theme.liquid

Duas linhas adicionadas no <head>:
- {% render 'apple-design-tokens' %} após {% render 'css-variables' %}
- <link rel="stylesheet" ... apple-foundation.css> após royal-custom.css

Carregamento posterior garante que regras legadas continuem
autoritativas em páginas não migradas (Foundation é puramente aditivo).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verification pass

**Files:** none modified. This task is a smoke-test gate before declaring Subsistema 0 complete.

- [ ] **Step 8.1: Static check — all foundation files present**

```bash
ls -la assets/inter-var.woff2 assets/inter-var-italic.woff2 assets/apple-foundation.css snippets/apple-design-tokens.liquid snippets/apple-button.liquid snippets/apple-tile.liquid snippets/apple-card.liquid
```

Expected: all seven files listed with non-zero sizes.

- [ ] **Step 8.2: Token count sanity check**

```bash
grep -oE -- "--ad-[a-z0-9-]+" snippets/apple-design-tokens.liquid | sort -u | wc -l
```

Expected: at least 87 unique tokens (24 colors/elevation + 16 typography × 4 props + 8 spacings + 7 radii + 2 font stacks = 105 total, but `sort -u` may collapse some declarations — the floor is 87).

- [ ] **Step 8.3: No accidental modifications elsewhere**

```bash
git log --since="1 hour ago" --name-only --pretty=format: | sort -u | grep -v "^$"
```

Expected: only files under `assets/`, `snippets/`, `layout/theme.liquid`, `docs/superpowers/` appear.

- [ ] **Step 8.4: Manual (Royal) — DevTools token check**

Open the Shopify staging URL in Chrome. Open DevTools console. Run:

```javascript
getComputedStyle(document.documentElement).getPropertyValue('--ad-color-primary').trim()
```

Expected: `"#0066cc"`.

```javascript
getComputedStyle(document.documentElement).getPropertyValue('--ad-type-body-size').trim()
```

Expected: `"17px"`.

Report any value mismatch back to the agent.

- [ ] **Step 8.5: Manual (Royal) — Inter Variable loads on Windows**

In the same DevTools session, switch to the **Network** tab, filter "Font", reload the page. Confirm:
- On macOS Safari: `inter-var.woff2` is NOT requested (system-ui resolves to SF Pro first).
- On Windows Chrome / Android: `inter-var.woff2` IS requested with status 200 and < 350 KB transfer.

- [ ] **Step 8.6: Manual (Royal) — No visual regression**

Visit the following pages on the staging URL and compare against the production URL screenshots taken before deploy:
- Home (`/`)
- One collection (`/collections/all` or `/collections/tenis`)
- One product page (any product URL)
- Cart (`/cart`)
- FAQ (`/pages/faq`)
- Customer login (`/account/login`)

Expected: zero visible differences. If any page changed appearance, Subsistema 0 has a defect — open it in the agent and report which selector regressed.

- [ ] **Step 8.7: Bundle sizes within budget**

```bash
wc -c assets/apple-foundation.css assets/inter-var.woff2 assets/inter-var-italic.woff2
```

Expected: `apple-foundation.css` < 25,000 bytes; each woff2 < 350,000 bytes.

- [ ] **Step 8.8: Final tagged commit (no file changes — just marker)**

```bash
git tag -a "subsistema-0-complete" -m "Apple Design Foundation shipped"
```

Subsistema 0 is now complete. Pull-request-ready. Subsistema 1 (Global chrome) can begin against the same `--ad-*` tokens.

---

## Self-Review notes

**Spec coverage check:**
- §4.1 (font strategy) → Task 1 (download) + Task 2 (@font-face)
- §4.2 (token namespace) → Task 2 (all `--ad-*` declared)
- §4.3 (coexistence) → Task 7 (load order in theme.liquid)
- §4.4 (files shipped) → Tasks 1–6 (all 7 files created)
- §4.5 (theme.liquid modified) → Task 7
- §5.1–5.5 (token catalog) → Task 2 (verbatim)
- §6.1 (apple-button) → Task 4
- §6.2 (apple-tile) → Task 5
- §6.3 (apple-card) → Task 6
- §7 (apple-foundation.css contents) → Task 3 (all 10 listed sections covered: typography classes, layout helpers, pill, tile chassis, card chassis, product shadow, press mixin, focus ring, frosted, button chassis)
- §8 (theme.liquid injection) → Task 7
- §9 (success criteria) → Task 8

All spec requirements have a corresponding task. No gaps.

**Placeholder scan:** No TBD / TODO / "implement later" / "similar to" in any task. Every code block is complete.

**Type consistency check:**
- Snippet names: `apple-design-tokens.liquid`, `apple-button.liquid`, `apple-tile.liquid`, `apple-card.liquid` — used consistently across spec and plan.
- CSS class prefix: `.ad-*` everywhere. No drift.
- Token prefix: `--ad-*` everywhere. No drift.
- Variant names match between spec and `apple-button.liquid` / `apple-tile.liquid`: `primary | secondary-pill | dark-utility | pearl-capsule | store-hero | icon-circular | text-link | text-link-on-dark` (8 variants in apple-button — spec §6.1 lists 8; spec §4 mentioned "9 variants" which was an off-by-one in the spec — actual count is 8, which matches the table. Fixing the count mention in spec §4.4 description is non-blocking for execution.)
- `apple-tile` variants: `light | parchment | dark-1 | dark-2 | dark-3` (5) — matches spec.

---

## Parallelization opportunities (for subagent-driven execution)

Tasks have these dependency relationships:

```
Task 1 (Inter download) ─────────────────┐
                                          │
Task 2 (apple-design-tokens.liquid) ─────┤
                                          ├──► Task 7 (inject into theme.liquid) ──► Task 8 (verify)
Task 3 (apple-foundation.css) ───────────┤
                                          │
Task 4 (apple-button.liquid)   ──┐        │
Task 5 (apple-tile.liquid)     ──┼─[parallel]
Task 6 (apple-card.liquid)     ──┘        │
                                          │
                                  Tasks 4-5-6 are independent
                                  and can run as parallel subagents
```

Recommended execution wave:
- **Wave 1 (serial):** Task 1
- **Wave 2 (parallel):** Tasks 2, 3, 4, 5, 6 — five subagents in parallel (no shared files)
- **Wave 3 (serial):** Task 7 (depends on 2 + 3 having shipped)
- **Wave 4 (serial):** Task 8 (verification)

Estimated wall-clock: ~20–30 minutes with parallel subagents, vs. ~60–90 minutes serial.
