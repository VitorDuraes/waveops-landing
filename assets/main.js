/* WaveOps — interactions */
(function () {
  'use strict';

  /* ---- Analytics helper (SPEC-02). No-op até você ativar Plausible/GA no <head>. ---- */
  function track(event, props) {
    try {
      if (window.plausible) window.plausible(event, { props: props || {} });
      if (typeof window.gtag === 'function') window.gtag('event', event, props || {});
    } catch (e) {}
  }

  /* ---- Nav scrolled state ---- */
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 12) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Theme toggle (shares FlowTheme store) ---- */
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn && window.FlowTheme) {
    themeBtn.addEventListener('click', () => window.FlowTheme.toggleTheme());
  }

  /* ---- Mobile menu ---- */
  const menu = document.getElementById('mobile-menu');
  const open = () => menu.classList.add('open');
  const close = () => menu.classList.remove('open');
  document.getElementById('hamburger')?.addEventListener('click', open);
  document.getElementById('mobile-close')?.addEventListener('click', close);
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));

  /* ---- FAQ accordion (single open) ---- */
  const items = document.querySelectorAll('.faq-item');
  items.forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ---- Pricing tabs ---- */
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.tab;
      document.querySelectorAll('.pricing-panel').forEach((p) => p.classList.remove('active'));
      document.getElementById('panel-' + key)?.classList.add('active');
      track('pricing_tab', { plano: key });
    });
  });

  /* ---- WhatsApp click tracking (SPEC-02) ---- */
  document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
    a.addEventListener('click', () => {
      const local = a.closest('.hero') ? 'hero' : a.closest('footer') ? 'rodape' : (a.id === 'wa-btn' ? 'contato' : 'outro');
      track('whatsapp_click', { local: local });
    });
  });

  /* ---- Reveal on scroll (scroll-based, no IntersectionObserver) ---- */
  document.documentElement.classList.add('anim');
  let revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  const checkReveal = () => {
    const trigger = window.innerHeight * 0.92;
    for (let i = revealEls.length - 1; i >= 0; i--) {
      const el = revealEls[i];
      if (el.getBoundingClientRect().top < trigger) {
        el.classList.add('is-visible');
        revealEls.splice(i, 1);
      }
    }
  };
  checkReveal();
  window.addEventListener('scroll', checkReveal, { passive: true });
  window.addEventListener('resize', checkReveal);
  // Safety net: never leave content hidden.
  setTimeout(() => { document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible')); }, 1800);

  /* ---- Scrollspy nav highlight (scroll-based) ---- */
  const sections = ['servicos', 'como', 'pacotes', 'publicos', 'faq'];
  const linkFor = {};
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const id = a.getAttribute('href').replace('#', '');
    linkFor[id] = a;
  });
  const spy = () => {
    const mid = window.innerHeight * 0.42;
    let current = null;
    sections.forEach((id) => {
      const s = document.getElementById(id);
      if (!s) return;
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) current = id;
    });
    Object.keys(linkFor).forEach((id) => linkFor[id].classList.toggle('active', id === current));
  };
  spy();
  window.addEventListener('scroll', spy, { passive: true });

  /* ---- Lead form validation ---- */
  const form = document.getElementById('lead-form');
  if (form) {
    const fields = form.querySelectorAll('[data-field]');
    const validateField = (field) => {
      const input = field.querySelector('input, select');
      if (!input) return true;
      let ok = input.value.trim() !== '';
      if (ok && input.type === 'tel') {
        const digits = input.value.replace(/\D/g, '');
        ok = digits.length >= 8;
      }
      field.classList.toggle('invalid', !ok);
      return ok;
    };
    fields.forEach((field) => {
      const input = field.querySelector('input, select');
      input?.addEventListener('input', () => { if (field.classList.contains('invalid')) validateField(field); });
      input?.addEventListener('blur', () => validateField(field));
    });
    const submitBtn = form.querySelector('button[type="submit"]');

    // ===================================================================
    // PONTO DE INTEGRAÇÃO COM O BACK-END (SPEC-01)
    // 1. Crie um webhook no n8n (ou um form no Formspree / Web3Forms).
    // 2. Cole a URL em LEAD_ENDPOINT abaixo.
    // Enquanto LEAD_ENDPOINT estiver vazio, o formulário NÃO captura de
    // verdade: ele avisa no console e mostra sucesso, sem quebrar a página.
    // ===================================================================
    const LEAD_ENDPOINT = 'https://cowboyhouse.app.n8n.cloud/webhook/flowops-lead'; // webhook n8n (SPEC-01)

    function readUTM() {
      const p = new URLSearchParams(window.location.search);
      const g = (k) => p.get(k) || '';
      return {
        utm_source: g('utm_source'), utm_medium: g('utm_medium'), utm_campaign: g('utm_campaign'),
        utm_content: g('utm_content'), utm_term: g('utm_term'),
        referrer: document.referrer || '', landingUrl: window.location.href,
      };
    }

    async function submitLead(data) {
      if (!LEAD_ENDPOINT) {
        console.warn('[WaveOps] LEAD_ENDPOINT não configurado: o lead NÃO foi enviado. Configure em assets/main.js (SPEC-01).', data);
        return;
      }
      const res = await fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Falha ao enviar lead: ' + res.status);
      return res.json().catch(() => ({}));
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot anti-spam (SPEC-01): humano não vê o campo, bot preenche.
      const hp = form.querySelector('#f-website');
      if (hp && hp.value.trim() !== '') {
        form.style.display = 'none';
        document.getElementById('form-success').classList.add('show');
        return;
      }

      let allOk = true;
      fields.forEach((field) => { if (!validateField(field)) allOk = false; });
      if (!allOk) {
        form.querySelector('.field.invalid input, .field.invalid select')?.focus();
        return;
      }

      const data = {
        nome: form.querySelector('#f-nome').value.trim(),
        empresa: form.querySelector('#f-empresa').value.trim(),
        whatsapp: form.querySelector('#f-zap').value.trim(),
        dor: form.querySelector('#f-dor').value,
        mensagem: form.querySelector('#f-msg').value.trim(),
        origem: 'landing',
        enviadoEm: new Date().toISOString(),
      };
      Object.assign(data, readUTM());

      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      try {
        await submitLead(data);
        track('lead_form_submit', { dor: data.dor });
        const name = (data.nome || 'pessoa').split(' ')[0];
        document.getElementById('success-name').textContent = name;
        form.style.display = 'none';
        document.getElementById('form-success').classList.add('show');
      } catch (err) {
        console.error('[WaveOps] erro ao enviar lead:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        alert('Não consegui enviar agora. Tente de novo em instantes.');
      }
    });
  }
})();
