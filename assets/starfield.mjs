/* WaveOps: campo de partículas do hero, em JavaScript puro.

   Porte do componente que veio do Framer como island React. A física, o desenho
   e a calibração continuam iguais: o que saiu foi o React. Ele custava 61,2 KB
   gzip (react, react-dom-client e jsx-runtime) para montar um <canvas> sem
   estado compartilhado, sem componente filho e sem árvore de UI.

   O que era estado do React virou estado de módulo:
   - `paused` era prop. Mudar a prop derrubava o efeito inteiro e reconstruía a
     grade. Agora é `definirPausa()`, que só liga ou desliga o laço e repinta.
   - `dotColor` e `theme` eram props. Agora é `definirCores()`, alimentado pelos
     tokens CSS. Nenhuma cor mora aqui dentro.
   A montagem, que morava em starfield-mount.mjs, desceu para o fim deste
   arquivo. Um arquivo a menos no caminho crítico e uma versão a menos para
   lembrar de subir.

   Cache-busting: o `?v=` do <script> do index.html não alcança sub-import
   relativo. O único sub-import daqui é o scroll-signal.mjs, e ele leva a versão
   no próprio especificador. Ao mexer neste arquivo ou no scroll-signal, suba a
   data nos dois lugares e no <script> do index.html. */

import { createScrollSignal } from './scroll-signal.mjs?v=20260911';

// Teto de pontos. O gap cresce sozinho quando o canvas é grande.
const MAX_DOTS_PADRAO = 8000;

/** Converte cor de token CSS (hex ou rgb/rgba) para a tripla "r,g,b". */
function corParaRgb(cor) {
  // rgba(r,g,b,a) ou rgb(r,g,b), que é o formato que os tokens usam hoje.
  const casaRgba = cor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (casaRgba) return casaRgba[1] + ',' + casaRgba[2] + ',' + casaRgba[3];
  // Hex curto (#fff), longo (#ffffff) ou com alfa (#ffffffaa).
  const h = cor.replace('#', '');
  const expandido = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h.slice(0, 6);
  const num = parseInt(expandido, 16);
  return ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255);
}

/** Orçamento de pontos, teto de DPR e brilho conforme o aparelho. */
function perfilDoDispositivo(tetoDoUsuario) {
  if (typeof window === 'undefined') {
    return { dprCap: 2, dotBudget: tetoDoUsuario, minGap: 10, enableGlow: true };
  }
  const w = window.innerWidth;
  const temToque = navigator.maxTouchPoints > 1;
  const celular = w < 768;
  const tablet = w >= 768 && w < 1024 && temToque;
  if (celular) return { dprCap: 1, dotBudget: Math.min(tetoDoUsuario, 1500), minGap: 16, enableGlow: false };
  if (tablet) return { dprCap: 1.5, dotBudget: Math.min(tetoDoUsuario, 3500), minGap: 12, enableGlow: true };
  return { dprCap: 2, dotBudget: tetoDoUsuario, minGap: 10, enableGlow: true };
}

/**
 * Cria o campo de partículas dentro de um contêiner.
 * @param {HTMLElement} container elemento que recebe o canvas e define o tamanho.
 * @param {object} [opcoes] mesmos nomes de parâmetro do componente original.
 * @returns {{definirPausa:(v:boolean)=>void, definirCores:(t:object)=>void, destruir:()=>void}}
 */
export function criarStarfield(container, opcoes) {
  const {
    dotColor = '#ffffff',
    dotColorLight = '#18181b',
    theme = 'dark',
    gap: gapPedido = 10,
    baseRadius = 1.2,
    padding = 8,
    influenceRadius = 90,
    pushStrength = 14,
    glowBoost = 0.55,
    shootingStarsEnabled = true,
    shootingStarMinInterval = 3,
    shootingStarMaxInterval = 6,
    shootingStarTrailLength = 35,
    breatheEnabled = true,
    twinkleEnabled = true,
    maxDots = MAX_DOTS_PADRAO,
    paused = false,
    scrollPush = 18,
  } = opcoes || {};

  let rgb = corParaRgb(theme === 'light' ? dotColorLight : dotColor);
  let pausado = Boolean(paused);
  let visivel = true;
  let quadro = 0;
  let estado = null;

  const device = perfilDoDispositivo(maxDots);

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // ── Monta a grade de pontos e o índice espacial da interação de cursor. ──
  function construirGrade(W, H) {
    const dpr = Math.min(window.devicePixelRatio, device.dprCap);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // O gap sobe sozinho para o número de pontos nunca passar do orçamento.
    const budget = device.dotBudget;
    let gap = Math.max(gapPedido, device.minGap);
    const colunasIngenuas = Math.floor((W - padding * 2) / gap) + 1;
    const linhasIngenuas = Math.floor((H - padding * 2) / gap) + 1;
    if (colunasIngenuas * linhasIngenuas > budget) {
      gap = Math.ceil(Math.sqrt((W * H) / budget));
      if (gap < gapPedido) gap = gapPedido;
    }

    const cols = Math.floor((W - padding * 2) / gap) + 1;
    const rows = Math.floor((H - padding * 2) / gap) + 1;
    const count = cols * rows;
    const offsetX = (W - (cols - 1) * gap) / 2;
    const offsetY = (H - (rows - 1) * gap) / 2;

    const baseX = new Float32Array(count);
    const baseY = new Float32Array(count);
    const posX = new Float32Array(count);
    const posY = new Float32Array(count);
    const velX = new Float32Array(count);
    const velY = new Float32Array(count);
    const dotRadius = new Float32Array(count);
    const dotBaseAlpha = new Float32Array(count);
    // 0 = ponto, 1 = estrela pequena, 2 = média, 3 = brilhante.
    const dotType = new Uint8Array(count);
    const twinklePhase = new Float32Array(count);
    const twinkleSpeed = new Float32Array(count);
    const starRotation = new Float32Array(count);

    // Listas por tipo, para desenhar em lote e trocar menos estado do contexto.
    const typeIndices = [[], [], [], []];

    const brightThresh = 0.98 + Math.random() * 0.012;
    const medThresh = 0.945 + Math.random() * 0.025;
    const smallThresh = 0.86 + Math.random() * 0.05;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = offsetX + c * gap;
        const y = offsetY + r * gap;
        baseX[idx] = x;
        baseY[idx] = y;
        posX[idx] = x;
        posY[idx] = y;

        const roll = Math.random();
        if (roll > brightThresh) {
          dotType[idx] = 3;
          dotRadius[idx] = 3 + Math.random() * 1.5;
          dotBaseAlpha[idx] = 0.7 + Math.random() * 0.3;
          twinkleSpeed[idx] = 0.4 + Math.random() * 1;
        } else if (roll > medThresh) {
          dotType[idx] = 2;
          dotRadius[idx] = 2 + Math.random() * 0.8;
          dotBaseAlpha[idx] = 0.4 + Math.random() * 0.25;
          twinkleSpeed[idx] = 0.6 + Math.random() * 1.8;
        } else if (roll > smallThresh) {
          dotType[idx] = 1;
          dotRadius[idx] = 1.4 + Math.random() * 0.4;
          dotBaseAlpha[idx] = 0.22 + Math.random() * 0.15;
          twinkleSpeed[idx] = 0.8 + Math.random() * 2.5;
        } else {
          dotType[idx] = 0;
          dotRadius[idx] = baseRadius;
          dotBaseAlpha[idx] = 0.16 + Math.random() * 0.1;
          twinkleSpeed[idx] = 0;
        }

        if (dotType[idx] > 0) {
          baseX[idx] += (Math.random() - 0.5) * gap * 0.8;
          baseY[idx] += (Math.random() - 0.5) * gap * 0.8;
          posX[idx] = baseX[idx];
          posY[idx] = baseY[idx];
        }

        twinklePhase[idx] = Math.random() * Math.PI * 2;
        starRotation[idx] = Math.random() * Math.PI * 0.5;
        typeIndices[dotType[idx]].push(idx);
      }
    }

    // Hash espacial: o cursor só varre as células vizinhas, não os 2 mil pontos.
    const cellSize = influenceRadius;
    const gridCols = Math.ceil(W / cellSize) + 1;
    const gridRows = Math.ceil(H / cellSize) + 1;
    const spatialGrid = new Array(gridCols * gridRows);
    for (let i = 0; i < spatialGrid.length; i++) spatialGrid[i] = [];
    for (let i = 0; i < count; i++) {
      const gc = Math.floor(baseX[i] / cellSize);
      const gr = Math.floor(baseY[i] / cellSize);
      if (gc >= 0 && gc < gridCols && gr >= 0 && gr < gridRows) {
        spatialGrid[gr * gridCols + gc].push(i);
      }
    }

    return {
      W, H, dpr, cols, rows, count, gap,
      baseX, baseY, posX, posY, velX, velY,
      dotRadius, dotBaseAlpha, dotType,
      twinklePhase, twinkleSpeed, starRotation,
      typeIndices, spatialGrid, gridCols, gridRows, cellSize,
      shootingStars: [],
      nextShoot: 2 + Math.random() * 4,
      mouseX: -9999, mouseY: -9999, mouseInside: false,
      smoothX: -9999, smoothY: -9999,
      // Alfa e raio calculados para o quadro atual, sem realocar por frame.
      frameAlpha: new Float32Array(count),
      frameRadius: new Float32Array(count),
      mouseAffected: new Uint8Array(count),
      enableGlow: device.enableGlow,
    };
  }

  // Tabela de seno e cosseno da estrela de 8 pontas, calculada uma vez só.
  const starCos = new Float64Array(8);
  const starSin = new Float64Array(8);
  for (let j = 0; j < 8; j++) {
    const angulo = (j * Math.PI) / 4;
    starCos[j] = Math.cos(angulo);
    starSin[j] = Math.sin(angulo);
  }

  /** Respiração: duas ondas lentas cruzadas, só nos pontos comuns. */
  function alfaDaRespiracao(x, y, t) {
    const onda1 = Math.sin(x * 0.012 + y * 0.008 + t * 0.6) * 0.5 + 0.5;
    const onda2 = Math.sin(x * 0.007 - y * 0.011 + t * 0.4) * 0.5 + 0.5;
    return onda1 * 0.3 + onda2 * 0.2;
  }

  // Alfa quantizado: menos troca de fillStyle por quadro.
  const PASSOS_DE_ALFA = 64;
  function quantizarAlfa(a) {
    return Math.round(a * PASSOS_DE_ALFA) / PASSOS_DE_ALFA;
  }

  /** Desenha o contorno da estrela de 8 pontas já rotacionada. */
  function tracarEstrela(px, py, outerR, rot) {
    const innerR = outerR * 0.3;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const r = k % 2 === 0 ? outerR : innerR;
      const lx = px + (starCos[k] * cosR - starSin[k] * sinR) * r;
      const ly = py + (starCos[k] * sinR + starSin[k] * cosR) * r;
      if (k === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** Halo radial em volta das estrelas médias e brilhantes. */
  function desenharHalo(px, py, outerR, glowR, glowA) {
    const grad = ctx.createRadialGradient(px, py, outerR * 0.2, px, py, glowR);
    grad.addColorStop(0, 'rgba(' + rgb + ',' + glowA + ')');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.beginPath();
    ctx.arc(px, py, glowR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /** Cruz de raios das estrelas brilhantes. */
  function desenharRaios(px, py, outerR, rot, alfa) {
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const rayLen = outerR * 3.5;
    ctx.strokeStyle = 'rgba(' + rgb + ',' + alfa * 0.2 + ')';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(px - cosR * rayLen, py - sinR * rayLen);
    ctx.lineTo(px + cosR * rayLen, py + sinR * rayLen);
    ctx.moveTo(px - sinR * rayLen, py + cosR * rayLen);
    ctx.lineTo(px + sinR * rayLen, py - cosR * rayLen);
    ctx.stroke();
  }

  /* Quadro parado, em t = 0. É ele que garante que pausar não deixa o hero vazio:
     a regra `:has(#hero-starfield canvas)` do styles.css esconde o fallback
     .dots-bg enquanto o canvas existir, então canvas limpo significa hero vazio. */
  function desenharQuadroEstatico() {
    const s = estado;
    if (!s) return;
    const t = 0;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.W, s.H);

    const tipo0 = s.typeIndices[0];
    const grupos = new Map();
    for (let j = 0; j < tipo0.length; j++) {
      const i = tipo0[j];
      let a = s.dotBaseAlpha[i];
      if (breatheEnabled) a += alfaDaRespiracao(s.baseX[i], s.baseY[i], t) * 0.12;
      a = quantizarAlfa(a);
      if (a < 0.01) continue;
      let grupo = grupos.get(a);
      if (!grupo) {
        grupo = [];
        grupos.set(a, grupo);
      }
      grupo.push(i);
    }
    grupos.forEach((indices, a) => {
      ctx.fillStyle = 'rgba(' + rgb + ',' + a + ')';
      ctx.beginPath();
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        const px = s.baseX[i];
        const py = s.baseY[i];
        ctx.moveTo(px + baseRadius, py);
        ctx.arc(px, py, baseRadius, 0, Math.PI * 2);
      }
      ctx.fill();
    });

    for (let tipo = 1; tipo <= 3; tipo++) {
      const indices = s.typeIndices[tipo];
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        let alfa = s.dotBaseAlpha[i];
        let raio = s.dotRadius[i];
        if (twinkleEnabled) {
          const tw = Math.sin(t * s.twinkleSpeed[i] + s.twinklePhase[i]);
          const tw2 = Math.sin(t * s.twinkleSpeed[i] * 0.37 + s.twinklePhase[i] * 2.1);
          const tremula = tw * 0.35 + tw2 * 0.15 + 0.5;
          if (tipo === 3) alfa = s.dotBaseAlpha[i] * (0.55 + tremula * 0.45);
          else if (tipo === 2) alfa = s.dotBaseAlpha[i] * (0.35 + tremula * 0.65);
          else alfa = s.dotBaseAlpha[i] * (0.15 + tremula * 0.85);

          const clarao = Math.sin(t * 0.3 + s.twinklePhase[i] * 5);
          if (clarao > 0.97) {
            const intensidade = (clarao - 0.97) / 0.03;
            alfa = Math.min(1, alfa + intensidade * 0.5);
            raio = s.dotRadius[i] * (1 + intensidade * 0.4);
          }
        }
        alfa = quantizarAlfa(alfa);
        if (alfa < 0.01) continue;

        const px = s.baseX[i];
        const py = s.baseY[i];
        const rot = s.starRotation[i];
        ctx.fillStyle = 'rgba(' + rgb + ',' + alfa + ')';
        tracarEstrela(px, py, raio, rot);

        if (tipo >= 2 && s.enableGlow) {
          const glowR = tipo === 2 ? raio * 3 : raio * 4.5;
          const glowA = tipo === 2 ? alfa * 0.1 : alfa * 0.18;
          desenharHalo(px, py, raio, glowR, glowA);
          if (tipo === 3 && alfa > 0.4) desenharRaios(px, py, raio, rot, alfa);
        }
      }
    }
  }

  const scroll = createScrollSignal({ getY: () => window.scrollY });

  /* Visibilidade por IntersectionObserver, como o resto do repo. Fora do
     viewport o laço para e não gasta CPU. O guard de pausa continua vindo antes:
     pausado, quem pinta é o desenharQuadroEstatico. */
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entradas) => {
      const agora = entradas.some((en) => en.isIntersecting);
      if (agora === visivel) return;
      visivel = agora;
      if (visivel && !pausado) {
        cancelAnimationFrame(quadro);
        quadro = requestAnimationFrame(animate);
      }
    }, { rootMargin: '120px' })
    : null;

  function animate() {
    if (pausado) {
      desenharQuadroEstatico();
      return;
    }
    if (!visivel) {
      quadro = 0;
      return;
    }
    quadro = requestAnimationFrame(animate);

    const s = estado;
    if (!s) return;
    const t = performance.now() * 0.001;

    // Energia de scroll: empurra as partículas no eixo Y e acende o brilho.
    scroll.sample();
    const scrollE = scroll.energy;
    const scrollDir = scroll.direction;

    if (s.mouseInside) {
      s.smoothX += (s.mouseX - s.smoothX) * 0.12;
      s.smoothY += (s.mouseY - s.smoothY) * 0.12;
    } else {
      s.smoothX += (-9999 - s.smoothX) * 0.05;
      s.smoothY += (-9999 - s.smoothY) * 0.05;
    }

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.W, s.H);

    // ── Estrelas cadentes: poucos objetos, desenho direto. ──
    if (shootingStarsEnabled) {
      s.nextShoot -= 0.016;
      if (s.nextShoot <= 0) {
        const borda = Math.random();
        let sx;
        let sy;
        let angulo;
        if (borda < 0.5) {
          sx = Math.random() * s.W * 0.6;
          sy = -5;
          angulo = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        } else {
          sx = s.W + 5;
          sy = Math.random() * s.H * 0.5;
          angulo = Math.PI * 0.6 + Math.random() * Math.PI * 0.3;
        }
        s.shootingStars.push({
          x: sx,
          y: sy,
          vx: Math.cos(angulo) * (3 + Math.random() * 3),
          vy: Math.sin(angulo) * (3 + Math.random() * 3),
          life: 1,
          decay: 0.008 + Math.random() * 0.012,
          len: shootingStarTrailLength + Math.random() * 40,
        });
        s.nextShoot = shootingStarMinInterval + Math.random() * (shootingStarMaxInterval - shootingStarMinInterval);
      }
      for (let i = s.shootingStars.length - 1; i >= 0; i--) {
        const ss = s.shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life -= ss.decay;
        if (ss.life <= 0 || ss.x < -50 || ss.x > s.W + 50 || ss.y > s.H + 50) {
          s.shootingStars.splice(i, 1);
          continue;
        }
        const velocidade = Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy);
        const caudaX = ss.x - (ss.vx / velocidade) * ss.len;
        const caudaY = ss.y - (ss.vy / velocidade) * ss.len;
        const grad = ctx.createLinearGradient(caudaX, caudaY, ss.x, ss.y);
        grad.addColorStop(0, 'rgba(' + rgb + ',0)');
        grad.addColorStop(0.7, 'rgba(' + rgb + ',' + ss.life * 0.3 + ')');
        grad.addColorStop(1, 'rgba(' + rgb + ',' + ss.life * 0.8 + ')');
        ctx.beginPath();
        ctx.moveTo(caudaX, caudaY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rgb + ',' + ss.life * 0.9 + ')';
        ctx.fill();
      }
    }

    // ── Fase 1: alfa, raio e física de todos os pontos. Só matemática. ──
    const fAlpha = s.frameAlpha;
    const fRadius = s.frameRadius;
    const afetado = s.mouseAffected;
    afetado.fill(0);

    const smx = s.smoothX;
    const smy = s.smoothY;
    const infR = influenceRadius;
    const infR2 = infR * infR;
    if (smx > -5000) {
      // O cursor está em algum lugar plausível: varre só as células vizinhas.
      const minGC = Math.max(0, Math.floor((smx - infR) / s.cellSize));
      const maxGC = Math.min(s.gridCols - 1, Math.floor((smx + infR) / s.cellSize));
      const minGR = Math.max(0, Math.floor((smy - infR) / s.cellSize));
      const maxGR = Math.min(s.gridRows - 1, Math.floor((smy + infR) / s.cellSize));
      for (let gr = minGR; gr <= maxGR; gr++) {
        for (let gc = minGC; gc <= maxGC; gc++) {
          const celula = s.spatialGrid[gr * s.gridCols + gc];
          for (let ci = 0; ci < celula.length; ci++) {
            const i = celula[ci];
            const dx = s.baseX[i] - smx;
            const dy = s.baseY[i] - smy;
            if (dx * dx + dy * dy < infR2) afetado[i] = 1;
          }
        }
      }
    }

    for (let i = 0; i < s.count; i++) {
      const tipo = s.dotType[i];
      let alfa = s.dotBaseAlpha[i];
      let raio = s.dotRadius[i];

      if (tipo === 0 && breatheEnabled) {
        alfa += alfaDaRespiracao(s.baseX[i], s.baseY[i], t) * 0.12;
      }
      if (tipo > 0 && twinkleEnabled) {
        const tw = Math.sin(t * s.twinkleSpeed[i] + s.twinklePhase[i]);
        const tw2 = Math.sin(t * s.twinkleSpeed[i] * 0.37 + s.twinklePhase[i] * 2.1);
        const tremula = tw * 0.35 + tw2 * 0.15 + 0.5;
        if (tipo === 3) {
          alfa = s.dotBaseAlpha[i] * (0.55 + tremula * 0.45);
          s.starRotation[i] += 0.003;
        } else if (tipo === 2) {
          alfa = s.dotBaseAlpha[i] * (0.35 + tremula * 0.65);
          s.starRotation[i] += 0.005;
        } else {
          alfa = s.dotBaseAlpha[i] * (0.15 + tremula * 0.85);
          s.starRotation[i] += 0.008;
        }
        const clarao = Math.sin(t * 0.3 + s.twinklePhase[i] * 5);
        if (clarao > 0.97) {
          const intensidade = (clarao - 0.97) / 0.03;
          alfa = Math.min(1, alfa + intensidade * 0.5);
          raio = s.dotRadius[i] * (1 + intensidade * 0.4);
        }
      }

      // Física: ponto tocado pelo cursor é empurrado, os outros voltam à base.
      let alvoX = s.baseX[i];
      let alvoY = s.baseY[i];
      if (afetado[i]) {
        const bx = s.baseX[i];
        const by = s.baseY[i];
        const dx = bx - smx;
        const dy = by - smy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const f = 1 - dist / infR;
        const suave = f * f * f;
        if (dist > 0.5) {
          alvoX = bx + (dx / dist) * pushStrength * suave;
          alvoY = by + (dy / dist) * pushStrength * suave;
        }
        alfa = Math.min(1, alfa + glowBoost * suave);
        if (tipo > 0) raio = raio * (1 + suave * 0.6);

        // Perto da borda o empurrão é amortecido, senão o ponto vaza do canvas.
        const margem = pushStrength + 6;
        const fadeX = Math.min(bx, s.W - bx) / margem;
        const fadeY = Math.min(by, s.H - by) / margem;
        const amortece = Math.min(1, Math.min(fadeX, fadeY));
        if (amortece < 1) {
          alvoX = bx + (alvoX - bx) * amortece;
          alvoY = by + (alvoY - by) * amortece;
        }
      }

      if (scrollE > 0) {
        // Deslocamento contrário ao movimento, como inércia.
        alvoY -= scrollDir * scrollPush * scrollE * (0.4 + (i % 7) * 0.1);
        alfa = Math.min(1, alfa + scrollE * 0.25);
      }

      s.velX[i] += (alvoX - s.posX[i]) * 0.15;
      s.velY[i] += (alvoY - s.posY[i]) * 0.15;
      s.velX[i] *= 0.75;
      s.velY[i] *= 0.75;
      s.posX[i] += s.velX[i];
      s.posY[i] += s.velY[i];

      fAlpha[i] = quantizarAlfa(alfa);
      fRadius[i] = raio;
    }

    // ── Fase 2: desenho em lote, agrupado por alfa para trocar menos estado. ──
    const tipo0 = s.typeIndices[0];
    const grupos = new Map();
    for (let j = 0; j < tipo0.length; j++) {
      const i = tipo0[j];
      const a = fAlpha[i];
      if (a < 0.01) continue;
      let grupo = grupos.get(a);
      if (!grupo) {
        grupo = [];
        grupos.set(a, grupo);
      }
      grupo.push(i);
    }
    grupos.forEach((indices, a) => {
      ctx.fillStyle = 'rgba(' + rgb + ',' + a + ')';
      ctx.beginPath();
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        const px = s.posX[i];
        const py = s.posY[i];
        ctx.moveTo(px + baseRadius, py);
        ctx.arc(px, py, baseRadius, 0, Math.PI * 2);
      }
      ctx.fill();
    });

    // Estrelas: poucas, desenhadas uma a uma. Tipo 2 ganha halo, tipo 3 halo e raios.
    for (let tipo = 1; tipo <= 3; tipo++) {
      const indices = s.typeIndices[tipo];
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        const a = fAlpha[i];
        if (a < 0.01) continue;
        const px = s.posX[i];
        const py = s.posY[i];
        const outerR = fRadius[i];
        const rot = s.starRotation[i];
        ctx.fillStyle = 'rgba(' + rgb + ',' + a + ')';
        tracarEstrela(px, py, outerR, rot);
        if (tipo >= 2 && s.enableGlow) {
          const glowR = tipo === 2 ? outerR * 3 : outerR * 4.5;
          const glowA = tipo === 2 ? a * 0.1 : a * 0.18;
          desenharHalo(px, py, outerR, glowR, glowA);
          if (tipo === 3 && a > 0.4) desenharRaios(px, py, outerR, rot, a);
        }
      }
    }
  }

  /* O island fica com pointer-events:none de propósito, para não roubar o clique
     dos nós e dos fios do hero, e ainda tem um SVG por cima. Por isso o cursor é
     ouvido na janela, e a coordenada de página vira coordenada do contêiner pelo
     getBoundingClientRect(). */
  const pointerToLocal = (clientX, clientY) => {
    const s = estado;
    if (!s) return;
    if (!visivel) {
      s.mouseInside = false;
      return;
    }
    const r = container.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const lx = clientX - r.left;
    const ly = clientY - r.top;
    if (lx < 0 || ly < 0 || lx > r.width || ly > r.height) {
      s.mouseInside = false;
      return;
    }
    s.mouseX = lx;
    s.mouseY = ly;
    s.mouseInside = true;
  };

  const onMouseMove = (e) => { pointerToLocal(e.clientX, e.clientY); };
  const onMouseLeave = () => { if (estado) estado.mouseInside = false; };
  const onTouchMove = (e) => {
    if (!e.touches || !e.touches.length) return;
    pointerToLocal(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchEnd = () => { if (estado) estado.mouseInside = false; };

  let resizeTimer;
  const ro = new ResizeObserver(() => {
    // Debounce: sem isso a grade seria reconstruída a cada quadro do resize.
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const anterior = estado;
      const rect = container.getBoundingClientRect();
      const novo = construirGrade(rect.width, rect.height);
      if (anterior) {
        novo.mouseX = anterior.mouseX;
        novo.mouseY = anterior.mouseY;
        novo.mouseInside = anterior.mouseInside;
        novo.smoothX = anterior.smoothX;
        novo.smoothY = anterior.smoothY;
      }
      estado = novo;
      // construirGrade mexe em canvas.width, o que limpa o canvas. Se nenhum laço
      // estiver rodando (movimento pausado ou hero fora do viewport), ninguém
      // repinta depois. Então repinta aqui.
      const semLaco = pausado || !visivel;
      if (semLaco) desenharQuadroEstatico();
    }, 100);
  });

  // ── Estado inicial: grade, ouvintes, observadores e primeiro quadro. ──
  const rectInicial = container.getBoundingClientRect();
  estado = construirGrade(rectInicial.width, rectInicial.height);

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onMouseLeave);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);
  ro.observe(container);
  if (io) io.observe(container);

  if (pausado) desenharQuadroEstatico();
  else quadro = requestAnimationFrame(animate);

  /** Liga ou desliga o laço. Pausar repinta, nunca deixa o canvas vazio. */
  function definirPausa(valor) {
    const novo = Boolean(valor);
    if (novo === pausado) return;
    pausado = novo;
    if (pausado) {
      cancelAnimationFrame(quadro);
      quadro = 0;
      desenharQuadroEstatico();
    } else if (visivel) {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(animate);
    }
  }

  /** Troca a cor vinda dos tokens CSS. Nenhuma cor é decidida aqui. */
  function definirCores(tokens) {
    const t = tokens || {};
    const claro = t.theme === 'light';
    const nova = corParaRgb(claro ? (t.dotColorLight || dotColorLight) : (t.dotColor || dotColor));
    if (nova === rgb) return;
    rgb = nova;
    // Sem laço rodando (pausado ou fora da tela) ninguém repintaria na cor nova.
    if (!quadro) desenharQuadroEstatico();
  }

  function destruir() {
    cancelAnimationFrame(quadro);
    quadro = 0;
    clearTimeout(resizeTimer);
    window.removeEventListener('mousemove', onMouseMove);
    document.documentElement.removeEventListener('mouseleave', onMouseLeave);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    ro.disconnect();
    if (io) io.disconnect();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    estado = null;
  }

  return { definirPausa, definirCores, destruir };
}

/* ── Montagem. Era o antigo starfield-mount.mjs. ──
   Cola fina de propósito: a física mora acima, o estado de tema mora no
   FlowTheme e o estado de movimento mora no motion.js. Aqui só se conectam. */
const alvo = document.getElementById('hero-starfield');
if (alvo) {
  /** Lê as cores dos tokens CSS. Nunca hardcoded em JS. */
  const lerTokens = () => {
    const estilo = getComputedStyle(document.documentElement);
    const accent = estilo.getPropertyValue('--accent').trim();
    const border = estilo.getPropertyValue('--border').trim();
    return {
      dotColor: accent || '#7c3aed',
      dotColorLight: border || '#18181b',
      theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    };
  };

  const campo = criarStarfield(alvo, Object.assign(lerTokens(), {
    paused: document.documentElement.dataset.motion === 'paused',
    gap: 16,
    baseRadius: 1.1,
    influenceRadius: 110,
    pushStrength: 16,
    glowBoost: 0.38,
    scrollPush: 26,
    shootingStarsEnabled: true,
    breatheEnabled: true,
    twinkleEnabled: true,
  }));

  // Tema: o FlowTheme continua sendo a fonte única. Aqui só assinamos.
  if (window.FlowTheme && typeof window.FlowTheme.subscribe === 'function') {
    window.FlowTheme.subscribe(() => campo.definirCores(lerTokens()));
  }

  // Movimento: o motion.js continua sendo o dono único do estado.
  window.addEventListener('waveops:motion', (evento) => {
    campo.definirPausa(Boolean(evento.detail && evento.detail.paused));
  });
}
