// @ts-check
/* WaveOps · entrada do site, o desenho (Tarefa 13B). Ver dev/site/README.md, "Entrada do site". */
const ABRE = 600;
const FIM = 1450;
const raiz = document.documentElement;
/** @param {string} estado */
const marcar = (estado) => { raiz.dataset.chegada = estado; };
/** @param {number} x */
const lim = (x) => Math.min(1, Math.max(0, x));
/** @param {number} x */
const saida = (x) => 1 - (1 - lim(x)) ** 3;

export function iniciarChegada() {
  const camada = document.querySelector('[data-chegada-camada]');
  const ctx = camada?.querySelector('canvas')?.getContext('2d');
  const trava = camada?.getAnimations()[0];
  const relogio = () => Number(trava?.currentTime);
  if (!ctx || !(relogio() < ABRE)) return marcar('feita');
  const cascata = [...document.querySelectorAll('[data-entrada]')].flatMap((el) => el.getAnimations());
  const estilo = getComputedStyle(raiz);
  const [NOITE, BRANCO, BRILHO, ...CORES] = ['noite-hero', 'branco', 'marca-escuro', 'violeta', 'marca-claro', 'violeta-texto', 'marca-escuro']
    .map((nome) => estilo.getPropertyValue('--wo-' + nome).trim());
  const dpr = Math.min(devicePixelRatio, 2);
  const L = innerWidth;
  const A = innerHeight;
  const diag = Math.hypot(L, A) / 2;
  const s = Math.min(2.8, Math.max(1.1, Math.min(L, A) * 0.004));
  ctx.canvas.width = L * dpr;
  ctx.canvas.height = A * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, (L * dpr) / 2, (A * dpr) / 2);


  /** @param {number} t */
  const desenhar = (t) => {
    const r0 = 9 * s;
    const q = lim((t - ABRE) / (FIM - ABRE));
    const R = r0 * ((diag + 70) / r0) ** (1 - (1 - q) ** 2);
    const traco = 5 * s * (r0 / R) ** 0.3;
    const fecha = saida((t - 80) / 240);
    // O hub é vazado: quando o anel abre, a noite tem um furo de borda macia do tamanho dele.
    const furo = q > 0 ? R - traco / 2 : 0.1;
    const g = ctx.createRadialGradient(0, 0, furo - Math.min(furo / 8, 48), 0, 0, furo);
    g.addColorStop(0, NOITE + '00');
    g.addColorStop(1, NOITE);
    ctx.globalCompositeOperation = 'copy';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(-L, -A, 2 * L, 2 * A);
    ctx.globalCompositeOperation = 'lighter';
    let semente = 11;
    const sorte = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < (L < 768 ? 66 : 108); i++) {
      const f = Math.floor(i / 6);
      const h = (f * 0.618) % 1;
      const ang = f * 2.4 + sorte() * 0.07;
      const fase = f * 2.1 + sorte() * 0.35 - t / 250;
      const longe = (0.8 + sorte() * 0.5) * diag - r0;
      const p = (t - ABRE - sorte() * 80) / (600 + sorte() * 300);
      const cauda = 0.3 + sorte() * 0.25;
      const larg = 0.6 + sorte() * 1.1;
      /** @param {number} r @returns {[number, number]} */
      const ponto = (r) => {
        const u = r / diag;
        const a = ang + (h - 0.5) * u;
        const lado = (0.05 + h * 0.04) * diag * Math.sin(6.28 * (1.15 - h * 0.6) * u + fase) * Math.min(1, u * 4);
        return [Math.cos(a) * r - Math.sin(a) * lado, Math.sin(a) * r + Math.cos(a) * lado];
      };
      const rabo = Math.max(furo, r0 + longe * saida(p - cauda));
      const ponta = r0 + longe * saida(p);
      if (ponta <= rabo) continue;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) ctx.lineTo(...ponto(rabo + ((ponta - rabo) * k) / 24));
      const brilho = ctx.createLinearGradient(...ponto(rabo), ...ponto(ponta));
      brilho.addColorStop(0, CORES[i % 4] + '00');
      brilho.addColorStop(1, CORES[i % 4]);
      const al = lim(p * 6) * lim((1 + cauda - p) * 2);
      ctx.strokeStyle = brilho;
      ctx.globalAlpha = al;
      ctx.lineWidth = larg;
      ctx.stroke();
      ctx.globalAlpha = al * 0.3;
      ctx.lineWidth = larg * 5;
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, R, -1.57, 6.28 * fecha - 1.57);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - q * q;
    ctx.strokeStyle = BRANCO;
    ctx.lineWidth = traco;
    ctx.shadowColor = BRILHO;
    ctx.shadowBlur = (12 + 60 * Math.exp(-(((t - 560) / 120) ** 2))) * dpr;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const marca = 1 - lim((q - 0.25) * 2.2);
    const onda = lim((t - 300) / 260) * 2;
    for (const [a, b, c, d, lado, k, acende] of [[18, 30, 33, 41, -1, onda, 180], [59, 70, 67, 82, 1, onda - 1, 230]]) {
      const x = (R - r0) * lado;
      ctx.globalAlpha = marca;
      ctx.lineWidth = 5 * s;
      ctx.setLineDash([32 * s, 32 * s]);
      ctx.lineDashOffset = 32 * s * (1 - lim(k));
      ctx.beginPath();
      ctx.moveTo((a - 50) * s + x, 0);
      ctx.quadraticCurveTo((b - 50) * s + x, (c - 50) * s, (d - 50) * s + x, 0);
      if (k > 0) ctx.stroke();
      ctx.setLineDash([]);
      const acesa = lim((t - acende) / 150);
      ctx.fillStyle = BRANCO;
      ctx.beginPath();
      ctx.arc(32 * s * lado + x, 0, 7.5 * s * saida(acesa), 0, 7);
      ctx.fill();
    }
  };

  let pedido = 0;
  let aberto = false;
  const fim = new AbortController();
  const recomecar = () => {
    aberto = true;
    for (const a of cascata) {
      a.cancel();
      a.play();
    }
  };
  const parar = () => {
    fim.abort();
    cancelAnimationFrame(pedido);
  };
  const encerrar = () => {
    parar();
    marcar('feita');
    ctx.canvas.width = 0;
  };
  /** @param {Event} evento */
  const pular = (evento) => {
    if (!aberto) recomecar();
    parar();
    marcar('saindo');
    if (evento.type != 'pointerdown') return void setTimeout(encerrar, 200);
    // Sai só quando o dedo solta: o clique do toque cai na camada, não na página.
    const solta = new AbortController();
    for (const tipo of ['pointerup', 'pointercancel']) {
      addEventListener(tipo, () => {
        solta.abort();
        setTimeout(encerrar, 200);
      }, { signal: solta.signal });
    }
  };
  const quadro = () => {
    const t = relogio();
    if (!(t < FIM) || trava?.playState === 'finished') return encerrar();
    if (!aberto && t >= ABRE) {
      recomecar();
      marcar('abrindo');
    }
    desenhar(t);
    pedido = requestAnimationFrame(quadro);
  };
  for (const tipo of ['pointerdown', 'keydown', 'wheel', 'visibilitychange']) addEventListener(tipo, pular, { passive: true, capture: true, signal: fim.signal });
  desenhar(relogio());
  marcar('desenhando');
  pedido = requestAnimationFrame(quadro);
}

// O primeiro quadro só vem com o CSS aplicado, e com ele a trava.
const comecar = () => requestAnimationFrame(iniciarChegada);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar, { once: true });
else comecar();
