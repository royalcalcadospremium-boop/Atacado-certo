/*
 * lp-shared.js — Landing Pages (atacado/dropshipping/varejo)
 * - Scroll reveal via IntersectionObserver (respeita prefers-reduced-motion)
 * - Video pause when offscreen (economiza bateria/dados)
 * - Smooth scroll para âncoras
 */

(function () {
  'use strict';

  // 1. Scroll reveal — anexa observer em todos elementos .lp-reveal
  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Sem animação — torna tudo visível imediatamente
      document.querySelectorAll('.lp-reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }
    if (!('IntersectionObserver' in window)) {
      // Browser sem suporte — fallback: visível direto
      document.querySelectorAll('.lp-reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Stagger leve por delay baseado em ordem dentro do parent
          const siblings = Array.from(
            entry.target.parentElement.querySelectorAll('.lp-reveal:not(.is-visible)')
          );
          const idx = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = Math.min(idx, 5) * 80 + 'ms';
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.lp-reveal').forEach(el => observer.observe(el));
  }

  // 2. Pause vídeos hero quando saem da viewport (perf)
  function initVideoVisibilityPause() {
    if (!('IntersectionObserver' in window)) return;
    const videos = document.querySelectorAll('.lp-hero__video');
    if (videos.length === 0) return;
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => { /* autoplay block — ignora */ });
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.1 });
    videos.forEach(v => observer.observe(v));
  }

  // 3. Respeitar prefers-reduced-motion em vídeos (substitui por poster)
  function initReducedMotionVideos() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.lp-hero__video').forEach(v => {
      v.removeAttribute('autoplay');
      v.pause();
      v.style.display = 'none';
    });
  }

  // 4. Smooth scroll para âncoras internas (#cta, #faq, etc)
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (href === '#' || href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function init() {
    initReducedMotionVideos();
    initScrollReveal();
    initVideoVisibilityPause();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
