/* ============================================================
   WaveOps. Motor da seção de cinema.

   Cinco painéis de tela cheia que se empilham por scroll. Tudo é função da
   posição da página: nenhuma transição tem duração própria, então parar de
   rolar congela a imagem no quadro exato e rolar para trás desfaz quadro a
   quadro, igual raspar uma linha do tempo de vídeo.

   Sem dependência, sem import, sem build. Arquivo próprio, e não script
   inline, porque a CSP da página está em script-src 'self'.

   Três travas que este arquivo respeita:

   . o cinema é a EXCEÇÃO, não o padrão. Sem JavaScript, com este arquivo
     falhando, com prefers-reduced-motion, ou com o movimento pausado no botão
     da página, o visitante cai numa lista de cinco seções legíveis. A classe
     .viva é o único interruptor;

   . o palco depende de position: sticky, que morre em silêncio se o body virar
     contexto de rolagem. O CSS resolve isso com overflow-x: clip, e o motor só
     liga quando o navegador suporta clip, para os dois andarem juntos;

   . por quadro há UMA leitura de layout, feita antes de qualquer escrita, e
     depois só transform e opacity. Ler depois de escrever forçaria reflow
     síncrono a cada quadro.
   ============================================================ */
(function () {
  'use strict';

  var rail   = document.getElementById('cine-rail');
  var stage  = document.getElementById('cine-stage');
  if (!rail || !stage) { return; }

  var lista = Array.prototype.slice.call(stage.querySelectorAll('.cine-panel'));
  var N = lista.length;
  if (N === 0) { return; }

  /* ---------- Geometria do movimento, em unidades de painel ----------
     ESPERA_ENTRADA é o respiro com o painel 01 sozinho antes de o 02 começar
     a subir. ESPERA_SAIDA é o respiro com a pilha inteira montada antes de o
     bloco devolver a rolagem para a página. Sem os dois, o primeiro e o
     último painel nunca ficam parados tempo suficiente para serem lidos. */
  var ESPERA_ENTRADA = 0.28;
  var ESPERA_SAIDA   = 0.34;

  /* Quanto o painel coberto recua. Os quatro valores são multiplicados pelo
     acúmulo, não pela profundidade crua: o terceiro painel coberto recua bem
     menos que o primeiro, senão a pilha sairia de quadro.

     PASSO_SUBIDA é de propósito quase nulo. Com subida alta o painel coberto
     encosta o topo na borda da tela, a folga sobra só nas laterais e o olho
     lê cartão flutuando. Recuo quase simétrico lê como distância. */
  var PASSO_ESCALA = 0.075;  // fração de escala por unidade de acúmulo
  var PASSO_Z      = 60;     // px de recuo em Z por unidade de acúmulo
  var PASSO_SUBIDA = 0.012;  // fração da altura do palco por unidade
  var PASSO_VEU    = 0.46;   // opacidade de véu por unidade
  var TETO_VEU     = 0.80;

  /* A peça visual anda menos que o painel na entrada. Objeto mais fundo se
     desloca menos: é essa diferença, e não o ângulo sozinho, que faz o olho
     ler profundidade. */
  var ATRASO_PECA = 0.10;

  var PERSPECTIVA = 1500;

  /* ---------- Estado medido. Só muda em resize. ---------- */
  var alturaPalco = 800;
  var unidade     = 820;
  var percurso    = 3000;
  var estreito    = false;

  var ligado    = false;
  var agendado  = false;

  var reduzir = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  /* assets/motion.js é o dono único do movimento da página: ele escreve
     data-motion no <html> e avisa por waveops:motion. O cinema obedece. */
  function pausadoNaPagina() {
    return document.documentElement.getAttribute('data-motion') === 'paused';
  }

  /* Sem overflow: clip o CSS não consegue tirar o body do caminho do sticky, e
     o palco não gruda. Melhor cair na lista estática do que empilhar painel
     absoluto sem palco. */
  var suportaClip = !!(window.CSS && window.CSS.supports && window.CSS.supports('overflow', 'clip'));

  /* ---------- Cache de escrita ----------
     Guardar a última string escrita evita reescrever o mesmo valor em quadros
     parados, que é o caso mais comum durante uma rolagem suave. */
  var item = lista.map(function (el) {
    return {
      el:   el,
      veu:  el.querySelector('.cine-veu'),
      peca: el.querySelector('.cine-peca-caixa'),
      tr: '', vo: '', pt: ''
    };
  });

  var marcas = Array.prototype.slice.call(
    document.querySelectorAll('#cine-indice .cine-marca')
  ).map(function (li) {
    return {
      num: li.querySelector('b'),
      fio: li.querySelector('i'),
      botao: li.querySelector('.cine-alvo'),
      no: '', nf: '', na: ''
    };
  });

  /* Porta de instrumento. Fica de propósito: é por ela que a seção é medida no
     navegador, e ela não escreve nada, só publica o que o motor já calculou. */
  var estado = { p: 0, pct: 0, frente: 0, percurso: 0, unidade: 0, palco: 0 };
  window.__cine = estado;

  /* ---------- Matemática ---------- */
  function trava01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Mistura de linear com smoothstep. Smoothstep puro tem derivada zero nas
     duas pontas e o painel parece travado justamente quando o visitante
     começa ou termina de rolar. A mistura mantém movimento vivo nas bordas e
     ainda assim assenta no fim. */
  function passo(v) { v = trava01(v); return 0.22 * v + 0.78 * (v * v * (3 - 2 * v)); }

  /* Retorno decrescente por nível de profundidade. */
  function acumulo(d) { return d <= 0 ? 0 : 1.6 * (1 - Math.pow(0.55, d)); }

  /* ---------- Medição ---------- */
  function medir() {
    var largura = window.innerWidth || document.documentElement.clientWidth;
    estreito = largura < 768;

    alturaPalco = stage.getBoundingClientRect().height || window.innerHeight || 800;

    /* Unidade de percurso por capítulo. Desceu de 1,0 para 0,54 da altura do
       palco: a seção cobrava 5,87 telas de rolagem para cinco capítulos, e o
       visitante desistia antes do quarto. Medido em 1440x900: 5280px caem para
       cerca de 3150px, 3,5 telas. Os pisos desceram junto, senão eram eles que
       passariam a mandar e o 0,54 não valeria nada. */
    unidade = estreito
      ? Math.max(360, Math.min(620, alturaPalco * 0.54))
      : Math.max(400, Math.min(700, alturaPalco * 0.54));

    percurso = (ESPERA_ENTRADA + (N - 1) + ESPERA_SAIDA) * unidade;
    rail.style.height = Math.round(percurso + alturaPalco) + 'px';

    estado.percurso = Math.round(percurso);
    estado.unidade  = Math.round(unidade);
    estado.palco    = Math.round(alturaPalco);
  }

  /* ---------- Um quadro ---------- */
  function quadro() {
    agendado = false;
    if (!ligado) { return; }

    /* LEITURA: um getBoundingClientRect, no trilho, antes de qualquer escrita.
       Ler depois de escrever forçaria reflow síncrono a cada quadro. */
    var topo = rail.getBoundingClientRect().top;

    var rolado = -topo;
    if (rolado < 0) { rolado = 0; }
    if (rolado > percurso) { rolado = percurso; }

    /* p é o progresso em painéis. p = 1 quer dizer que o painel 02 acabou de
       cobrir o 01 por inteiro. */
    var p = (rolado - ESPERA_ENTRADA * unidade) / unidade;
    if (p < 0) { p = 0; }
    if (p > N - 1) { p = N - 1; }

    var i, it;
    for (i = 0; i < N; i++) {
      it = item[i];

      /* Entrada: o painel i sobe da base do palco entre p = i-1 e p = i.
         O primeiro nunca entra, ele já está lá. */
      var entrada = i === 0 ? 1 : passo(p - (i - 1));
      var yEntrada = (1 - entrada) * alturaPalco;

      /* Profundidade: quantos painéis já subiram por cima deste. Suavizada
         com a mesma curva da entrada para que o recuo do coberto e a subida
         do que cobre andem colados, sem defasagem visível. */
      var prof = p - i;
      if (prof < 0) { prof = 0; }
      if (prof > N - 1 - i) { prof = N - 1 - i; }
      var base = Math.floor(prof);
      var profSuave = base + passo(prof - base);
      if (profSuave > N - 1 - i) { profSuave = N - 1 - i; }

      var a = acumulo(profSuave);
      var escala = 1 - PASSO_ESCALA * a;
      var z      = -PASSO_Z * a;
      var y      = yEntrada - PASSO_SUBIDA * alturaPalco * a;

      var tr = 'perspective(' + PERSPECTIVA + 'px) translate3d(0,' +
               y.toFixed(2) + 'px,' + z.toFixed(2) + 'px) scale(' +
               escala.toFixed(4) + ')';
      if (tr !== it.tr) { it.tr = tr; it.el.style.transform = tr; }

      var veu = PASSO_VEU * a;
      if (veu > TETO_VEU) { veu = TETO_VEU; }
      var vo = veu.toFixed(3);
      if (vo !== it.vo) { it.vo = vo; it.veu.style.opacity = vo; }

      if (it.peca) {
        /* O sinal é negativo de propósito: a peça sobe menos que o painel, o
           que a faz parecer mais funda na cena. */
        var py = -(1 - entrada) * ATRASO_PECA * alturaPalco;
        var pt = 'translateY(calc(-50% + ' + py.toFixed(2) + 'px))';
        if (pt !== it.pt) { it.pt = pt; it.peca.style.transform = pt; }
      }
    }

    /* ---------- Indicador ---------- */
    var frente = Math.round(p);
    if (frente > N - 1) { frente = N - 1; }

    for (i = 0; i < marcas.length; i++) {
      var m = marcas[i];
      if (!m.num) { continue; }

      /* Cada marca preenche durante o turno do seu painel. O último não tem
         painel seguinte, então o turno dele é o respiro de saída. */
      var f;
      if (i === N - 1) {
        f = trava01((rolado - (ESPERA_ENTRADA + N - 1) * unidade) / (ESPERA_SAIDA * unidade));
      } else {
        f = trava01(p - i);
      }

      var no = i === frente ? '1' : '0.3';
      if (no !== m.no) { m.no = no; m.num.style.opacity = no; }

      var nf = 'scaleY(' + f.toFixed(3) + ')';
      if (nf !== m.nf) { m.nf = nf; m.fio.style.transform = nf; }

      /* aria-current diz ao leitor de tela em qual capítulo a cena está. Só
         escreve quando muda, como todo o resto deste laço. */
      if (m.botao) {
        var na = i === frente ? 'true' : 'false';
        if (na !== m.na) { m.na = na; m.botao.setAttribute('aria-current', na); }
      }
    }

    estado.p = Math.round(p * 1000) / 1000;
    estado.pct = percurso > 0 ? Math.round((rolado / percurso) * 1000) / 10 : 0;
    estado.frente = frente + 1;
  }

  function agendar() {
    if (agendado || !ligado) { return; }
    agendado = true;
    requestAnimationFrame(quadro);
  }

  /* ---------- Liga e desliga ---------- */
  function limpar() {
    rail.style.height = '';
    for (var i = 0; i < N; i++) {
      var it = item[i];
      it.el.style.transform = ''; it.tr = '';
      it.veu.style.opacity = '';  it.vo = '';
      if (it.peca) { it.peca.style.transform = ''; it.pt = ''; }
    }
    for (var k = 0; k < marcas.length; k++) {
      if (!marcas[k].num) { continue; }
      marcas[k].num.style.opacity = '';
      marcas[k].fio.style.transform = '';
      marcas[k].no = ''; marcas[k].nf = '';
      if (marcas[k].botao) { marcas[k].botao.removeAttribute('aria-current'); marcas[k].na = ''; }
    }
  }

  /* ---------- Pular para um capítulo ----------
     O indicador deixa de ser enfeite e vira navegação. O alvo é a posição de
     rolagem em que p vale exatamente j, ou seja o capítulo parado no lugar.
     Rolagem normal do navegador: nada de sequestro, e o visitante pode
     interromper no meio. */
  function irPara(j) {
    if (!ligado) { return; }
    var topoDoc = rail.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
    var alvo = topoDoc + (ESPERA_ENTRADA + j) * unidade;
    var suave = !(reduzir && reduzir.matches) && !pausadoNaPagina();
    window.scrollTo({ top: Math.round(alvo), behavior: suave ? 'smooth' : 'auto' });
  }

  for (var b = 0; b < marcas.length; b++) {
    (function (j, alvo) {
      if (!alvo) { return; }
      alvo.addEventListener('click', function () { irPara(j); });
    })(b, marcas[b].botao);
  }

  function preferencia() {
    var quer = suportaClip && !pausadoNaPagina() && !(reduzir && reduzir.matches);
    if (quer === ligado) { return; }
    ligado = quer;

    if (ligado) {
      rail.classList.add('viva');
      medir();
      agendado = true;
      requestAnimationFrame(quadro);
    } else {
      rail.classList.remove('viva');
      limpar();
    }
  }

  /* ---------- Eventos ---------- */
  window.addEventListener('scroll', agendar, { passive: true });

  var tempoResize = 0;
  window.addEventListener('resize', function () {
    if (!ligado) { return; }
    clearTimeout(tempoResize);
    tempoResize = setTimeout(function () { medir(); agendar(); }, 140);
  }, { passive: true });

  if (reduzir) {
    if (reduzir.addEventListener) { reduzir.addEventListener('change', preferencia); }
    else if (reduzir.addListener) { reduzir.addListener(preferencia); }
  }

  /* O botão de pausa da página desmonta o empilhamento na hora, e o visitante
     fica com as cinco seções abertas em lista. Estado completo, nunca vazio. */
  window.addEventListener('waveops:motion', preferencia);

  /* A fonte de display chega depois do primeiro quadro e muda a altura do
     texto. Remedir aí evita o painel nascer com o curso calculado sobre a
     fonte de fallback. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (ligado) { medir(); agendar(); } });
  }
  window.addEventListener('load', function () { if (ligado) { medir(); agendar(); } });

  preferencia();
})();
