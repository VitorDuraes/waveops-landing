/* Cena do vídeo do hero (spec 6.1 e 6.2), desenhada em canvas 2D.

   Fios de luz finos, em violeta e lilás, formam uma faixa ondulada com o desenho da onda da
   marca: sobe à esquerda, cruza o centro e desce à direita. No centro a faixa torce e os fios
   se juntam, no lugar do anel do símbolo. Pontos brancos correm pelos fios como dados. Ao
   fundo, partículas desfocadas e fios fora de foco dão profundidade. Tudo fica no terço
   superior e no centro: embaixo, à esquerda, mora o título, e à direita, o cartão.

   window.desenhar(t) desenha o instante t, em segundos, no <canvas> de 1920 x 1080, e é
   determinística. Os sorteios saem de um gerador com semente fixa (mulberry32), uma vez só,
   no carregamento. Toda grandeza que muda com o tempo dá um número inteiro de voltas em
   12 s, e a posição de um ponto no fio é (s0 + m × t / 12) mod 1, com m inteiro. Por isso
   desenhar(0) e desenhar(12) dão o mesmo quadro, e o loop do vídeo fecha sem corte.

   Quem grava é tests/site/qa/video.mjs. */
(() => {
  'use strict';

  const LARGURA = 1920;
  const ALTURA = 1080;
  const PERIODO = 12; // segundos
  const TAU = 2 * Math.PI;

  // Cores em RGB: o fundo e os violetas da marca.
  const FUNDO = [5, 1, 14]; // #05010e
  const VIOLETA = [124, 58, 237]; // #7c3aed
  const VIOLETA_MEDIO = [139, 92, 246]; // #8b5cf6
  const LILAS = [167, 139, 250]; // #a78bfa
  const LILAS_CLARO = [194, 178, 255]; // #c2b2ff
  const BRANCO = [255, 255, 255];

  // Faixa: linha de centro em Y0, com um período inteiro da onda na largura da tela.
  const Y0 = 0.34 * ALTURA;
  const AMPLITUDE = 0.1 * ALTURA;
  const MEIA_ABERTURA = 84; // meia largura da faixa onde ela fica de frente
  const X_INICIO = -60;
  const X_FIM = LARGURA + 60;
  const PASSO_X = 6;

  /** Gerador mulberry32: a mesma semente dá sempre a mesma sequência. */
  function mulberry32(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const sorteio = mulberry32(20261016);
  const entre = (min, max) => min + (max - min) * sorteio();
  const umDe = (lista) => lista[Math.floor(sorteio() * lista.length)];

  /** Parte fracionária (x mod 1), também para x negativo. */
  const fracao = (x) => x - Math.floor(x);

  /** Rampa suave de 0 a 1 entre a e b; com b menor que a, a rampa desce. */
  function suave(a, b, x) {
    const p = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return p * p * (3 - 2 * p);
  }

  /** Esmaece o que chega perto das bordas laterais. u = x / LARGURA. */
  const borda = (u) => suave(-0.1, 0.2, u) * suave(1.1, 0.8, u);

  const rgba = (cor, alfa) => `rgba(${cor[0]}, ${cor[1]}, ${cor[2]}, ${Math.max(0, Math.min(1, alfa)).toFixed(4)})`;

  // Fios da faixa. v é a posição do fio na largura da faixa, de -1 a 1.
  const N_FIOS = 30;
  const fios = [];
  for (let i = 0; i < N_FIOS; i++) {
    fios.push({
      v: -1 + (2 * (i + 0.5)) / N_FIOS + entre(-0.025, 0.025),
      cor: umDe([LILAS_CLARO, LILAS_CLARO, LILAS_CLARO, LILAS, LILAS, VIOLETA_MEDIO, VIOLETA]),
      alfa: entre(0.45, 0.85),
      largura: entre(0.9, 1.5),
      torcao: entre(-0.035, 0.035), // desloca o ponto em que o fio cruza a torção
      ondulacao: entre(3, 11), // px
      ciclos: entre(1.2, 3.4), // ciclos da ondulação na largura da tela
      voltas: umDe([1, 1, -1, 2]), // voltas da ondulação em 12 s: sempre inteiro
      fase: sorteio(),
    });
  }

  // Fios fora de foco, ao fundo: mais grossos, desfocados e apagados.
  const fiosFundo = [];
  for (let i = 0; i < 6; i++) {
    fiosFundo.push({
      y: Y0 + entre(-250, 150),
      amplitude: entre(60, 150),
      ciclos: entre(0.6, 1.25),
      fase: sorteio(),
      balanco: entre(0.03, 0.07), // vai e vem, em ciclos da onda
      faseBalanco: sorteio(),
      largura: entre(2, 4),
      alfa: entre(0.2, 0.4),
      desfoque: entre(6, 14),
      cor: umDe([VIOLETA, VIOLETA_MEDIO, LILAS]),
    });
  }

  // Partículas desfocadas: poucas grandes e apagadas, mais pequenas e acesas, concentradas
  // perto da faixa.
  const particulas = [];
  for (let i = 0; i < 46; i++) {
    const grande = sorteio() < 0.35;
    const sino = (sorteio() + sorteio() + sorteio()) / 3;
    particulas.push({
      x: entre(-30, LARGURA + 30),
      y: Y0 + (sino - 0.5) * 800,
      raio: grande ? entre(16, 42) : entre(2.5, 8),
      alfa: grande ? entre(0.08, 0.18) : entre(0.25, 0.55),
      // Branco só nas pequenas: grande e apagado, ele vira cinza.
      cor: umDe(grande ? [LILAS_CLARO, LILAS, VIOLETA_MEDIO] : [LILAS_CLARO, LILAS, BRANCO]),
      ax: entre(10, 36),
      fx: sorteio(),
      ay: entre(8, 26),
      fy: sorteio(),
      pisca: umDe([1, 2]), // voltas do brilho em 12 s
      fp: sorteio(),
    });
  }

  // Pontos de dados: cada um percorre um trecho de um fio, m vezes a cada 12 s.
  const N_PONTOS = 16;
  const pontos = [];
  for (let i = 0; i < N_PONTOS; i++) {
    const comprimento = entre(760, 1150);
    pontos.push({
      fio: fios[Math.floor(entre(0.35, 0.95) * N_FIOS)],
      inicio: entre(-80, LARGURA + 80 - comprimento),
      comprimento,
      s0: (i + entre(0.15, 0.85)) / N_PONTOS,
      m: 1,
      raio: entre(2.2, 3),
      cauda: entre(110, 170),
      brilho: entre(0.7, 1),
    });
  }

  const canvas = document.getElementById('cena');
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  const camada = document.createElement('canvas');
  camada.width = LARGURA;
  camada.height = ALTURA;
  const cf = camada.getContext('2d', { willReadFrequently: true });

  /** Degradê horizontal de uma cor, com o alfa calculado ao longo da largura. */
  function degradeHorizontal(c, cor, alfaEm) {
    const g = c.createLinearGradient(X_INICIO, 0, X_FIM, 0);
    for (let k = 0; k <= 12; k++) {
      const x = X_INICIO + (k / 12) * (X_FIM - X_INICIO);
      g.addColorStop(k / 12, rgba(cor, alfaEm(x / LARGURA)));
    }
    return g;
  }

  /** Brilho difuso em elipse. */
  function brilho(x, y, raio, achatamento, cor, alfa) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, achatamento);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, raio);
    g.addColorStop(0, rgba(cor, alfa));
    g.addColorStop(0.5, rgba(cor, alfa * 0.35));
    g.addColorStop(1, rgba(cor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-raio, -raio, 2 * raio, 2 * raio);
    ctx.restore();
  }

  /** Traça um caminho por x, de x0 a x1, com y = yEm(x). */
  function tracar(c, x0, x1, passo, yEm) {
    c.beginPath();
    c.moveTo(x0, yEm(x0));
    for (let x = x0 + passo; x < x1; x += passo) c.lineTo(x, yEm(x));
    c.lineTo(x1, yEm(x1));
  }

  /** Desenha o instante t, em segundos. */
  function desenhar(t) {
    const fase = t / PERIODO;
    // Fração da volta de algo que dá k voltas em 12 s. Com k inteiro, vale exatamente 0 em
    // t = 0 e em t = 12: é isso que fecha o loop.
    const giro = (k) => fracao(k * fase);
    const onda = (k, deslocamento) => Math.sin(TAU * (giro(k) + deslocamento));

    const balanco = 0.18 * onda(1, 0);
    const amplitude = AMPLITUDE * (1 + 0.06 * onda(1, 0.35));
    const abertura = MEIA_ABERTURA * (1 + 0.08 * onda(1, 0.15));
    const centro = 0.5 + 0.025 * onda(1, 0.6); // onde a faixa torce, em fração da largura
    const pulso = 1 + 0.08 * onda(1, 0.8);

    const yCentro = (u) => Y0 - amplitude * Math.sin(TAU * u + balanco);
    const angulo = (fio, u) => Math.PI * (u - centro - fio.torcao);
    const yFio = (fio, x) => {
      const u = x / LARGURA;
      return (
        yCentro(u) +
        fio.v * abertura * Math.sin(angulo(fio, u)) +
        fio.ondulacao * Math.sin(TAU * (fio.ciclos * u + giro(fio.voltas) + fio.fase))
      );
    };
    // De -1 (atrás) a 1 (na frente): na torção, os fios de trás ficam mais apagados.
    const profundidade = (fio, u) => fio.v * Math.cos(angulo(fio, u));

    // 1. Fundo e brilho difuso atrás da faixa. O estado do contexto é refeito aqui, para o
    //    quadro não depender da chamada anterior.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.lineCap = 'round';
    ctx.fillStyle = rgba(FUNDO, 1);
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    brilho(LARGURA / 2, Y0, 1100, 0.4, VIOLETA, 0.24 * pulso);
    brilho(centro * LARGURA, yCentro(centro), 280, 0.8, LILAS, 0.14 * pulso);

    // 2. Fios fora de foco. Daqui até os pontos de dados, a luz soma ('lighter').
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fiosFundo) {
      const deslocamento = f.balanco * onda(1, f.faseBalanco);
      ctx.filter = `blur(${f.desfoque.toFixed(2)}px)`;
      ctx.lineWidth = f.largura;
      ctx.strokeStyle = degradeHorizontal(ctx, f.cor, (u) => f.alfa * borda(u));
      tracar(ctx, X_INICIO, X_FIM, 12, (x) => f.y - f.amplitude * Math.sin(TAU * (f.ciclos * (x / LARGURA) + f.fase + deslocamento)));
      ctx.stroke();
    }
    ctx.filter = 'none';

    // 3. Partículas desfocadas.
    for (const p of particulas) {
      const x = p.x + p.ax * onda(1, p.fx);
      const y = p.y + p.ay * onda(1, p.fy);
      const alfa = p.alfa * (0.7 + 0.3 * onda(p.pisca, p.fp));
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.raio);
      g.addColorStop(0, rgba(p.cor, alfa));
      g.addColorStop(0.5, rgba(p.cor, alfa * 0.6));
      g.addColorStop(1, rgba(p.cor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, p.raio, 0, TAU);
      ctx.fill();
    }

    // 4. A faixa, numa camada própria, que entra quatro vezes: duas desfocadas (o corpo de
    //    luz), uma pouco desfocada (o halo de cada fio) e uma nítida.
    cf.globalCompositeOperation = 'source-over';
    cf.clearRect(0, 0, LARGURA, ALTURA);
    cf.globalCompositeOperation = 'lighter';
    cf.lineCap = 'round';
    cf.lineJoin = 'round';
    for (const fio of fios) {
      cf.lineWidth = fio.largura;
      cf.strokeStyle = degradeHorizontal(cf, fio.cor, (u) => fio.alfa * (0.55 + 0.45 * profundidade(fio, u)) * borda(u));
      tracar(cf, X_INICIO, X_FIM, PASSO_X, (x) => yFio(fio, x));
      cf.stroke();
    }
    ctx.filter = 'blur(42px)';
    ctx.drawImage(camada, 0, 0);
    ctx.filter = 'blur(16px)';
    ctx.drawImage(camada, 0, 0);
    ctx.filter = 'blur(4px)';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(camada, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(camada, 0, 0);

    // 5. Pontos de dados, com rastro. A posição no trecho é (s0 + m × t / 12) mod 1.
    for (const p of pontos) {
      const s = fracao(p.s0 + giro(p.m));
      const x = p.inicio + s * p.comprimento;
      const u = x / LARGURA;
      const forca = Math.pow(Math.sin(Math.PI * s), 1.5) * borda(u) * (0.7 + 0.3 * profundidade(p.fio, u)) * p.brilho;
      if (forca < 0.002) continue;
      const y = yFio(p.fio, x);
      const rastro = ctx.createLinearGradient(x - p.cauda, 0, x, 0);
      rastro.addColorStop(0, rgba(LILAS_CLARO, 0));
      rastro.addColorStop(1, rgba(BRANCO, 0.85 * forca));
      ctx.strokeStyle = rastro;
      ctx.lineWidth = 2;
      tracar(ctx, x - p.cauda, x, 5, (xr) => yFio(p.fio, xr));
      ctx.stroke();
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 32);
      halo.addColorStop(0, rgba(BRANCO, 0.6 * forca));
      halo.addColorStop(0.25, rgba(LILAS_CLARO, 0.26 * forca));
      halo.addColorStop(1, rgba(LILAS_CLARO, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - 32, y - 32, 64, 64);
      ctx.fillStyle = rgba(BRANCO, forca);
      ctx.beginPath();
      ctx.arc(x, y, p.raio, 0, TAU);
      ctx.fill();
    }

    // 6. Pé da tela mais escuro: ali ficam o título e o cartão.
    ctx.globalCompositeOperation = 'source-over';
    const pe = ctx.createLinearGradient(0, ALTURA * 0.56, 0, ALTURA);
    pe.addColorStop(0, rgba(FUNDO, 0));
    pe.addColorStop(1, rgba(FUNDO, 0.9));
    ctx.fillStyle = pe;
    ctx.fillRect(0, ALTURA * 0.56, LARGURA, ALTURA * 0.44);
  }

  window.desenhar = desenhar;
  desenhar(0);

  // Prévia: com ?animar no endereço, a cena anda em tempo real.
  if (new URLSearchParams(location.search).has('animar')) {
    const inicio = performance.now();
    const quadro = (agora) => {
      desenhar(((agora - inicio) / 1000) % PERIODO);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }
})();
