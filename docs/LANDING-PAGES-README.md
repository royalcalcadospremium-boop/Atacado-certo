# Landing Pages — Atacado / Dropshipping / Varejo

> Documentação operacional para subir, customizar e manter as 3 landing pages de modalidade, o banner de coleção e a barra de anúncio atualizada.
> **Tema:** Royal Atacado · **Branch:** `feature/landing-pages-modelos-venda`

---

## 1. Visão geral

Este pacote entrega:

| Entrega | Descrição |
|---------|-----------|
| **3 Landing Pages** | `/pages/atacado`, `/pages/dropshipping`, `/pages/varejo` — cada uma com hero em vídeo, prova social, calculadora/tiers, FAQ e CTA final. |
| **1 Collection Banner** | Banner reutilizável no topo de qualquer coleção (imagem desktop + mobile + texto + CTA). |
| **Announcement Bar atualizada** | A barra superior agora suporta 3 CTAs (Atacado · Dropshipping · Varejo) linkando direto pras 3 LPs. Mantém fallback pro texto único legado. |

Cada LP tem um JSON template próprio (`templates/page.atacado.json`, etc.) e usa sections dedicadas com prefixo `atacado-*`, `dropshipping-*`, `varejo-*` + snippets compartilhados (`lp-hero-video.liquid`, `lp-faq-accordion.liquid`).

---

## 2. Como criar as 3 páginas no Shopify Admin

Para cada uma das 3 LPs, repita o processo abaixo:

### Atacado
1. Vá em **Online Store → Pages → Add page**.
2. **Title:** `Atacado`
3. **Handle (URL):** `atacado` (gerado automaticamente — confirme que ficou `/pages/atacado`)
4. **Content:** deixe em branco (todo conteúdo vem do template/sections).
5. No painel direito, em **Theme template**, selecione `page.atacado` no dropdown.
6. Clique em **Save**.

### Dropshipping
1. **Online Store → Pages → Add page**
2. **Title:** `Dropshipping`
3. **Handle:** `dropshipping`
4. **Theme template:** `page.dropshipping`
5. **Save**

### Varejo
1. **Online Store → Pages → Add page**
2. **Title:** `Varejo`
3. **Handle:** `varejo`
4. **Theme template:** `page.varejo`
5. **Save**

> **Validação:** depois de salvar, abra `/pages/atacado`, `/pages/dropshipping` e `/pages/varejo` no front e confirme que carregam com o layout completo.

---

## 3. Como subir os vídeos hero

Os heros das 3 LPs usam vídeo em loop com poster de fallback. Recomendação:

- **Formato:** MP4 (H.264, AAC)
- **Duração:** 5–10 segundos em loop sem cortes visíveis
- **Tamanho máximo:** **< 20 MB** (Shopify Files tem limite; vídeos grandes deixam o LCP horrível)
- **Resolução:** 1920×1080 ou 1280×720 (desktop-first; o vídeo é coberto via `object-fit: cover`)
- **Sem áudio** (autoplay browser exige `muted`; áudio só polui)

### Passo a passo

1. **Settings → Files → Upload files** e selecione o `.mp4`.
2. Após o upload, clique no arquivo e **copie a URL** (algo como `https://cdn.shopify.com/s/files/1/.../hero-atacado.mp4`).
3. Faça o mesmo upload da **poster image** (JPG/WebP, mesmo aspect ratio do vídeo, ~150–300 KB). Copie a URL.
4. **Online Store → Themes → Customize**, selecione a página (Atacado / Dropshipping / Varejo).
5. Abra a seção **Hero** no painel esquerdo.
6. Cole a URL do vídeo em **video_url** e a URL da imagem em **poster_url** (ou faça upload direto pelo seletor de imagem, dependendo do campo).
7. **Save**.

> **Dica:** comprima com [HandBrake](https://handbrake.fr/) usando o preset *Web Optimized* + CRF 26–28 pra ficar leve sem perder qualidade visível.

---

## 4. Como customizar cada seção

**Online Store → Themes → Customize**, depois no seletor de páginas no topo escolha **Pages → Atacado** (ou Dropshipping / Varejo).

### Sections disponíveis por LP

| LP | Sections (em ordem) |
|----|---------------------|
| **Atacado** | `atacado-hero`, `atacado-trust-bar`, `atacado-steps`, `atacado-tiers`, `atacado-brands`, `atacado-faq`, `atacado-cta-final` |
| **Dropshipping** | `dropshipping-hero`, `dropshipping-trust-bar`, `dropshipping-steps`, `dropshipping-calculator`, `dropshipping-brands`, `dropshipping-faq`, `dropshipping-cta-final`, `dropshipping-testimonials` |
| **Varejo** | `varejo-hero`, `varejo-trust-bar`, `varejo-steps`, `varejo-shipping`, `varejo-brands`, `varejo-faq`, `varejo-cta-final`, `varejo-testimonials` |

### Edições comuns

- **Steps (passo a passo):** clique na section, abra cada bloco e edite título + descrição + ícone. Para adicionar/remover passos, use **Add block** / **Remove**.
- **Tiers / Calculadora:** cada faixa de quantidade é um block. Edite quantidade mínima, desconto % e label.
- **Brands (marcas):** blocks com upload de logo + link opcional. Recomendado PNG transparente, ~200×80px, < 30 KB cada.
- **FAQs:** cada pergunta é um block (pergunta + resposta em rich text). Reordenar arrastando.
- **CTAs:** texto do botão + URL no painel direito da section.

> Após editar, sempre clique **Save** no canto superior direito.

---

## 5. Como ativar o Banner em uma collection

O `collection-banner.liquid` foi adicionado como section opcional no template `collection.liquid`. Para ativá-lo em uma coleção específica:

1. **Online Store → Themes → Customize**.
2. No seletor de páginas no topo, escolha **Collections → [nome da coleção]** (ex.: Sapatilhas, Tênis, etc.).
3. Localize a section **Banner de Coleção** no topo do painel esquerdo (acima do grid de produtos).
4. Configure:
   - **Toggle "Mostrar banner":** ative (deve estar marcado).
   - **Imagem desktop:** upload (ideal 1920×400 ou 2400×500, JPG/WebP, < 300 KB).
   - **Imagem mobile:** upload (ideal 750×600 ou quadrada, < 200 KB).
   - **Título / subtítulo:** texto curto, alto contraste.
   - **CTA texto + URL:** opcional.
5. **Save**.

> O banner só renderiza se a imagem desktop estiver preenchida E o toggle estiver ativo. Para desativar em uma coleção, basta desligar o toggle.

---

## 6. Estrutura de arquivos

```
sections/
  collection-banner.liquid            # banner reutilizável (toggle por coleção)
  atacado-hero.liquid
  atacado-trust-bar.liquid
  atacado-steps.liquid
  atacado-tiers.liquid
  atacado-brands.liquid
  atacado-faq.liquid
  atacado-cta-final.liquid            # (7 sections)
  dropshipping-hero.liquid
  dropshipping-trust-bar.liquid
  dropshipping-steps.liquid
  dropshipping-calculator.liquid
  dropshipping-brands.liquid
  dropshipping-faq.liquid
  dropshipping-cta-final.liquid
  dropshipping-testimonials.liquid    # (8 sections)
  varejo-hero.liquid
  varejo-trust-bar.liquid
  varejo-steps.liquid
  varejo-shipping.liquid
  varejo-brands.liquid
  varejo-faq.liquid
  varejo-cta-final.liquid
  varejo-testimonials.liquid          # (8 sections)
  announcement-bar.liquid             # MODIFICADO: 3 CTAs de modalidade

snippets/
  lp-hero-video.liquid                # markup compartilhado do hero em vídeo
  lp-faq-accordion.liquid             # acordeão acessível compartilhado

templates/
  page.atacado.json
  page.dropshipping.json
  page.varejo.json
  collection.liquid                   # MODIFICADO: monta o banner no topo

assets/
  lp-shared.css                       # tokens, grid, util classes das LPs
  lp-shared.js                        # accordion, lazy video, observers

docs/
  LANDING-PAGES-README.md             # este arquivo
```

---

## 7. Troubleshooting

### Vídeo do hero não carrega
- Verifique o **formato** — deve ser MP4 (H.264). MOV/WebM podem não tocar em todos os browsers.
- Verifique o **tamanho** — > 20 MB trava em mobile. Comprima com HandBrake.
- Autoplay exige **muted** — o markup já coloca `muted playsinline autoplay loop`. Se algum admin remover o `muted` no customizer, o vídeo não dispara.
- Confira se a **URL é HTTPS** (todas as URLs do Shopify CDN já são).
- No iOS Safari, vídeos sem `playsinline` abrem em fullscreen — confirme o atributo no DOM via DevTools.

### Banner não aparece na collection
- Confirme que o toggle **"Mostrar banner"** está ATIVO no customizer da coleção.
- Confirme que a **imagem desktop** está preenchida (mesmo que o banner caia para fallback em mobile, a desktop é obrigatória).
- Se está em modo preview, force refresh (Ctrl+F5).
- Verifique se o template da collection é `collection.liquid` (e não um template customizado que não inclua a section).

### Animação on-scroll não funciona
- Cliente pode ter `prefers-reduced-motion: reduce` ativo no SO (acessibilidade) — nesse caso, animações são intencionalmente desativadas via CSS. Comportamento esperado.
- Verifique console por erros de JS — o `lp-shared.js` usa `IntersectionObserver` (não funciona em IE11, mas isso já está fora do escopo).
- Se o JS não carrega, confira que `lp-shared.js` está sendo incluído no `theme.liquid` ou nas próprias sections via `{{ 'lp-shared.js' | asset_url | script_tag }}`.

### Layout quebrado em mobile
- Confirme que `lp-shared.css` está carregando (DevTools → Network).
- Cheque se a imagem do hero/banner tem versão mobile preenchida — sem ela, o desktop pode ficar com aspect-ratio ruim.

### Barra de anúncio não mostra os 3 CTAs
- Os 3 grupos (texto + URL) precisam estar **todos preenchidos**. Se algum estiver vazio, a barra cai pro modo legado (texto único).
- Confirme em **Customize → Header → Barra de anúncio (Apple)** que os campos "Modalidade 1/2/3" estão preenchidos.

---

**Última atualização:** 2026-05-18
