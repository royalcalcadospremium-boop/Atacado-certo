/* ==========================================================
   CONFIG — edite SÓ este arquivo para mudar a oferta.
   Nenhum outro arquivo precisa ser tocado no dia a dia.
   ========================================================== */

window.CONFIG = {

  /* ---------- Marca ---------- */
  marca: 'Radar do Arremate',

  /* ---------- Barra de urgência do topo ----------
     Deixe texto vazio ('') para esconder a barra.
     Se 'prazo' estiver preenchido (data ISO), vira contador regressivo
     e a barra some sozinha quando o prazo passa.               */
  urgencia: {
    texto: 'Inscrições abertas por tempo limitado.',
    prazo: ''   // ex.: '2026-10-05T23:59:59-03:00'
  },

  /* ---------- Vídeo da VSL ----------
     Cole a URL de embed do SEU vídeo.
       YouTube : https://www.youtube.com/embed/SEU_ID?rel=0
       Vimeo   : https://player.vimeo.com/video/SEU_ID
     Se você usa Vturb/Panda, apague a <iframe> do index.html
     e cole o script do player no lugar.                        */
  videoEmbed: '',

  /* Segundos até o botão de compra aparecer.
     0 = aparece imediatamente.                                 */
  segundosAtePitch: 0,

  /* Lembrar onde o visitante parou (mostra a camada de retomada).
     Só funciona com <video> próprio, não com iframe.           */
  lembrarProgresso: true,

  /* ---------- Checkout ---------- */
  checkout: {
    /* Parcelas máximas no cartão */
    maxParcelas: 12,

    /* Juros ao mês no parcelamento. 0 = sem juros (preço fixo dividido). */
    jurosMes: 0,

    /* Desconto no Pix, em % (0 = sem desconto) */
    descontoPix: 0,

    /* Para onde enviar o pedido ao clicar em "Pagar".
       Deixe '' e o formulário só valida e mostra um resumo (modo demo).

       Quando você contratar a plataforma (Hubla, Kiwify, Cakto,
       Mercado Pago...), coloque aqui a URL de checkout dela.
       Os dados preenchidos vão como parâmetros na URL.         */
    urlDestino: '',

    /* Página para onde ir após o pagamento aprovado */
    urlObrigado: 'obrigado.html'
  }
};
