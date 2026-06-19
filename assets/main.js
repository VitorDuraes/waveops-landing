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
    hamburger?.setAttribute('aria-expanded', 'true');
    hamburger?.setAttribute('aria-label', 'Fechar menu');
    mobileClose?.focus();
  };
  const close = () => {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    hamburger?.setAttribute('aria-expanded', 'false');
    hamburger?.setAttribute('aria-label', 'Abrir menu');
    hamburger?.focus();
  };
  if (hamburger) {
    hamburger.setAttribute('aria-controls', 'mobile-menu');
    hamburger.setAttribute('aria-expanded', 'false');
  }
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
  items.forEach((item, i) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    const aid = 'faq-a-' + i;
    a.id = aid;
    q.setAttribute('type', 'button');
    q.setAttribute('aria-expanded', 'false');
    q.setAttribute('aria-controls', aid);
    a.setAttribute('aria-hidden', 'true'); // leitor de tela ignora resposta colapsada
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        other.classList.remove('open');
        const oa = other.querySelector('.faq-a');
        oa.style.maxHeight = null;
        oa.setAttribute('aria-hidden', 'true');
        other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        a.setAttribute('aria-hidden', 'false');
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---- Calculadora de ROI (SPEC-12). Ancora no valor perdido, não no preço.
     Perda = leads perdidos x ticket + horas manuais x custo/hora. ---- */
  const roi = document.getElementById('roi');
  if (roi) {
    const lossEl = document.getElementById('roi-loss');
    const fmt = new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
    });
    const val = (id) => {
      const el = document.getElementById(id);
      const n = el ? parseFloat(el.value) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const calcRoi = () => {
      const perdaLeads = val('roi-leads') * val('roi-ticket');
      const perdaHoras = val('roi-horas') * val('roi-custo');
      lossEl.textContent = fmt.format(perdaLeads + perdaHoras);
    };
    roi.querySelectorAll('input').forEach((i) => i.addEventListener('input', calcRoi));
    calcRoi();
  }

  /* ---- Toggle de cobrança Mensal / Anual (anual pré-selecionado).
     Troca o preço exibido em cada plano via data-attributes. ---- */
  const billing = document.querySelector('.billing');
  if (billing) {
    const opts = billing.querySelectorAll('.tab[data-billing]');
    const planCards = document.querySelectorAll('.plan[data-m]');
    const status = document.getElementById('billing-status');
    const applyBilling = (mode, announce) => {
      opts.forEach((o) => {
        const on = o.dataset.billing === mode;
        o.classList.toggle('active', on);
        o.setAttribute('aria-pressed', String(on));
      });
      planCards.forEach((card) => {
        const v = card.querySelector('.pprice .v');
        const note = card.querySelector('[data-bill-note]');
        if (mode === 'anual') {
          if (v) v.textContent = 'R$' + card.dataset.a;
          if (note) note.textContent = 'cobrado R$' + card.dataset.at + '/ano';
        } else {
          if (v) v.textContent = 'R$' + card.dataset.m;
          if (note) note.textContent = 'no plano mensal';
        }
      });
      // announce = troca feita pelo usuário (clique). No load não anuncia nem registra evento.
      if (announce) {
        if (status) status.textContent = mode === 'anual' ? 'Mostrando preços anuais.' : 'Mostrando preços mensais.';
        track('billing_toggle', { modo: mode });
      }
    };
    opts.forEach((o) => o.addEventListener('click', () => applyBilling(o.dataset.billing, true)));
    applyBilling('anual', false); // anual pré-selecionado, sem anúncio no load
  }

  /* ---- Carrossel de casos de uso (coverflow). Um card no centro, dois nas
     laterais em perspectiva, um escondido atrás. Gira sozinho: o ativo avança
     a cada DELAY ms, o card da direita assume o centro e assim por diante.
     Pausa no hover/foco, clique numa lateral a traz pro centro, setas e dots
     controlam à mão. Em "reduzir movimento" não gira sozinho. ---- */
  const cv = document.getElementById('cases-coverflow');
  if (cv) {
    const cvCards = Array.prototype.slice.call(cv.querySelectorAll('.case-card'));
    const cvN = cvCards.length;
    const cvDotsWrap = cv.querySelector('.cases-dots');
    const cvReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CV_DELAY = 3000;
    let cvActive = 0;
    let cvTimer = null;

    // o CSS usa --cv-delay para sincronizar a barra de progresso do dot ativo.
    cv.style.setProperty('--cv-delay', CV_DELAY + 'ms');

    const cvDots = cvCards.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cases-dot';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Ir para o caso ' + (i + 1));
      b.innerHTML = '<span class="cases-dot-fill"></span>';
      b.addEventListener('click', () => cvGo(i));
      cvDotsWrap.appendChild(b);
      return b;
    });

    function cvRender() {
      cvCards.forEach((card, i) => {
        // distância até o ativo, normalizada para o caminho mais curto (wrap).
        let off = i - cvActive;
        if (off > cvN / 2) off -= cvN;
        if (off < -cvN / 2) off += cvN;
        card.classList.remove('is-center', 'is-left', 'is-right', 'is-back');
        if (off === 0) card.classList.add('is-center');
        else if (off === 1) card.classList.add('is-right');
        else if (off === -1) card.classList.add('is-left');
        else card.classList.add('is-back');
        const isCenter = off === 0;
        card.setAttribute('aria-hidden', String(!isCenter));
        const link = card.querySelector('.case-cta');
        if (link) link.setAttribute('tabindex', isCenter ? '0' : '-1');
      });
      cvDots.forEach((d, i) => {
        const on = i === cvActive;
        d.classList.toggle('active', on);
        d.setAttribute('aria-selected', String(on));
      });
    }

    const cvAdvance = () => { cvActive = (cvActive + 1) % cvN; cvRender(); };
    function cvStart() { if (!cvReduce && !cvTimer) cvTimer = window.setInterval(cvAdvance, CV_DELAY); }
    function cvStop() { if (cvTimer) { clearInterval(cvTimer); cvTimer = null; } }
    function cvGo(i) { cvActive = ((i % cvN) + cvN) % cvN; cvRender(); cvStop(); cvStart(); }

    cvCards.forEach((card, i) => card.addEventListener('click', (e) => {
      if (!card.classList.contains('is-center')) { e.preventDefault(); cvGo(i); }
    }));
    cv.addEventListener('mouseenter', cvStop);
    cv.addEventListener('mouseleave', cvStart);
    cv.addEventListener('focusin', cvStop);
    cv.addEventListener('focusout', cvStart);

    cvRender();
    cvStart();
  }

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
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    };
    fields.forEach((field, i) => {
      const input = field.querySelector('input, select');
      const err = field.querySelector('.err');
      if (input && err) {
        if (!err.id) err.id = 'lead-err-' + i;
        input.setAttribute('aria-describedby', err.id);
      }
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
    const clErr = emailEl?.closest('.field')?.querySelector('.err');
    if (emailEl && clErr) {
      if (!clErr.id) clErr.id = 'cl-email-err';
      emailEl.setAttribute('aria-describedby', clErr.id);
    }

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
      emailEl.setAttribute('aria-invalid', String(!okEmail));
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

  /* ---- A11y: esconde SVGs decorativos dos leitores de tela.
     Todos os icones aqui acompanham texto; os que carregam significado
     usam aria-label/role="img" e sao preservados pelo seletor. ---- */
  document.querySelectorAll('svg:not([aria-label]):not([role="img"])').forEach((svg) => {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  });
})();
