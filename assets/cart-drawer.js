/* Royal Cart Drawer — Ajax
   - Intercepta forms /cart/add
   - POST /cart/add.js
   - GET /cart.js
   - POST /cart/change.js (qty / remove)
   - Upsell add via /cart/add.js
   - Auto Hook: transforma links/botões do carrinho em gatilho do drawer
*/

(function(){
  const SELECTORS = {
    root: '#RoyalCartDrawer',
    overlay: '[data-rcd-overlay]',
    close: '[data-rcd-close]',
    items: '[data-rcd-items]',
    subtotal: '[data-rcd-subtotal]',
    freeshipText: '[data-rcd-freeship-text]',
    freeshipBar: '[data-rcd-freeship-bar]',
    qtyMinus: '[data-rcd-qty-minus]',
    qtyPlus: '[data-rcd-qty-plus]',
    qtyInput: '[data-rcd-qty-input]',
    remove: '[data-rcd-remove]',
    upsellAdd: '[data-rcd-upsell-add]'
  };

  const money = (cents, currency = 'BRL', locale = 'pt-BR') => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format((cents || 0) / 100);
    } catch(e){
      return `R$ ${((cents || 0)/100).toFixed(2)}`;
    }
  };

  const root = document.querySelector(SELECTORS.root);
  if(!root) return;

  // ✅ Pedido mínimo atacado (fixo) — 200 reais
  // Se quiser tornar dinâmico depois: root.getAttribute('data-atacado-min')
  const ATACADO_MIN_CENTS = 20000;

  const state = {
    isOpen: false,
    loading: false
  };

  const open = () => {
    if(state.isOpen) return;
    state.isOpen = true;
    root.classList.add('is-open');
    const panel = root.querySelector('.rcd__panel');
    panel && panel.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('rcd-lock');
    document.body.classList.add('rcd-lock');
  };

  const close = () => {
    if(!state.isOpen) return;
    state.isOpen = false;
    root.classList.remove('is-open');
    const panel = root.querySelector('.rcd__panel');
    panel && panel.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('rcd-lock');
    document.body.classList.remove('rcd-lock');
  };

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json', ...options.headers },
      ...options
    });
    if(!res.ok){
      const text = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} — ${text}`);
    }
    return res.json();
  };

  const setLoading = (v) => {
    state.loading = v;
    root.classList.toggle('is-loading', v);
  };

  const renderItems = (cart) => {
    const itemsEl = root.querySelector(SELECTORS.items);
    if(!itemsEl) return;

    if(!cart || !cart.items || cart.items.length === 0){
      itemsEl.innerHTML = `
        <div class="rcd__empty">
          <p class="rcd__empty-title">Seu carrinho está vazio</p>
          <p class="rcd__empty-text">Adicione produtos para ver o resumo aqui.</p>
          <a class="rcd__btn rcd__btn--ghost" href="/collections/all">Ver produtos</a>
        </div>
      `;
      return;
    }

    itemsEl.innerHTML = cart.items.map((item, idx) => {
      const line = idx + 1;
      const img = item.image
        ? `<img src="${item.image.replace(/(\.[a-z]+)(\?.*)?$/i, '_160x$1$2')}" alt="${escapeHTML(item.product_title)}" loading="lazy" width="72" height="72">`
        : '';

      const variant = item.variant_title && item.variant_title !== 'Default Title'
        ? `<div class="rcd__variant">${escapeHTML(item.variant_title)}</div>`
        : '';

      const compare = item.original_line_price > item.final_line_price
        ? `<span class="rcd__price-compare">${money(item.original_line_price)}</span>`
        : '';

      return `
        <article class="rcd__item" data-line="${line}">
          <a class="rcd__thumb" href="${item.url}">
            ${img}
          </a>
          <div class="rcd__meta">
            <div class="rcd__meta-top">
              <a class="rcd__name" href="${item.url}">${escapeHTML(item.product_title)}</a>
              <button class="rcd__remove" type="button" data-rcd-remove data-line="${line}" aria-label="Remover">✕</button>
            </div>
            ${variant}
            <div class="rcd__meta-bottom">
              <div class="rcd__qty" role="group" aria-label="Quantidade">
                <button type="button" class="rcd__qty-btn" data-rcd-qty-minus data-line="${line}" aria-label="Diminuir">−</button>
                <input class="rcd__qty-input" data-rcd-qty-input data-line="${line}" type="number" min="1" value="${item.quantity}" inputmode="numeric">
                <button type="button" class="rcd__qty-btn" data-rcd-qty-plus data-line="${line}" aria-label="Aumentar">+</button>
              </div>
              <div class="rcd__prices">
                ${compare}
                <span class="rcd__price">${money(item.final_line_price)}</span>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  };

  const renderTotals = (cart) => {
    const sub = root.querySelector(SELECTORS.subtotal);
    if(sub) sub.textContent = money(cart.total_price);

    /* ======================================================
       PROGRESSO PEDIDO MÍNIMO ATACADO (R$ 200)
       ====================================================== */
    const textEl = root.querySelector(SELECTORS.freeshipText);
    const barEl  = root.querySelector(SELECTORS.freeshipBar);

    if(textEl && barEl){
      const total = cart?.total_price || 0;
      const missing = ATACADO_MIN_CENTS - total;

      if(missing <= 0){
        textEl.textContent = 'Pedido mínimo de atacado atingido ✅';
        barEl.style.width = '100%';
      } else {
        textEl.textContent = `Faltam ${money(missing)} para completar seu pedido no atacado`;
        const pct = Math.min(100, Math.round((total / ATACADO_MIN_CENTS) * 100));
        barEl.style.width = `${pct}%`;
      }
    }
  };

  const refreshCart = async () => {
    const cart = await fetchJSON('/cart.js');
    renderItems(cart);
    renderTotals(cart);
    document.dispatchEvent(new CustomEvent('rcd:cart-updated', { detail: cart }));
    return cart;
  };

  const changeLineQty = async (line, quantity) => {
    await fetchJSON('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line, quantity })
    });
    return refreshCart();
  };

  const addVariant = async (variantId, quantity = 1) => {
    await fetchJSON('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(variantId), quantity: Number(quantity) })
    });
    return refreshCart();
  };

  // ✅ auto-detecta links/botões que levam ao carrinho e marca como gatilho do drawer
  const autoHookCartLinks = () => {
    const mark = (el) => {
      if(!el || el.hasAttribute('data-cart-drawer-open')) return;
      el.setAttribute('data-cart-drawer-open', '');
    };

    document.querySelectorAll('a[href="/cart"], a[href="/cart/"]').forEach(mark);

    document.querySelectorAll('a[href]').forEach(a => {
      const href = (a.getAttribute('href') || '').trim();
      if(!href) return;
      try{
        const url = new URL(href, window.location.origin);
        if(url.pathname === '/cart' || url.pathname === '/cart/'){
          mark(a);
        }
      }catch(e){}
    });

    document.querySelectorAll(
      '[href*="cart"], [data-drawer-trigger="cart"], [data-cart-toggle], [aria-label*="carrinho"], [aria-controls*="cart"]'
    ).forEach(mark);
  };

  // Intercepta submit do form /cart/add (quando o tema NÃO bloqueia o submit)
  const bindAddToCartInterception = () => {
    document.addEventListener('submit', async (e) => {
      const form = e.target;
      if(!(form instanceof HTMLFormElement)) return;

      const action = (form.getAttribute('action') || '').toLowerCase();
      const isAdd = action.includes('/cart/add');
      if(!isAdd) return;

      if(form.hasAttribute('data-no-ajax')) return;

      e.preventDefault();

      try{
        setLoading(true);

        const fd = new FormData(form);
        const id = fd.get('id');

        if(!id){
          const maybe = [...fd.keys()].find(k => k.includes('items') && k.includes('[id]'));
          if(maybe){
            const v = fd.get(maybe);
            await addVariant(v, 1);
          } else {
            throw new Error('Não encontrei variant id no form.');
          }
        } else {
          const qty = Number(fd.get('quantity') || 1);
          await addVariant(id, qty);
        }

        autoHookCartLinks();
        open();
      } catch(err){
        console.error('[RCD] add error', err);
        try { form.submit(); } catch(e2) {}
      } finally{
        setLoading(false);
      }
    }, true);
  };

  const bindDrawerControls = () => {
    root.addEventListener('click', (e) => {
      const t = e.target;

      /* ======================================================
         ✅ CORREÇÃO CHECKOUT (À PROVA DE ERRO)
         - captura clique em qualquer filho do botão com [data-rcd-checkout]
         - se href vier vazio/#, usa fallback /checkout
         - bloqueia fechamento do drawer e força navegação
         ====================================================== */
      const checkoutEl = t && t.closest ? t.closest('[data-rcd-checkout]') : null;
      if(checkoutEl){
        let href = '';

        // tenta várias formas de obter o href (robusto)
        try { href = (checkoutEl.getAttribute('href') || '').trim(); } catch(e1) {}
        if(!href){
          try { href = (checkoutEl.href || '').trim(); } catch(e2) {}
        }

        const finalHref = (href && href !== '#') ? href : '/checkout';

        e.preventDefault();
        e.stopPropagation();
        window.location.assign(finalHref);
        return;
      }

      if(t && t.matches(SELECTORS.overlay)) close();
      if(t && t.matches(SELECTORS.close)) close();

      if(t && t.matches(SELECTORS.qtyMinus)){
        const line = Number(t.getAttribute('data-line'));
        const input = root.querySelector(`${SELECTORS.qtyInput}[data-line="${line}"]`);
        const qty = Math.max(1, Number(input?.value || 1) - 1);
        setLoading(true);
        changeLineQty(line, qty).catch(console.error).finally(()=> setLoading(false));
      }

      if(t && t.matches(SELECTORS.qtyPlus)){
        const line = Number(t.getAttribute('data-line'));
        const input = root.querySelector(`${SELECTORS.qtyInput}[data-line="${line}"]`);
        const qty = Math.max(1, Number(input?.value || 1) + 1);
        setLoading(true);
        changeLineQty(line, qty).catch(console.error).finally(()=> setLoading(false));
      }

      if(t && t.matches(SELECTORS.remove)){
        const line = Number(t.getAttribute('data-line'));
        setLoading(true);
        changeLineQty(line, 0).catch(console.error).finally(()=> setLoading(false));
      }

      if(t && t.matches(SELECTORS.upsellAdd)){
        const vid = t.getAttribute('data-variant-id');
        if(!vid) return;
        setLoading(true);
        addVariant(vid, 1).then(()=> open()).catch(console.error).finally(()=> setLoading(false));
      }
    });

    root.addEventListener('change', (e) => {
      const t = e.target;
      if(!(t instanceof HTMLInputElement)) return;
      if(!t.matches(SELECTORS.qtyInput)) return;
      const line = Number(t.getAttribute('data-line'));
      const qty = Math.max(1, Number(t.value || 1));
      setLoading(true);
      changeLineQty(line, qty).catch(console.error).finally(()=> setLoading(false));
    });
  };

  const bindOpenTriggers = () => {
    document.addEventListener('click', (e) => {
      const trigger = e.target && e.target.closest && e.target.closest('[data-cart-drawer-open]');
      if(!trigger) return;

      // Evita navegar pra /cart
      const tag = trigger.tagName?.toLowerCase();
      if(tag === 'a') e.preventDefault();

      setLoading(true);
      refreshCart().then(()=> open()).catch(console.error).finally(()=> setLoading(false));
    }, true);
  };

  // Integra com AJAX add-to-cart do tema (Warehouse-like) que bloqueia submit
  const bindThemeAjaxEvents = () => {
    document.addEventListener('product:added', async () => {
      try{
        setLoading(true);
        await refreshCart();
        open();
      }catch(err){
        console.error('[RCD] product:added handler error', err);
      }finally{
        setLoading(false);
      }
    }, true);

    document.addEventListener('cart:refresh', async () => {
      try{
        setLoading(true);
        await refreshCart();
      }catch(err){
        console.error('[RCD] cart:refresh handler error', err);
      }finally{
        setLoading(false);
      }
    }, true);

    document.addEventListener('cart:open', async () => {
      try{
        setLoading(true);
        await refreshCart();
        open();
      }catch(err){
        console.error('[RCD] cart:open handler error', err);
      }finally{
        setLoading(false);
      }
    }, true);
  };

  const escapeHTML = (str='') => String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  // init
  autoHookCartLinks();
  bindAddToCartInterception();
  bindThemeAjaxEvents();
  bindDrawerControls();
  bindOpenTriggers();

  refreshCart().catch(()=>{});

  const mo = new MutationObserver(() => autoHookCartLinks());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.RoyalCartDrawer = { open, close, refreshCart };
  window.cartDrawer = window.cartDrawer || window.RoyalCartDrawer;
})();
