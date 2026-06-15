/* WaveOps — interactions */
(function () {
  'use strict';

  /* ---- Anti-bot: tempo de preenchimento (SPEC-09 / hardening item 2) ----
     Bots que renderizam a página costumam enviar quase instantaneamente.
     Submits abaixo do limiar são tratados como bot: mostram sucesso, mas
     não disparam o POST (mesma lógica silenciosa do honeypot). Bots que
     batem direto no webhook ignoram isto: a defesa real é no n8n.
     Ver docs/specs/SECURITY-n8n-hardening.md. */
  const pageLoadedAt = Date.now();
  const MIN_FILL_MS = 1200;
  const fillTimeMs = () => Date.now() - pageLoadedAt;

  /* ---- Analytics helper (SPEC-02). No-op até você ativar Plausible/GA no <head>. ---- */
  function track(event, props) {
    try {
      if (window.plausible) window.plausible(event, { props: props || {} });
      if (typeof window.gtag === 'function') window.gtag('event', event, props || {});
    } catch (e) {}
  }

  // ===================================================================
  // PONTO DE INTEGRAÇÃO COM O BACK-END (SPEC-01)
  // Webhook n8n compartilhado pelos dois formulários (lead principal e
  // checklist). O campo "origem" diferencia de onde veio o lead.
  // Enquanto LEAD_ENDPOINT estiver vazio, nada é enviado: avisa no
  // console e segue o fluxo de sucesso, sem quebrar a página.
  // ===================================================================
  const LEAD_ENDPOINT = 'https://cowboyhouse.app.n8n.cloud/webhook/flowops-lead';

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
  const hamburger = document.getElementById('hamburger');
  const mobileClose = document.getElementById('mobile-close');
  const open = () => {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    mobileClose?.focus();
  };
  const close = () => {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    hamburger?.focus();
  };
  hamburger?.addEventListener('click', open);
  mobileClose?.addEventListener('click', close);
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && menu.classList.contains('open')) close();
  });

  /* ---- Respeita "reduzir movimento": pausa os beads SVG (SMIL) do canvas ---- */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('svg.flow-wires').forEach((svg) => { try { svg.pauseAnimations(); } catch (e) {} });
  }

  /* ---- FAQ accordion (single open) ---- */
  const items = document.querySelectorAll('.faq-item');
  items.forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = null;
        other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot anti-spam (SPEC-01): humano não vê o campo, bot preenche.
      const hp = form.querySelector('#f-website');
      const elapsed = fillTimeMs();
      if ((hp && hp.value.trim() !== '') || elapsed < MIN_FILL_MS) {
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
        preenchidoEmMs: elapsed,
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

  /* ---- Lead magnet: baixar checklist (SPEC-09) ---- */
  const clForm = document.getElementById('checklist-form');
  if (clForm) {
    const CHECKLIST_PDF = 'assets/waveops-checklist.pdf';
    const emailEl = document.getElementById('cl-email');
    const nomeEl = document.getElementById('cl-nome');
    const clBtn = clForm.querySelector('button[type="submit"]');
    const clOk = document.getElementById('checklist-success');
    const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    function downloadChecklist() {
      const a = document.createElement('a');
      a.href = CHECKLIST_PDF;
      a.download = 'waveops-checklist.pdf';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    clForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot anti-spam + tempo de preenchimento.
      const hp = clForm.querySelector('#cl-website');
      const elapsed = fillTimeMs();
      if ((hp && hp.value.trim() !== '') || elapsed < MIN_FILL_MS) {
        clForm.style.display = 'none';
        clOk.classList.add('show');
        return;
      }

      const email = (emailEl.value || '').trim();
      const okEmail = isEmail(email);
      emailEl.closest('.field').classList.toggle('invalid', !okEmail);
      if (!okEmail) { emailEl.focus(); return; }

      const data = {
        nome: (nomeEl?.value || '').trim(),
        empresa: '',
        whatsapp: '',
        email: email,
        dor: 'Baixou o checklist',
        mensagem: 'Lead do material: 7 sinais de operação manual',
        origem: 'lead-magnet-checklist',
        enviadoEm: new Date().toISOString(),
        preenchidoEmMs: elapsed,
      };
      Object.assign(data, readUTM());

      const original = clBtn.textContent;
      clBtn.disabled = true;
      clBtn.textContent = 'Liberando...';

      try {
        await submitLead(data);
        track('checklist_download', { email_dominio: email.split('@')[1] || '' });
        downloadChecklist();
        clForm.style.display = 'none';
        clOk.classList.add('show');
      } catch (err) {
        console.error('[WaveOps] erro ao registrar download do checklist:', err);
        // Não trava o usuário: entrega o material mesmo se o registro falhar.
        downloadChecklist();
        track('checklist_download', { email_dominio: email.split('@')[1] || '', registro: 'falhou' });
        clForm.style.display = 'none';
        clOk.classList.add('show');
      }
    });
  }
})();
