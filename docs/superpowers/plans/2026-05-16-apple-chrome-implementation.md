# Apple Chrome Implementation (Subsistema 1)

**Goal:** Re-skin `announcement-bar`, `header`, `footer` to Apple-pure aesthetic, consuming the Foundation tokens shipped in Subsistema 0.

**Architecture:**
- `sections/announcement-bar.liquid` → thin parchment strip (32px), one tagline + optional text-link CTA. Replaces the 3 modality badges + gradient bar.
- `sections/header.liquid` → two-tier nav. `global-nav` (44px, surface-black, 12px nav-link text, right-aligned icon utilities). `sub-nav-frosted` (52px, parchment 80% + backdrop-blur, brand tagline + sub-links + primary pill CTA). Mobile collapses to hamburger + centered logo + bag.
- `sections/footer.liquid` → parchment background, link columns in `dense-link` (17px/2.41 leading), legal row in `fine-print` and `micro-legal`. Block-driven schema with link_list and rich_text variants.

**Decisions (per user delegation):**
1. **Old schemas die.** All settings on the existing customizer that don't match new IDs are abandoned. User reconfigures in Shopify admin after deploy.
2. **No mega menu.** Apple doesn't do mega menus. The new header collapses to a clean sub-nav-frosted with up to 5 inline links + a primary CTA.
3. **Modality badges (ATACADO/DROPSHIPPING/VAREJO) removed.** Apple's voice is quiet — the brand differentiator moves into the sub-nav tagline ("Atacado · Dropshipping · Varejo — direto da fábrica") and into the WhatsApp pill CTA.
4. **Mini-cart & cart drawer preserved** (those are Subsistema 5).
5. **mega-menu.liquid, desktop-menu.liquid, mobile-menu.liquid become orphans.** The new `header.liquid` doesn't render them. Files stay on disk for now (deletion in cleanup spec).

**Files modified:** 3
- `sections/announcement-bar.liquid` (replaced)
- `sections/header.liquid` (replaced)
- `sections/footer.liquid` (replaced)

**Files orphaned (not modified, not loaded by new chrome):**
- `snippets/mega-menu.liquid`
- `snippets/desktop-menu.liquid`
- `snippets/mobile-menu.liquid`

**Verification:** Playwright navigates to https://royalatacado.com.br after deploy, screenshots desktop + mobile, compares against [`docs/superpowers/baselines/subsistema-0/`](../baselines/subsistema-0/). Visual diff is INTENTIONAL this time — the whole point is the new chrome.

**Execution mode:** 3 parallel `Write` tool calls (no subagent dispatch — Liquid is finicky and I write more reliably than subagents copying from the plan). Followed by 3 sequential commits, one push, Playwright verification.
