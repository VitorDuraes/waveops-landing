/* ============================================================
   WaveOps. Motor da cena: uma janela só que se transforma pelo scroll.

   A moldura da janela permanece a cena inteira. O que muda é o conteúdo dela,
   o rótulo da barra de título e o bloco de texto ao lado, tudo amarrado ao
   mesmo progresso. Tudo é função da posição da página: nenhuma transição tem
   duração própria, então parar de rolar congela a imagem no quadro exato e
   rolar para trás desfaz quadro a quadro, igual raspar uma linha do tempo.

   Cada estado tem duas faixas. REPOUSO é a maior parte: nada se move e a
   pessoa lê. TRANSFORMAÇÃO é o resto: o estado que sai recua e apaga, o que
   entra chega e acende, e o cartão da lead viaja de um ponto ao outro.

   Sem dependência, sem import, sem build. Arquivo próprio, e não script
   inline, porque a CSP da página está em script-src 'self'.

   Quatro travas que este arquivo respeita:

   . a cena é a EXCEÇÃO, não o padrão. Sem JavaScript, com este arquivo
     falhando, com prefers-reduced-motion, ou com o movimento pausado no botão
     da página, o visitante cai numa janela congelada no estado 01, completa e
     legível, mais os cinco estados em lista. A classe .viva é o único
     interruptor;

   . o palco depende de position: sticky, que morre em silêncio se o body virar
     contexto de rolagem. O CSS resolve isso com overflow-x: clip, e o motor só
     liga quando o navegador suporta clip, para os dois andarem juntos;

   . por quadro há UMA leitura de layout, feita antes de qualquer escrita, e
     depois só transform e opacity. Ler depois de escrever forçaria reflow
     síncrono a cada quadro;

   . nada de will-change. O mecanismo anterior promovia cinco elementos do
     tamanho da viewport, o que não compra nada: quem recebe transform aqui é
     o quadro dentro da janela, e o navegador já o promove sozinho.
   ============================================================ */
(function () {
  'use strict';

  var rail  = document.getElementById('cena-rail');
  var stage = document.getElementById('cena-stage');
  var tela  = document.getElementById('cena-tela');
  var lead  = document.getElementById('cena-lead');
  if (!rail || !stage || !tela) { return; }

  var quadros = Array.prototype.slice.call(tela.querySelectorAll('.cena-quadro'));
  var N = quadros.length;
  if (N < 2) { return; }

  /* ---------- Geometria do percurso, em unidades de estado ----------
     ESPERA_ENTRADA é o respiro com o estado 01 sozinho antes de a primeira
     transformação começar. ESPERA_SAIDA é o respiro com o estado 05 montado
     antes de a cena devolver a rolagem para a página. Sem os dois, o primeiro
     e o último estado nunca ficam parados tempo suficiente para serem lidos. */
  var ESPERA_ENTRADA = 0.25;
  var ESPERA_SAIDA   = 0.45;

  /* A fatia de cada unidade que é repouso. O resto é transformação. Acima de
     0.5 a leitura ganha da animação, que é o pedido: a maior parte do percurso
     a imagem está parada. */
  var REPOUSO = 0.60;

  /* Sobreposição entre o que apaga e o que acende. Com 0.42 o que sai já está
     quase invisível quando o que entra começa, então as duas maquetes não se
     misturam numa sopa de linhas: a troca lê como corte, não como fantasma. */
  var CRUZA_INICIO = 0.42;
  var CRUZA_CURSO  = 0.58;

  /* Deslocamento e escala do quadro durante a transformação. Valores baixos de
     propósito: o que conta a mudança é o cartão da lead viajando, não o quadro
     saltando. */
  var DESLOCA = 1.8;    // por cento da altura do quadro
  var ESCALA  = 0.022;  // fração de escala

  /* ---------- Onde o cartão da lead descansa em cada estado ----------
     Fração da tela da janela. A primeira entrada de cada conjunto é a posição
     que o CSS já declara, então o deslocamento escrito por quadro é sempre a
     diferença para ela: com JavaScript desligado o cartão já nasce certo.

     AMPLO é a composição desenhada: o cartão pousa perto da superfície em que
     a Ana M. aparece naquele estado. COMPACTO é a faixa de baixo, onde o
     arranjo em fluxo reserva espaço para ele; ali ele só corre na horizontal. */
  var ANCORA_AMPLO = [
    [0.02, 0.895],  // 01 logo abaixo da janela da conversa
    [0.55, 0.895],  // 02 canto oposto, abaixo da janela do WhatsApp
    [0.19, 0.845],  // 03 na faixa livre entre a última linha da tabela e o rodapé
    [0.38, 0.77],   // 04 entre o registro de revisões e a regra do agente
    [0.70, 0.62]    // 05 sobre a arte do site publicado
  ];
  var ANCORA_COMPACTO = [
    [0.00, 0], [0.24, 0], [0.48, 0], [0.24, 0], [0.00, 0]
  ];

  /* ---------- Estado medido. Só muda em resize. ---------- */
  var alturaPalco = 800;
  var unidade     = 760;
  var percurso    = 3000;
  var telaW = 800, telaH = 460;
  var leadW = 160, leadH = 44, leadX0 = 0, leadY0 = 0;
  var amplo = true;

  var ligado   = false;
  var agendado = false;

  var reduzir = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  /* assets/motion.js é o dono único do movimento da página: ele escreve
     data-motion no <html> e avisa por waveops:motion. A cena obedece. */
  function pausadoNaPagina() {
    return document.documentElement.getAttribute('data-motion') === 'paused';
  }

  /* Sem overflow: clip o CSS não consegue tirar o body do caminho do sticky, e
     o palco não gruda. Melhor cair na lista estática do que rodar o motor com
     o palco solto. */
  var suportaClip = !!(window.CSS && window.CSS.supports && window.CSS.supports('overflow', 'clip'));

  /* ---------- Cache de escrita ----------
     Guardar a última string escrita evita reescrever o mesmo valor em quadros
     parados, que é o caso mais comum durante uma rolagem suave. Em regime, só
     os dois estados envolvidos na transformação escrevem alguma coisa. */
  function porCena(raiz, seletor) {
    var fora = [], i;
    var achados = raiz ? raiz.querySelectorAll(seletor) : [];
    for (i = 0; i < N; i++) { fora[i] = achados[i] || null; }
    return fora;
  }

  var titulos = porCena(document, '.cena-barra-titulo');
  var chips   = porCena(document, '.cena-barra-chip');
  var falas   = porCena(document, '.cena-fala');
  var origens = porCena(lead, '.cena-lead-origem');
  var etapas  = porCena(lead, '.cena-lead-etapa');

  var grupo = quadros.map(function (q, i) {
    return {
      /* Tudo que pertence ao mesmo estado acende e apaga junto, com um valor
         só: quadro, rótulo da barra, chip da barra, texto ao lado e os dois
         campos que trocam no cartão da lead. */
      juntos: [q, titulos[i], chips[i], falas[i], origens[i], etapas[i]].filter(Boolean),
      quadro: q,
      o: '', tr: ''
    };
  });

  var marcas = Array.prototype.slice.call(
    document.querySelectorAll('#cena-indice .cena-marca')
  ).map(function (li) {
    return { num: li.querySelector('b'), fio: li.querySelector('i'), no: '', nf: '' };
  });

  /* Porta de instrumento. Fica de propósito: é por ela que a cena é medida no
     navegador, e ela não escreve nada, só publica o que o motor já calculou. */
  var estado = { p: 0, pct: 0, frente: 1, percurso: 0, unidade: 0, amplo: true };
  window.__cena = estado;

  /* ---------- Matemática ---------- */
  function trava01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Mistura de linear com smoothstep. Smoothstep puro tem derivada zero nas
     duas pontas e a imagem parece travada justamente quando o visitante começa
     ou termina de rolar. A mistura mantém movimento vivo nas bordas e ainda
     assim assenta no fim. */
  function suave(v) { v = trava01(v); return 0.2 * v + 0.8 * (v * v * (3 - 2 * v)); }

  /* ---------- Medição ---------- */
  function medir() {
    alturaPalco = stage.getBoundingClientRect().height || window.innerHeight || 800;

    var cx = tela.getBoundingClientRect();
    telaW = cx.width  || 800;
    telaH = cx.height || 460;

    /* O mesmo envelope da consulta de contêiner do CSS (item 17 de
       cinema.css): 62em por 37em. Ler o corpo base aqui em vez de repetir
       número mágico mantém as duas decisões amarradas. */
    var fs = parseFloat(window.getComputedStyle(tela).fontSize) || 12;
    amplo = telaW >= 62 * fs && telaH >= 37 * fs;

    if (lead) {
      var lx = lead.getBoundingClientRect();
      leadW = lx.width  || 160;
      leadH = lx.height || 44;
      /* offsetLeft e offsetTop ignoram transform, então eles devolvem a posição
         de layout do cartão, que é a do estado 01 declarada no CSS. É dela que
         o deslocamento por quadro é medido. */
      leadX0 = lead.offsetLeft;
      leadY0 = lead.offsetTop;
    }

    /* Unidade de percurso por estado. Perto da altura do palco: menos que isso
       e a transformação vira estalo, mais e a pessoa rola muito para pouca
       coisa acontecer. */
    unidade = amplo
      ? Math.max(560, Math.min(980, alturaPalco * 0.95))
      : Math.max(440, Math.min(820, alturaPalco * 0.82));

    percurso = (ESPERA_ENTRADA + (N - 1) + ESPERA_SAIDA) * unidade;
    rail.style.height = Math.round(percurso + alturaPalco) + 'px';

    estado.percurso = Math.round(percurso);
    estado.unidade  = Math.round(unidade);
    estado.amplo    = amplo;
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

    /* p é o progresso em estados. p = 1 quer dizer que o estado 02 acabou de
       assumir a janela por inteiro. */
    var p = (rolado - ESPERA_ENTRADA * unidade) / unidade;
    if (p < 0) { p = 0; }
    if (p > N - 1) { p = N - 1; }

    /* i é o estado que está saindo, i + 1 o que está entrando. No fim do
       percurso i trava em N - 2 e f vale 1, ou seja, o estado N inteiro. */
    var i = Math.floor(p);
    if (i > N - 2) { i = N - 2; }
    var f = p - i;

    /* k é zero durante a faixa de repouso e sobe de 0 a 1 na faixa de
       transformação. É o único número que a cena inteira consome. */
    var k = f <= REPOUSO ? 0 : suave((f - REPOUSO) / (1 - REPOUSO));

    var j, g;
    for (j = 0; j < N; j++) {
      g = grupo[j];

      /* q é a distância assinada do estado j até o quadro atual da
         transformação: positiva para quem sai, negativa para quem entra. Uma
         fórmula só serve os dois, e o sinal cuida da direção. */
      var q = 0, o = 0;
      if (j === i)          { q = k;     o = 1 - trava01(k / CRUZA_CURSO); }
      else if (j === i + 1) { q = k - 1; o = trava01((k - CRUZA_INICIO) / CRUZA_CURSO); }

      var texto = o.toFixed(3);
      if (texto !== g.o) {
        g.o = texto;
        for (var m = 0; m < g.juntos.length; m++) { g.juntos[m].style.opacity = texto; }
      }

      var tr = q === 0
        ? 'none'
        : 'translate3d(0,' + (-DESLOCA * q).toFixed(3) + '%,0) scale(' + (1 - ESCALA * q).toFixed(4) + ')';
      if (tr !== g.tr) { g.tr = tr; g.quadro.style.transform = tr; }
    }

    /* ---------- O cartão da lead ----------
       Ele nunca apaga. Durante a transformação ele anda do ponto de repouso do
       estado que sai até o do estado que entra, e é essa continuidade que faz
       a cena parecer uma coisa só. */
    if (lead) {
      var ancora = amplo ? ANCORA_AMPLO : ANCORA_COMPACTO;
      var a = ancora[i], b = ancora[i + 1];
      var x = (a[0] + (b[0] - a[0]) * k) * telaW;
      var y = amplo ? (a[1] + (b[1] - a[1]) * k) * telaH : leadY0;

      /* Trava de borda antes de virar deslocamento: a folga real é a tela menos
         o próprio cartão, então nenhuma âncora consegue empurrar texto para
         fora do quadro, em nenhuma largura. */
      var folgaX = telaW - leadW - 8;
      if (x > folgaX) { x = folgaX; }
      if (x < 8) { x = 8; }
      if (amplo) {
        var folgaY = telaH - leadH - 8;
        if (y > folgaY) { y = folgaY; }
        if (y < 8) { y = 8; }
      }

      /* O motor escreve deslocamento, não posição: a posição de layout é a do
         estado 01, declarada no CSS, e com JavaScript desligado o cartão já
         nasce no lugar certo. */
      var lt = 'translate3d(' + (x - leadX0).toFixed(2) + 'px,' + (y - leadY0).toFixed(2) + 'px,0)';
      if (lt !== lead.__tr) { lead.__tr = lt; lead.style.transform = lt; }
    }

    /* ---------- Indicador ---------- */
    var frente = k >= 0.5 ? i + 1 : i;

    for (j = 0; j < marcas.length; j++) {
      var mk = marcas[j];
      if (!mk.num) { continue; }

      /* Cada marca preenche durante o turno do seu estado. O último não tem
         estado seguinte, então o turno dele é o respiro de saída. */
      var fill;
      if (j === N - 1) {
        fill = trava01((rolado - (ESPERA_ENTRADA + N - 1) * unidade) / (ESPERA_SAIDA * unidade));
      } else {
        fill = trava01(p - j);
      }

      var no = j === frente ? '1' : '0.3';
      if (no !== mk.no) { mk.no = no; mk.num.style.opacity = no; }

      var nf = 'scaleX(' + fill.toFixed(3) + ')';
      if (nf !== mk.nf) { mk.nf = nf; mk.fio.style.transform = nf; }
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
    for (var j = 0; j < N; j++) {
      var g = grupo[j];
      for (var m = 0; m < g.juntos.length; m++) { g.juntos[m].style.opacity = ''; }
      g.quadro.style.transform = '';
      g.o = ''; g.tr = '';
    }
    for (j = 0; j < marcas.length; j++) {
      if (!marcas[j].num) { continue; }
      marcas[j].num.style.opacity = '';
      marcas[j].fio.style.transform = '';
      marcas[j].no = ''; marcas[j].nf = '';
    }
    if (lead) { lead.style.transform = ''; lead.__tr = ''; }
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

  /* O botão de pausa da página desmonta a cena na hora, e o visitante fica com
     a janela congelada no estado 01 mais os cinco estados em lista. Estado
     completo, nunca vazio. */
  window.addEventListener('waveops:motion', preferencia);

  /* A fonte de display chega depois do primeiro quadro e muda a altura do
     texto, que é o que define quanto de tela sobra para a janela. Remedir aí
     evita a cena nascer com o percurso calculado sobre a fonte de fallback. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (ligado) { medir(); agendar(); } });
  }
  window.addEventListener('load', function () { if (ligado) { medir(); agendar(); } });

  preferencia();
})();
