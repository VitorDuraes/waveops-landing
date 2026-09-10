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

console.log('shim do pacote framer');
check('exporta os 4 símbolos usados pelos componentes', () => {
  // Validação por texto: check() é síncrono, então um callback async faria o
  // try/catch dele nunca ver a falha.
  const src = read('assets/vendor/framer-shim.mjs');
  for (const s of ['addPropertyControls', 'ControlType', 'RenderTarget', 'useIsStaticRenderer']) {
    assert.ok(new RegExp('export[^\\n]*\\b' + s + '\\b').test(src), 'falta export de ' + s);
  }
});
check('RenderTarget.current não devolve o valor de canvas', () => {
  const src = read('assets/vendor/framer-shim.mjs');
  assert.ok(/current\s*\(\s*\)/.test(src), 'RenderTarget precisa do metodo current()');
  assert.ok(!/current\s*\(\s*\)\s*\{\s*return\s*['"]CANVAS/.test(src),
    'current() não pode devolver CANVAS, senão o componente renderiza o placeholder estático');
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
    const bare = [...src.matchAll(/from\s*"([^".][^"]*)"/g)]
      .map((m) => m[1])
      .filter((s) => !s.startsWith('.') && !s.startsWith('/'));
    assert.deepStrictEqual(bare, [], 'sobrou specifier bare: ' + bare.join(', '));
  });
  check('canvas é transparente, não pinta fundo opaco', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(!/fillRect\(0,0,s\.W,s\.H\)/.test(src), 'ainda pinta fundo opaco com fillRect');
    assert.ok(/clearRect\(0,0,s\.W,s\.H\)/.test(src), 'falta o clearRect');
  });
  check('o guard de pausa vem antes de agendar o frame', () => {
    const src = read('assets/starfield.mjs');
    const m = src.match(/function animate\(\)\{([\s\S]{0,300})/);
    assert.ok(m, 'não achou a função animate');
    const inicio = m[1].replace(/\s+/g, '');
    const posGuard = inicio.indexOf('if(paused)');
    const posAgenda = inicio.indexOf('requestAnimationFrame(animate)');
    assert.ok(posGuard >= 0, 'falta o guard de paused em animate()');
    assert.ok(posAgenda >= 0, 'não achou o agendamento de frame em animate()');
    assert.ok(posGuard < posAgenda,
      'o guard de paused vem DEPOIS de agendar o frame, então a pausa não interrompe o laço');
  });
  check('a energia de scroll altera de fato as partículas', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/createScrollSignal/.test(src), 'não importa createScrollSignal');
    assert.ok(/scroll\.sample\(\)/.test(src), 'não amostra o scroll no laço');
    assert.ok(/if\(scrollE>0\)\{/.test(src), 'falta o bloco condicional da energia de scroll');
    assert.ok(/targetY-=scrollDir\*scrollPush\*scrollE/.test(src),
      'a energia de scroll não desloca targetY, então o acoplamento é decorativo');
    assert.ok(/alpha=Math\.min\(1,alpha\+scrollE\*/.test(src), 'a energia de scroll não acende o brilho');
  });
  check('mantém o perfil de performance por device', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/getDeviceProfile/.test(src), 'o porte removeu o getDeviceProfile');
    assert.ok(/1500/.test(src), 'perdeu o teto de 1500 pontos do mobile');
    assert.ok(/quantAlpha/.test(src), 'perdeu a quantização de alpha, que segura o custo por frame');
    assert.ok(/spatialGrid/.test(src), 'perdeu o hash espacial da interação de mouse');
  });

  // As três verificações abaixo nasceram do review final de branch. Elas amarram
  // efeito, não intenção: pausa tem que sobrar pixel, cursor tem que virar
  // deslocamento, e o laço tem que parar fora do viewport.
  check('pausa repinta: o ResizeObserver não repinta só no renderizador estático', () => {
    const src = read('assets/starfield.mjs');
    const m = src.match(/resizeTimer=setTimeout\(\(\)=>\{([\s\S]*?)\},100\);/);
    assert.ok(m, 'não achou o callback debounced do ResizeObserver');
    const corpo = m[1];
    assert.ok(/buildGrid\(/.test(corpo), 'o callback não reconstrói a grade');
    assert.ok(/drawStaticFrame\(\)/.test(corpo),
      'o callback limpa o canvas em buildGrid e nunca repinta');
    const guarda = corpo.match(/if\(([^)]*)\)\{drawStaticFrame\(\)/);
    assert.ok(guarda, 'a repintura do callback não tem guard identificável');
    let expr = guarda[1];
    if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
      const decl = corpo.match(new RegExp('(?:const|let|var)\\s+' + expr + '\\s*=\\s*([^;]+);'));
      assert.ok(decl, 'o guard "' + expr + '" não tem declaração no callback');
      expr = decl[1];
    }
    assert.ok(/\bpaused\b/.test(expr),
      'a repintura ignora o estado de pausa, então pausar deixa o hero em branco: ' + expr);
  });

  check('cursor vira deslocamento: escuta fora do island e converte a coordenada', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(!/container\.addEventListener\("mousemove"/.test(src),
      'ainda escuta mousemove no container, que herda pointer-events:none e nunca dispara');
    assert.ok(/window\.addEventListener\("mousemove"/.test(src),
      'ninguém escuta mousemove fora do island, então a repulsão nunca roda');
    const i0 = src.indexOf('const pointerToLocal=');
    assert.ok(i0 >= 0, 'não achou a conversão de coordenada de página para o container');
    const i1 = src.indexOf('const onMouseMove=', i0);
    const corpo = src.slice(i0, i1 > i0 ? i1 : i0 + 800);
    assert.ok(/container\.getBoundingClientRect\(\)/.test(corpo),
      'a conversão não usa o getBoundingClientRect do container');
    assert.ok(/s\.mouseX=/.test(corpo) && /s\.mouseY=/.test(corpo),
      'a conversão não alimenta a posição do mouse no estado');
    assert.ok(/s\.mouseInside=true/.test(corpo), 'a conversão nunca marca o cursor como dentro');
    assert.ok(/pointerToLocal\(e\.clientX,e\.clientY\)/.test(src),
      'o handler de mouse não chama a conversão');
    assert.ok(/pointerToLocal\(e\.touches\[0\]\.clientX/.test(src),
      'o handler de toque não chama a conversão');
  });

  check('o laço para fora do viewport e o observer é desconectado na limpeza', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/new IntersectionObserver\(/.test(src),
      'não usa IntersectionObserver, contra a convenção do repo');
    assert.ok(/io\.observe\(container\)/.test(src),
      'o IntersectionObserver não observa o container do island');
    const anim = src.match(/function animate\(\)\{([\s\S]{0,300})/);
    assert.ok(anim, 'não achou a função animate');
    const inicio = anim[1].replace(/\s+/g, '');
    const posVis = inicio.indexOf('if(!visivel)');
    const posAgenda = inicio.indexOf('requestAnimationFrame(animate)');
    assert.ok(posVis >= 0, 'animate() não checa a visibilidade, então o laço roda fora da tela');
    assert.ok(posAgenda >= 0, 'não achou o agendamento de frame em animate()');
    assert.ok(posVis < posAgenda,
      'a checagem de visibilidade vem DEPOIS de agendar o frame, então o laço não para');
    const limpeza = src.match(/return\(\)=>\{[\s\S]*?\};\},\[/);
    assert.ok(limpeza, 'não achou a limpeza do useEffect');
    assert.ok(/io\.disconnect\(\)/.test(limpeza[0]),
      'o IntersectionObserver não é desconectado na limpeza do efeito');
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
    const m = read('assets/starfield-mount.mjs').match(/scrollPush:\s*(\d+)/);
    assert.ok(m, 'não achou scrollPush em starfield-mount.mjs');
    assert.ok(parseInt(m[1], 10) >= 24,
      'scrollPush ' + m[1] + ' é fraco: com a calibração atual o deslocamento não ' +
      'passa do ruído do twinkle');
  });

  const resumo = passed === total
    ? passed + ' verificações passaram'
    : passed + ' de ' + total + ' verificações passaram';
  console.log('\n' + resumo);
})();
