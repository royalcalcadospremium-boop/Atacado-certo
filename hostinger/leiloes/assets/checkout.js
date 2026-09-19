/* ==========================================================
   checkout.js — cálculo de total, bumps, máscaras e validação
   ATENÇÃO: nada aqui processa cartão. É camada visual.
   A cobrança real é feita pela plataforma em CONFIG.checkout.urlDestino.
   ========================================================== */
(function () {
  'use strict';

  var cfg  = (window.CONFIG && window.CONFIG.checkout) || {};
  var MAX  = Number(cfg.maxParcelas) || 12;
  var JUROS= Number(cfg.jurosMes) || 0;
  var DESC = Number(cfg.descontoPix) || 0;

  var form        = document.getElementById('formCheckout');
  var selPlano    = document.getElementById('plano');
  var selParcelas = document.getElementById('parcelamento');
  var grpParcelas = document.getElementById('grupoParcelamento');
  var elTotal     = document.getElementById('valorTotal');
  var elResumo    = document.getElementById('resumoPreco');
  var btnPagar    = document.getElementById('btnPagar');
  var elErro      = document.getElementById('mensagemErro');
  var painelCartao= document.getElementById('painelCartao');
  var painelPix   = document.getElementById('painelPix');

  if (!form) { return; }

  /* ---------- Formatação ---------- */
  function moeda(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function metodoAtual() {
    var m = form.querySelector('input[name="pagamento"]:checked');
    return m ? m.value : 'cartao';
  }

  function planoParcelavel() {
    var opt = selPlano ? selPlano.options[selPlano.selectedIndex] : null;
    return !opt || opt.dataset.parcelavel !== 'nao';
  }

  /* ---------- Soma dos bumps ----------
     Um bump com data-substitui desativa os bumps que ele já contém,
     para o cliente não pagar duas vezes pelo mesmo item.          */
  function sincronizarBumps() {
    var todos = form.querySelectorAll('input[name="bump"]');

    // Reabilita tudo antes de recalcular
    todos.forEach(function (cb) {
      cb.disabled = false;
      var corpo = cb.closest('.bump-corpo');
      if (corpo) { corpo.style.opacity = ''; }
    });

    todos.forEach(function (cb) {
      if (!cb.checked || !cb.dataset.substitui) { return; }

      cb.dataset.substitui.split(',').forEach(function (valor) {
        var alvo = form.querySelector('input[name="bump"][value="' + valor.trim() + '"]');
        if (!alvo || alvo === cb) { return; }
        alvo.checked  = false;
        alvo.disabled = true;
        var corpo = alvo.closest('.bump-corpo');
        if (corpo) { corpo.style.opacity = '.45'; }
      });
    });
  }

  function totalBumps() {
    var soma = 0;
    form.querySelectorAll('input[name="bump"]:checked').forEach(function (cb) {
      soma += parseFloat(cb.dataset.preco || '0');
    });
    return soma;
  }

  function precoBase() {
    var opt = selPlano ? selPlano.options[selPlano.selectedIndex] : null;
    return opt ? parseFloat(opt.dataset.preco || '0') : 0;
  }

  /* ---------- Parcelamento ---------- */
  function valorParcela(total, n) {
    if (JUROS <= 0) { return total / n; }
    var i = JUROS / 100;
    return total * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  }

  function montarParcelas(total) {
    if (!selParcelas) { return; }

    var escolhidaAntes = selParcelas.value;
    selParcelas.innerHTML = '';

    for (var n = 1; n <= MAX; n++) {
      var parcela = valorParcela(total, n);
      if (n > 1 && parcela < 5) { break; }  // não oferece parcela irrisória

      var opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = n === 1
        ? moeda(total) + ' à vista'
        : n + 'x ' + moeda(parcela) + (JUROS > 0 ? '' : ' sem juros');
      selParcelas.appendChild(opt);
    }

    // Mantém a escolha do cliente se ela ainda existir
    if (escolhidaAntes && selParcelas.querySelector('option[value="' + escolhidaAntes + '"]')) {
      selParcelas.value = escolhidaAntes;
    } else {
      selParcelas.value = String(Math.min(MAX, selParcelas.options.length));
    }
  }

  /* ---------- Recalcular tudo ---------- */
  function recalcular() {
    sincronizarBumps();

    var metodo = metodoAtual();
    var total  = precoBase() + totalBumps();

    if (metodo === 'pix' && DESC > 0) {
      total = total * (1 - DESC / 100);
    }

    // Alterna painéis de pagamento
    if (painelCartao) { painelCartao.hidden = metodo !== 'cartao'; }
    if (painelPix)    { painelPix.hidden    = metodo !== 'pix'; }

    // Parcelamento só existe no cartão e em plano parcelável
    var mostraParcelas = metodo === 'cartao' && planoParcelavel();
    if (grpParcelas) { grpParcelas.hidden = !mostraParcelas; }

    if (mostraParcelas) {
      montarParcelas(total);
    }

    if (elTotal) { elTotal.textContent = moeda(total); }

    // Linha de resumo lá em cima
    if (elResumo) {
      if (mostraParcelas && selParcelas.value) {
        var n = Number(selParcelas.value);
        elResumo.textContent = n > 1
          ? n + 'x ' + moeda(valorParcela(total, n))
          : moeda(total) + ' à vista';
      } else {
        elResumo.textContent = moeda(total) + (metodo === 'pix' ? ' no Pix' : '');
      }
    }
  }

  /* ---------- Máscaras ---------- */
  function soDigitos(s) { return s.replace(/\D/g, ''); }

  function mascarar(id, fn, limite) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.addEventListener('input', function () {
      var d = soDigitos(el.value).slice(0, limite);
      el.value = fn(d);
    });
  }

  mascarar('telefone', function (d) {
    if (d.length <= 10) {
      return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, function (_, a, b, c) {
        return (a ? '(' + a : '') + (a.length === 2 ? ') ' : '') + b + (c ? '-' + c : '');
      }).trim();
    }
    return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
  }, 11);

  mascarar('numeroCartao', function (d) {
    return d.replace(/(\d{4})(?=\d)/g, '$1 ');
  }, 16);

  mascarar('validade', function (d) {
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  }, 4);

  mascarar('cvv', function (d) { return d; }, 4);

  mascarar('cpf', function (d) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }, 11);

  /* ---------- Resumo expansível ---------- */
  var btnResumo = document.getElementById('btnResumo');
  var detalhe   = document.getElementById('detalheProduto');
  if (btnResumo && detalhe) {
    btnResumo.addEventListener('click', function () {
      var aberto = btnResumo.getAttribute('aria-expanded') === 'true';
      btnResumo.setAttribute('aria-expanded', String(!aberto));
      detalhe.hidden = aberto;
    });
  }

  /* ---------- Validação ---------- */
  function marcarErro(el, temErro) {
    var linha = el.closest('.linha') || el;
    linha.classList.toggle('erro-campo', temErro);
  }

  function emailValido(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  }

  function validar() {
    var problemas = [];

    var email = document.getElementById('email');
    var tel   = document.getElementById('telefone');
    var nome  = document.getElementById('nome');

    var emailOk = emailValido(email.value);
    marcarErro(email, !emailOk);
    if (!emailOk) { problemas.push('um email válido'); }

    var telOk = soDigitos(tel.value).length >= 10;
    marcarErro(tel, !telOk);
    if (!telOk) { problemas.push('o telefone com DDD'); }

    var nomeOk = nome.value.trim().split(/\s+/).length >= 2;
    marcarErro(nome, !nomeOk);
    if (!nomeOk) { problemas.push('seu nome completo'); }

    if (metodoAtual() === 'cartao') {
      var num = document.getElementById('numeroCartao');
      var val = document.getElementById('validade');
      var cvv = document.getElementById('cvv');
      var cpf = document.getElementById('cpf');

      var numOk = soDigitos(num.value).length >= 13;
      marcarErro(num, !numOk);
      if (!numOk) { problemas.push('o número do cartão'); }

      var valOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(val.value);
      marcarErro(val, !valOk);
      if (!valOk) { problemas.push('a validade (MM/AA)'); }

      var cvvOk = soDigitos(cvv.value).length >= 3;
      marcarErro(cvv, !cvvOk);
      if (!cvvOk) { problemas.push('o CVV'); }

      var cpfOk = soDigitos(cpf.value).length === 11;
      marcarErro(cpf, !cpfOk);
      if (!cpfOk) { problemas.push('o CPF do titular'); }
    }

    return problemas;
  }

  /* ---------- Envio ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var problemas = validar();

    if (problemas.length) {
      elErro.textContent = 'Confira ' + problemas.join(', ') + '.';
      elErro.hidden = false;
      form.querySelector('.erro-campo input, input.erro-campo')?.focus();
      return;
    }

    elErro.hidden = true;
    btnPagar.disabled = true;
    btnPagar.textContent = 'Processando...';

    var bumps = Array.prototype.map.call(
      form.querySelectorAll('input[name="bump"]:checked'),
      function (cb) { return cb.value; }
    );

    var pedido = {
      email:    document.getElementById('email').value.trim(),
      telefone: soDigitos(document.getElementById('telefone').value),
      nome:     document.getElementById('nome').value.trim(),
      plano:    selPlano ? selPlano.value : '',
      metodo:   metodoAtual(),
      parcelas: (grpParcelas && !grpParcelas.hidden) ? selParcelas.value : '1',
      extras:   bumps.join(','),
      total:    elTotal.textContent
    };

    /* --- Sem plataforma configurada: modo demonstração --- */
    if (!cfg.urlDestino) {
      btnPagar.disabled = false;
      btnPagar.textContent = 'Pagar';
      elErro.style.color = '#16a34a';
      elErro.textContent =
        'Formulário validado. Configure CONFIG.checkout.urlDestino ' +
        'para enviar ao seu processador de pagamento.';
      elErro.hidden = false;
      console.log('[checkout] pedido montado:', pedido);
      return;
    }

    /* --- Redireciona para a plataforma de pagamento ---
       Só dados de contato e da oferta vão na URL.
       Dados de cartão NUNCA saem daqui — quem coleta cartão é
       a plataforma, na página dela, sob certificação PCI.      */
    var destino = new URL(cfg.urlDestino, window.location.href);
    destino.searchParams.set('email', pedido.email);
    destino.searchParams.set('phone', pedido.telefone);
    destino.searchParams.set('name',  pedido.nome);
    destino.searchParams.set('plan',  pedido.plano);
    if (pedido.extras) { destino.searchParams.set('bumps', pedido.extras); }

    window.location.href = destino.toString();
  });

  /* ---------- Listeners ---------- */
  form.addEventListener('change', function (e) {
    if (e.target.matches('input[name="bump"], input[name="pagamento"], #plano, #parcelamento')) {
      recalcular();
    }
  });

  recalcular();
})();
