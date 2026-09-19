/* ==========================================================
   app.js — comportamento da página de vendas (VSL)
   ========================================================== */
(function () {
  'use strict';

  var cfg = window.CONFIG || {};
  var CHAVE_PROGRESSO = 'radar_progresso_video';

  /* ---------- Utilitário: localStorage que nunca quebra ---------- */
  function ler(chave) {
    try { return window.localStorage.getItem(chave); }
    catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try { window.localStorage.setItem(chave, valor); }
    catch (e) { /* modo privado / storage bloqueado: seguir sem lembrar */ }
  }

  /* ========== 1. Barra de urgência ========== */
  function iniciarUrgencia() {
    var barra = document.getElementById('barraUrgencia');
    var alvo  = document.getElementById('textoUrgencia');
    var u = cfg.urgencia || {};

    if (!barra || !alvo || !u.texto) { return; }

    if (!u.prazo) {
      alvo.textContent = u.texto;
      barra.hidden = false;
      return;
    }

    var fim = new Date(u.prazo).getTime();
    if (isNaN(fim)) { alvo.textContent = u.texto; barra.hidden = false; return; }

    function doisDigitos(n) { return n < 10 ? '0' + n : String(n); }

    function atualizar() {
      var restante = fim - Date.now();

      if (restante <= 0) {
        barra.hidden = true;
        clearInterval(timer);
        return;
      }

      var horas   = Math.floor(restante / 3600000);
      var minutos = Math.floor((restante % 3600000) / 60000);
      var segundos= Math.floor((restante % 60000) / 1000);

      alvo.innerHTML = u.texto +
        ' <span class="contador">' +
        doisDigitos(horas) + ':' + doisDigitos(minutos) + ':' + doisDigitos(segundos) +
        '</span>';

      barra.hidden = false;
    }

    atualizar();
    var timer = setInterval(atualizar, 1000);
  }

  /* ========== 2. Carregar o vídeo ========== */
  function iniciarVideo() {
    var player = document.getElementById('player');
    if (!player) { return; }

    // iframe (YouTube / Vimeo)
    if (player.tagName === 'IFRAME') {
      if (cfg.videoEmbed) {
        player.src = cfg.videoEmbed;
      } else {
        // Sem vídeo configurado: mostra aviso em vez de iframe vazio
        var moldura = document.getElementById('molduraVideo');
        if (moldura) {
          moldura.innerHTML =
            '<div class="camada-video">' +
              '<p class="titulo-camada">Configure o seu vídeo em ' +
              '<code>assets/config.js</code> &rarr; <code>videoEmbed</code></p>' +
            '</div>';
        }
      }
      return;
    }

    // <video> próprio: retomar de onde parou
    if (player.tagName === 'VIDEO' && cfg.lembrarProgresso) {
      prepararRetomada(player);
    }
  }

  function prepararRetomada(video) {
    var salvo = parseFloat(ler(CHAVE_PROGRESSO) || '0');
    var camada = document.getElementById('camadaRetomada');
    var btnContinuar = document.getElementById('btnContinuar');
    var btnReiniciar = document.getElementById('btnReiniciar');

    if (salvo > 10 && camada) {
      camada.hidden = false;

      if (btnContinuar) {
        btnContinuar.addEventListener('click', function () {
          video.currentTime = salvo;
          camada.hidden = true;
          video.play();
        });
      }
      if (btnReiniciar) {
        btnReiniciar.addEventListener('click', function () {
          video.currentTime = 0;
          camada.hidden = true;
          video.play();
        });
      }
    }

    // Grava a posição a cada 5 segundos
    var ultimoRegistro = 0;
    video.addEventListener('timeupdate', function () {
      if (video.currentTime - ultimoRegistro > 5) {
        ultimoRegistro = video.currentTime;
        gravar(CHAVE_PROGRESSO, String(video.currentTime));
      }
    });

    video.addEventListener('ended', function () {
      gravar(CHAVE_PROGRESSO, '0');
    });
  }

  /* ========== 3. Revelar o CTA depois de X segundos ========== */
  function iniciarCta() {
    var cta   = document.getElementById('ctaPrincipal');
    var aviso = document.getElementById('avisoEspera');
    if (!cta) { return; }

    var espera = Number(cfg.segundosAtePitch) || 0;

    function revelar() {
      cta.classList.remove('cta-oculto');
      if (aviso) { aviso.remove(); }
    }

    if (espera <= 0) { revelar(); return; }

    setTimeout(revelar, espera * 1000);
  }

  /* ========== 4. Título dinâmico ========== */
  function aplicarMarca() {
    if (!cfg.marca) { return; }
    document.querySelectorAll('[data-marca]').forEach(function (el) {
      el.textContent = cfg.marca;
    });
  }

  /* ---------- Bootstrap ---------- */
  function iniciar() {
    iniciarUrgencia();
    iniciarVideo();
    iniciarCta();
    aplicarMarca();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
