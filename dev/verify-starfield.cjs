/* WaveOps: verificação dos islands React do hero. Roda com node, sem navegador.
   Uso: node dev/verify-starfield.cjs */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
let total = 0;
const check = (nome, fn) => {
  total += 1;
  try { fn(); passed += 1; console.log('  ok   ' + nome); }
  catch (e) { console.error('  FAIL ' + nome + ': ' + e.message); process.exitCode = 1; }
};

console.log('React fora do caminho critico');
check('o index.html carrega o starfield puro, nao o mount React', () => {
  const html = read('index.html');
  assert.ok(!/starfield-mount\.mjs/.test(html),
    'o index.html ainda carrega starfield-mount.mjs, que arrasta react, react-dom-client e jsx-runtime');
  assert.ok(/<script type="module" src="assets\/starfield\.mjs\?v=[^"]+"><\/script>/.test(html),
    'o index.html nao carrega assets/starfield.mjs com cache-busting no ?v=');
});
check('nenhum modulo alcancavel pelo script importa de assets/vendor/', () => {
  const vistos = new Set();
  const fila = ['assets/starfield.mjs'];
  while (fila.length) {
    const atual = fila.shift();
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    assert.ok(!/^assets\/vendor\//.test(atual),
      'o grafo de import chegou em ' + atual + ': React voltou para o caminho critico');
    const src = read(atual);
    const dir = path.posix.dirname(atual);
    for (const m of src.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
      const alvo = m[1].split('?')[0];
      if (!alvo.startsWith('.')) continue;
      fila.push(path.posix.normalize(path.posix.join(dir, alvo)));
    }
  }
});
check('nao sobrou API de React no modulo', () => {
  const src = read('assets/starfield.mjs');
  for (const api of ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', '_jsx', 'createRoot']) {
    assert.ok(!new RegExp('\\b' + api + '\\s*\\(').test(src), 'ainda chama ' + api + '()');
  }
});

console.log('\nsinal de scroll');
(async () => {
  const { createScrollSignal } = await import('../assets/scroll-signal.mjs');

  check('em repouso a energia é zero', () => {
    const s = createScrollSignal({ getY: () => 0 });
    s.sample(); s.sample();
    assert.strictEqual(s.energy, 0);
  });

  check('scroll para baixo gera energia positiva e direção 1', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 400; s.sample();
    assert.ok(s.energy > 0.5, 'energia ficou ' + s.energy);
    assert.strictEqual(s.direction, 1);
  });

  check('scroll para cima gera direção -1', () => {
    let y = 400;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 0; s.sample();
    assert.ok(s.energy > 0.5);
    assert.strictEqual(s.direction, -1);
  });

  check('energia satura em 1', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 999999; s.sample();
    assert.ok(s.energy <= 1, 'energia passou de 1: ' + s.energy);
  });

  check('energia decai até zerar quando o scroll para', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 400; s.sample();
    for (let i = 0; i < 200; i++) s.sample();
    assert.ok(s.energy < 0.01, 'energia não decaiu: ' + s.energy);
  });

  console.log('\nporte do starfield');
  check('nenhum specifier bare sobrou', () => {
    const src = read('assets/starfield.mjs');
    const bare = [...src.matchAll(/from\s*['"]([^'"]+)['"]/g)]
      .map((m) => m[1])
      .filter((x) => !x.startsWith('.') && !x.startsWith('/'));
    assert.deepStrictEqual(bare, [], 'sobrou specifier bare: ' + bare.join(', '));
  });
  check('o sub-import mutavel leva a versao no especificador', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/\.\/scroll-signal\.mjs\?v=\d{8}/.test(src),
      'o import de scroll-signal.mjs perdeu o ?v=: o ?v= do script nao alcanca sub-import relativo');
  });
  check('canvas e transparente, nao pinta fundo opaco', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(!/fillRect\(0,\s*0,\s*s\.W,\s*s\.H\)/.test(src), 'ainda pinta fundo opaco com fillRect');
    assert.ok(/clearRect\(0,\s*0,\s*s\.W,\s*s\.H\)/.test(src), 'falta o clearRect');
  });
  check('o guard de pausa vem antes de agendar o frame', () => {
    const src = read('assets/starfield.mjs');
    const m = src.match(/function animate\(\)\s*\{([\s\S]{0,400})/);
    assert.ok(m, 'nao achou a funcao animate');
    const inicio = m[1].replace(/\s+/g, '');
    const posGuard = inicio.indexOf('if(pausado)');
    const posAgenda = inicio.indexOf('requestAnimationFrame(animate)');
    assert.ok(posGuard >= 0, 'falta o guard de pausado em animate()');
    assert.ok(posAgenda >= 0, 'nao achou o agendamento de frame em animate()');
    assert.ok(posGuard < posAgenda,
      'o guard de pausado vem DEPOIS de agendar o frame, entao a pausa nao interrompe o laco');
  });
  check('a energia de scroll altera de fato as particulas', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/createScrollSignal/.test(src), 'nao importa createScrollSignal');
    assert.ok(/scroll\.sample\(\)/.test(src), 'nao amostra o scroll no laco');
    assert.ok(/if\s*\(scrollE\s*>\s*0\)/.test(src), 'falta o bloco condicional da energia de scroll');
    assert.ok(/alvoY\s*-=\s*scrollDir\s*\*\s*scrollPush\s*\*\s*scrollE/.test(src),
      'a energia de scroll nao desloca o alvo em Y, entao o acoplamento e decorativo');
    assert.ok(/alfa\s*=\s*Math\.min\(1,\s*alfa\s*\+\s*scrollE\s*\*/.test(src),
      'a energia de scroll nao acende o brilho');
  });
  check('mantem o perfil de performance por device', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/perfilDoDispositivo/.test(src), 'o porte removeu o perfil por dispositivo');
    assert.ok(/1500/.test(src), 'perdeu o teto de 1500 pontos do mobile');
    assert.ok(/quantizarAlfa/.test(src), 'perdeu a quantizacao de alpha, que segura o custo por frame');
    assert.ok(/spatialGrid/.test(src), 'perdeu o hash espacial da interacao de mouse');
  });
  check('a calibracao do hero continua valendo', () => {
    const src = read('assets/starfield.mjs');
    const esperado = {
      gap: '16', baseRadius: '1.1', influenceRadius: '110',
      pushStrength: '16', glowBoost: '0.38', scrollPush: '26',
    };
    for (const chave of Object.keys(esperado)) {
      const m = src.match(new RegExp(chave + ':\\s*([0-9.]+),'));
      assert.ok(m, 'nao achou ' + chave + ' na montagem');
      assert.strictEqual(m[1], esperado[chave], chave + ' saiu de ' + esperado[chave] + ' para ' + m[1]);
    }
    for (const flag of ['shootingStarsEnabled', 'breatheEnabled', 'twinkleEnabled']) {
      assert.ok(new RegExp(flag + ':\\s*true').test(src), flag + ' deixou de ser passado como true');
    }
  });

  // As tres verificacoes abaixo nasceram do review final de branch. Elas amarram
  // efeito, nao intencao: pausa tem que sobrar pixel, cursor tem que virar
  // deslocamento, e o laco tem que parar fora do viewport.
  check('pausa repinta: o ResizeObserver repinta quando nenhum laco esta rodando', () => {
    const src = read('assets/starfield.mjs');
    const m = src.match(/resizeTimer\s*=\s*setTimeout\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*100\);/);
    assert.ok(m, 'nao achou o callback debounced do ResizeObserver');
    const corpo = m[1];
    assert.ok(/construirGrade\(/.test(corpo), 'o callback nao reconstroi a grade');
    assert.ok(/desenharQuadroEstatico\(\)/.test(corpo),
      'o callback limpa o canvas em construirGrade e nunca repinta');
    const guarda = corpo.match(/if\s*\(([^)]*)\)\s*desenharQuadroEstatico\(\)/);
    assert.ok(guarda, 'a repintura do callback nao tem guard identificavel');
    let expr = guarda[1].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
      const decl = corpo.match(new RegExp('(?:const|let|var)\\s+' + expr + '\\s*=\\s*([^;]+);'));
      assert.ok(decl, 'o guard "' + expr + '" nao tem declaracao no callback');
      expr = decl[1];
    }
    assert.ok(/\bpausado\b/.test(expr),
      'a repintura ignora o estado de pausa, entao pausar deixa o hero em branco: ' + expr);
  });
  check('pausar repinta na hora, sem esperar resize', () => {
    const src = read('assets/starfield.mjs');
    const m = src.match(/function definirPausa\(valor\)\s*\{([\s\S]*?)\n  \}/);
    assert.ok(m, 'nao achou definirPausa()');
    assert.ok(/desenharQuadroEstatico\(\)/.test(m[1]),
      'definirPausa nao repinta, entao pausar deixa o canvas no ultimo quadro');
    assert.ok(/cancelAnimationFrame/.test(m[1]), 'definirPausa nao cancela o quadro agendado');
  });

  check('cursor vira deslocamento: escuta fora do island e converte a coordenada', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(!/container\.addEventListener\(['"]mousemove/.test(src),
      'ainda escuta mousemove no container, que herda pointer-events:none e nunca dispara');
    assert.ok(/window\.addEventListener\(['"]mousemove/.test(src),
      'ninguem escuta mousemove fora do island, entao a repulsao nunca roda');
    const i0 = src.indexOf('const pointerToLocal');
    assert.ok(i0 >= 0, 'nao achou a conversao de coordenada de pagina para o conteiner');
    const i1 = src.indexOf('const onMouseMove', i0);
    const corpo = src.slice(i0, i1 > i0 ? i1 : i0 + 900);
    assert.ok(/container\.getBoundingClientRect\(\)/.test(corpo),
      'a conversao nao usa o getBoundingClientRect do conteiner');
    assert.ok(/s\.mouseX\s*=/.test(corpo) && /s\.mouseY\s*=/.test(corpo),
      'a conversao nao alimenta a posicao do mouse no estado');
    assert.ok(/s\.mouseInside\s*=\s*true/.test(corpo), 'a conversao nunca marca o cursor como dentro');
    assert.ok(/pointerToLocal\(e\.clientX,\s*e\.clientY\)/.test(src),
      'o handler de mouse nao chama a conversao');
    assert.ok(/pointerToLocal\(e\.touches\[0\]\.clientX/.test(src),
      'o handler de toque nao chama a conversao');
  });

  check('o laco para fora do viewport e o observer e desconectado na limpeza', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/new IntersectionObserver\(/.test(src),
      'nao usa IntersectionObserver, contra a convencao do repo');
    assert.ok(/io\.observe\(container\)/.test(src),
      'o IntersectionObserver nao observa o conteiner do island');
    const anim = src.match(/function animate\(\)\s*\{([\s\S]{0,400})/);
    assert.ok(anim, 'nao achou a funcao animate');
    const inicio = anim[1].replace(/\s+/g, '');
    const posVis = inicio.indexOf('if(!visivel)');
    const posAgenda = inicio.indexOf('requestAnimationFrame(animate)');
    assert.ok(posVis >= 0, 'animate() nao checa a visibilidade, entao o laco roda fora da tela');
    assert.ok(posAgenda >= 0, 'nao achou o agendamento de frame em animate()');
    assert.ok(posVis < posAgenda,
      'a checagem de visibilidade vem DEPOIS de agendar o frame, entao o laco nao para');
    const limpeza = src.match(/function destruir\(\)\s*\{([\s\S]*?)\n  \}/);
    assert.ok(limpeza, 'nao achou a funcao de limpeza destruir()');
    assert.ok(/io\.disconnect\(\)/.test(limpeza[1]), 'o IntersectionObserver nao e desconectado na limpeza');
    assert.ok(/ro\.disconnect\(\)/.test(limpeza[1]), 'o ResizeObserver nao e desconectado na limpeza');
    for (const ev of ['mousemove', 'touchmove', 'touchend', 'touchcancel']) {
      assert.ok(new RegExp("removeEventListener\\('" + ev + "'").test(limpeza[1]),
        'a limpeza nao remove o ouvinte de ' + ev);
    }
  });

  console.log('\ncalibração do scroll');
  check('a sensibilidade do scroll não regride para valores surdos', () => {
    const src = read('assets/scroll-signal.mjs');
    const m = src.match(/decay\s*=\s*([\d.]+)\s*,\s*scale\s*=\s*([\d.]+)/);
    assert.ok(m, 'não achou os padrões de decay e scale em createScrollSignal');
    const decay = parseFloat(m[1]), scale = parseFloat(m[2]);
    // Medido no navegador em 10/09/2026, amostrando uma vez por quadro a 110 fps.
    // Com scale 0.045 e decay 0.88 o deslocamento ficava em 1,6 a 3,9 px contra
    // 10 px de ruído do twinkle, ou seja, invisível. Com 0.18 e 0.95 a amplitude
    // medida foi 22,2 px contra 1,9 px de ruído.
    assert.ok(scale >= 0.12,
      'scale ' + scale + ' é baixo demais: exige mais de ' + Math.round(1 / scale) +
      ' px num quadro só para saturar, e rolagem normal entrega de 3 a 10 px');
    assert.ok(decay >= 0.93,
      'decay ' + decay + ' mata a energia rápido demais: o decaimento é POR QUADRO, ' +
      'e a página roda acima de 100 fps');
  });
  check('o empurrão de scroll é forte o bastante para ser visto', () => {
    const m = read('assets/starfield.mjs').match(/scrollPush:\s*(\d+)/);
    assert.ok(m, 'não achou scrollPush em starfield.mjs');
    assert.ok(parseInt(m[1], 10) >= 24,
      'scrollPush ' + m[1] + ' é fraco: com a calibração atual o deslocamento não ' +
      'passa do ruído do twinkle');
  });

  console.log('\nmotion-lite (substituto do framer-motion no ImageSequence)');
  const {
    clamp01,
    mapRange,
    progressFromRect,
    pageProgress,
    createMotionValue,
    deriveTransform,
  } = await import('../assets/motion-lite.mjs');

  check('progresso do scroll: 0 logo abaixo da viewport, 1 ao sair por cima, 0.5 no meio', () => {
    const viewportHeight = 800;
    const height = 400;
    // Offset ["start end", "end start"]: 0 quando o topo do alvo encosta na
    // base da viewport (top === viewportHeight).
    const abaixo = progressFromRect({ top: viewportHeight, bottom: viewportHeight + height }, viewportHeight);
    assert.strictEqual(abaixo, 0, 'alvo logo abaixo da viewport devia dar progresso 0, deu ' + abaixo);

    // 1 quando a base do alvo encosta no topo da viewport (bottom === 0).
    const saiu = progressFromRect({ top: -height, bottom: 0 }, viewportHeight);
    assert.strictEqual(saiu, 1, 'alvo que acabou de sair por cima devia dar progresso 1, deu ' + saiu);

    // Ponto médio do percurso: metade da distância total (viewport + altura do alvo).
    const meio = progressFromRect({ top: 200, bottom: 600 }, viewportHeight);
    assert.ok(Math.abs(meio - 0.5) < 1e-9, 'meio do percurso devia dar 0.5, deu ' + meio);
  });

  check('progresso do scroll satura: nunca passa de 1 nem fica abaixo de 0', () => {
    const viewportHeight = 800;
    const antesDoInicio = progressFromRect({ top: 100000, bottom: 100400 }, viewportHeight);
    assert.ok(antesDoInicio >= 0 && antesDoInicio <= 1, 'saturação para baixo falhou: ' + antesDoInicio);
    assert.strictEqual(antesDoInicio, 0, 'alvo muito abaixo devia saturar em 0, deu ' + antesDoInicio);

    const depoisDoFim = progressFromRect({ top: -100000, bottom: -99600 }, viewportHeight);
    assert.ok(depoisDoFim >= 0 && depoisDoFim <= 1, 'saturação para cima falhou: ' + depoisDoFim);
    assert.strictEqual(depoisDoFim, 1, 'alvo muito acima devia saturar em 1, deu ' + depoisDoFim);

    // clamp01 isolado, e pageProgress (progresso da página inteira) também satura.
    assert.strictEqual(clamp01(5), 1);
    assert.strictEqual(clamp01(-5), 0);
    assert.strictEqual(pageProgress(999999, 2000, 800), 1, 'pageProgress não saturou em 1');
    assert.strictEqual(pageProgress(-999999, 2000, 800), 0, 'pageProgress não saturou em 0');
  });

  check('useTransform (mapRange): mapeia 0 para 0 e 1 para N, satura fora do intervalo', () => {
    const N = 4;
    assert.strictEqual(mapRange(0, [0, 1], [0, N]), 0);
    assert.strictEqual(mapRange(1, [0, 1], [0, N]), N);
    assert.strictEqual(mapRange(0.5, [0, 1], [0, N]), N / 2);
    assert.strictEqual(mapRange(1.5, [0, 1], [0, N]), N, 'não saturou acima de 1');
    assert.strictEqual(mapRange(-0.5, [0, 1], [0, N]), 0, 'não saturou abaixo de 0');
  });

  check('assinar o derivado recebe notificação quando a origem muda', () => {
    const origem = createMotionValue(0);
    const { value: derivado } = deriveTransform(origem, [0, 1], [0, 10]);

    // Correto na primeira leitura, sem esperar por nenhum evento.
    assert.strictEqual(derivado.get(), 0, 'derivado não nasceu com o valor mapeado da origem');

    let recebido = null;
    let chamadas = 0;
    derivado.on('change', (latest) => {
      recebido = latest;
      chamadas += 1;
    });

    origem.set(0.5);
    assert.strictEqual(chamadas, 1, 'assinante do derivado não foi notificado quando a origem mudou');
    assert.strictEqual(recebido, 5, 'derivado notificou com o valor errado: ' + recebido);
    assert.strictEqual(derivado.get(), 5, 'derivado.get() não refletiu a mudança da origem');
  });

  check('image-sequence.mjs não importa mais de ./vendor/framer-motion.mjs', () => {
    const src = read('assets/image-sequence.mjs');
    assert.ok(!/from"\.\/vendor\/framer-motion\.mjs"/.test(src),
      'ainda importa o framer-motion inteiro, o ponto desta tarefa é tirar isso do caminho de carga');
    assert.ok(/from"\.\/motion-lite\.mjs\?v=/.test(src),
      'não importa mais de ./motion-lite.mjs, então a troca de especificador não aconteceu');
  });

  console.log('\nisland da sequência de "Como funciona" (fase 2)');
  check('a sequência só monta dentro do guard de interseção, nunca solta fora dele', () => {
    const src = read('assets/sequence-mount.mjs');
    assert.ok(/observer\s*=\s*new IntersectionObserver\(/.test(src),
      'não usa IntersectionObserver, então não há carga preguiçosa por scroll');
    assert.ok(/observer\.observe\(secaoScroll\)/.test(src),
      'o observer não observa a seção, então nunca dispara');
    assert.ok(/if\s*\(entrada\.isIntersecting\s*&&\s*desktop\.matches\)\s*montar\(\)/.test(src),
      'a chamada de montar() não está condicionada a isIntersecting e desktop.matches juntos');
    assert.ok(!/^\s*montar\(\);\s*$/m.test(src),
      'existe uma chamada de montar() solta, fora do guard, então a carga deixa de ser preguiçosa');
  });

  check('abaixo de 768px a montagem não roda mesmo com a seção visível', () => {
    const src = read('assets/sequence-mount.mjs');
    assert.ok(/window\.matchMedia\(\s*'\(min-width:\s*768px\)'\s*\)/.test(src),
      'o corte de mobile não está em 768px, ou não usa matchMedia para lê-lo');
    assert.ok(/if\s*\(entrada\.isIntersecting\s*&&\s*desktop\.matches\)\s*montar\(\)/.test(src),
      'desktop.matches não faz parte do guard que libera montar(), então o mobile também baixaria os quadros');
  });

  check('assina waveops:motion e o congelamento realmente alterna a renderização', () => {
    const src = read('assets/sequence-mount.mjs');
    const handler = src.match(/window\.addEventListener\('waveops:motion',\s*\(evento\)\s*=>\s*\{([\s\S]*?)\n  \}\);/);
    assert.ok(handler, 'não achou o handler completo de waveops:motion');
    assert.ok(/pausado\s*=\s*Boolean\(evento\.detail\s*&&\s*evento\.detail\.paused\)/.test(handler[1]),
      'o handler não atualiza pausado a partir de evento.detail.paused');
    assert.ok(/pintar\(\)/.test(handler[1]),
      'o handler não repinta depois de mudar pausado, então o congelamento nunca aparece na tela');

    const pintarFn = src.match(/function pintar\(\) \{([\s\S]*?)\n  \}\n/);
    assert.ok(pintarFn, 'não achou a função pintar()');
    assert.ok(/if \(pausado\) \{/.test(pintarFn[1]), 'pintar() não ramifica em cima de pausado');
    assert.ok(/sequence-frozen/.test(pintarFn[1]) && /ImageSequence/.test(pintarFn[1]),
      'pintar() não alterna entre o quadro congelado e o ImageSequence animado, então pausar não muda nada na tela');
  });

  check('o número de quadros no disco bate com o que o mount espera', () => {
    const src = read('assets/sequence-mount.mjs');
    const m = src.match(/TOTAL_QUADROS\s*=\s*(\d+)/);
    assert.ok(m, 'não achou TOTAL_QUADROS em sequence-mount.mjs');
    const esperado = parseInt(m[1], 10);
    const dir = path.join(root, 'assets/sequence');
    const quadros = fs.readdirSync(dir).filter((f) => /^frame-\d{3}\.webp$/.test(f));
    assert.strictEqual(quadros.length, esperado,
      'assets/sequence/ tem ' + quadros.length + ' quadros, o mount espera ' + esperado);
    const primeiro = 'frame-000.webp';
    const ultimo = 'frame-' + String(esperado - 1).padStart(3, '0') + '.webp';
    assert.ok(quadros.includes(primeiro), 'falta ' + primeiro);
    assert.ok(quadros.includes(ultimo), 'falta ' + ultimo + ', a numeração não bate com TOTAL_QUADROS menos 1');
  });

  check('o peso de assets/sequence/ não passa do teto de 400 KB', () => {
    const dir = path.join(root, 'assets/sequence');
    const total = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.webp'))
      .reduce((soma, f) => soma + fs.statSync(path.join(dir, f)).size, 0);
    const TETO = 400 * 1024;
    assert.ok(total <= TETO,
      'assets/sequence/ pesa ' + Math.round(total / 1024) + ' KB, passou do teto de 400 KB');
  });

  const resumo = passed === total
    ? passed + ' verificações passaram'
    : passed + ' de ' + total + ' verificações passaram';
  console.log('\n' + resumo);
})();
