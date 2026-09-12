/* WaveOps: a operação viva.

   Um arquivo para o comportamento dos blocos novos: o laço de eventos do
   hero, a entrega do hero para a seção seguinte, o pulso da rede de
   integrações e a linha que avança no percurso.

   Três regras que este arquivo segue de ponta a ponta:

   1. Um requestAnimationFrame para a página inteira. O listener de scroll
      só agenda; quem lê o layout e escreve as variáveis é o quadro.
   2. Movimento é melhoria, nunca requisito. Se este arquivo não carregar,
      a página continua completa: os nós ficam apagados, a linha do
      percurso fica vazia e nada some.
   3. Pausar é de verdade. Tanto a preferência do sistema quanto o botão
      da página derrubam os temporizadores, e o estado que fica é o
      estado final legível, nunca uma tela pela metade. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var preferencia = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function movimentoPausado() {
    return raiz.dataset.motion === 'paused' || Boolean(preferencia && preferencia.matches);
  }

  function limita(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  /* Reinicia uma animação CSS que já rodou. Sem o reflow no meio, o
     navegador junta a remoção e a adição no mesmo quadro e nada acontece. */
  function reiniciar(el, classe) {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
  }

  /* ==================================================================
     1. Leitor de scroll

     Uma leitura de layout por quadro, duas escritas de variável. O hero
     usa --saida para se despedir; o percurso usa --percurso para avançar
     a linha. Nada disto sequestra o scroll: o visitante rola normal.
     ================================================================== */
  var hero = document.querySelector('.hero');
  var como = document.getElementById('como');
  var trilhoEtapas = como ? como.querySelector('.steps') : null;
  var etapas = como ? Array.prototype.slice.call(como.querySelectorAll('.step')) : [];
  var quadroScroll = 0;

  function lerScroll() {
    quadroScroll = 0;
    var altura = window.innerHeight || 1;

    if (hero) {
      var rh = hero.getBoundingClientRect();
      var passado = limita(-rh.top, 0, rh.height);
      var saida = rh.height > 0 ? limita(passado / (rh.height * 0.85), 0, 1) : 0;
      // A copy sai depois da janela. Medido: com a mesma curva, o botao
      // principal chegava a 68% de opacidade ainda visivel na tela.
      var saida2 = limita((saida - 0.4) / 0.6, 0, 1);
      hero.style.setProperty('--saida', saida.toFixed(3));
      hero.style.setProperty('--saida2', saida2.toFixed(3));
    }

    if (como && trilhoEtapas && etapas.length) {
      var rc = trilhoEtapas.getBoundingClientRect();
      // Ancorado na fileira de etapas, não na seção: a seção tem quase 700px
      // de altura e o percurso completava antes de a fileira aparecer. Aqui a
      // linha começa a encher quando as etapas cruzam 78% da tela e termina
      // aos 30%, o que dá quase meia tela de avanço.
      var bruto = (altura * 0.78 - rc.top) / Math.max(1, altura * 0.48);
      var percurso = limita(bruto, 0, 1);
      como.style.setProperty('--percurso', percurso.toFixed(3));
      for (var i = 0; i < etapas.length; i++) {
        etapas[i].classList.toggle('ativo', percurso >= i / etapas.length);
      }
    }
  }

  function agendarScroll() {
    if (!quadroScroll) quadroScroll = window.requestAnimationFrame(lerScroll);
  }

  if (hero || como) {
    window.addEventListener('scroll', agendarScroll, { passive: true });
    window.addEventListener('resize', agendarScroll);
    lerScroll();
  }

  /* ==================================================================
     2. Pausa fora de quadro

     Animação que roda atrás do visitante é bateria queimada à toa. Um
     observador só, compartilhado, liga e desliga a classe .em-cena.
     ================================================================== */
  var emCena = document.querySelectorAll('[data-em-cena]');
  if (emCena.length && 'IntersectionObserver' in window) {
    var observadorCena = new IntersectionObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) {
        entradas[i].target.classList.toggle('em-cena', entradas[i].isIntersecting);
      }
    }, { rootMargin: '80px 0px' });
    for (var c = 0; c < emCena.length; c++) observadorCena.observe(emCena[c]);
  } else {
    for (var c2 = 0; c2 < emCena.length; c2++) emCena[c2].classList.add('em-cena');
  }

  /* ==================================================================
     3. Laço de eventos do hero

     Sete eventos em rodízio lento. Cada um acende UM nó, dispara no
     máximo UM pulso e escreve UMA linha no registro. Nunca dois ao mesmo
     tempo: com dois acesos o olho perde a ordem da leitura, e a ordem é
     justamente o que a composição precisa contar.
     ================================================================== */
  var janela = document.querySelector('.hero .flow-canvas');
  var registro = document.querySelector('.hv-registro');

  if (janela && registro) {
    var nos = {};
    var listaNos = janela.querySelectorAll('[data-no]');
    for (var n = 0; n < listaNos.length; n++) nos[listaNos[n].dataset.no] = listaNos[n];

    /* Cada chave guarda uma lista, nao um elemento: existem dois conjuntos
       de fios, o de tela larga e o de celular. So um deles esta visivel, e
       elemento com display:none nao anima, entao disparar os dois nao custa
       nada e evita ter que descobrir qual esta no ar. */
    var fios = {};
    var listaFios = janela.querySelectorAll('[data-fio]');
    for (var f = 0; f < listaFios.length; f++) {
      var chave = listaFios[f].dataset.fio;
      if (!fios[chave]) fios[chave] = [];
      fios[chave].push(listaFios[f]);
    }

    var linhas = Array.prototype.slice.call(registro.querySelectorAll('.hv-linha'));
    var hub = nos.hub;
    var hubBase = hub ? hub.querySelector('.sb').textContent : '';

    /* A entrada muda de lado a cada volta. São duas portas de entrada
       reais na composição, e deixar uma delas sempre apagada faria a
       segunda parecer enfeite. */
    var EVENTOS = [
      { texto: 'Novo lead', no: 'entrada', fio: 'entrada', espera: 1300 },
      { texto: 'IA qualificando…', no: 'hub', pensa: true, espera: 1500 },
      { texto: 'Score: 87', no: 'hub', sub: 'score 87', espera: 1400 },
      { texto: 'CRM atualizado', no: 'crm', fio: 'f3', espera: 1300 },
      { texto: 'Follow-up enviado', no: 'follow', fio: 'f4', espera: 1500 },
      { texto: 'Pagamento aprovado', no: 'pag', fio: 'f5', espera: 1300 },
      { texto: 'Dashboard atualizado', painel: true, espera: 3000 }
    ];

    var passo = 0;
    var volta = 0;
    var temporizador = 0;
    var rodando = false;
    var visivel = true;

    function agora() {
      var d = new Date();
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    /* Anel de quatro linhas. A mais velha volta para o topo sem transição
       e invisível, recebe o texto novo e só então reaparece. Sem a volta
       muda, ela desenharia um rastro atravessando o registro inteiro. */
    function empurrar(texto) {
      var nova = null;
      for (var i = 0; i < linhas.length; i++) {
        if (Number(linhas[i].dataset.s) === linhas.length - 1) nova = linhas[i];
      }
      if (!nova) return;

      nova.classList.add('reciclando');
      void nova.offsetWidth;

      for (var j = 0; j < linhas.length; j++) {
        var s = (Number(linhas[j].dataset.s) + 1) % linhas.length;
        linhas[j].dataset.s = String(s);
        linhas[j].style.setProperty('--s', String(s));
      }

      nova.querySelector('.hv-txt').textContent = texto;
      nova.querySelector('.hv-hora').textContent = agora();
      void nova.offsetWidth;
      nova.classList.remove('reciclando');
    }

    function apagarTudo() {
      for (var k in nos) {
        if (Object.prototype.hasOwnProperty.call(nos, k)) nos[k].classList.remove('aceso');
      }
      if (hub) hub.classList.remove('pensando');
    }

    function tocar() {
      var evento = EVENTOS[passo];
      apagarTudo();

      // A porta de entrada alterna entre o WhatsApp e o formulário do site.
      var chaveNo = evento.no === 'entrada' ? (volta % 2 === 0 ? 'lead' : 'site') : evento.no;
      var chaveFio = evento.fio === 'entrada' ? (volta % 2 === 0 ? 'f1' : 'f2') : evento.fio;

      if (chaveNo && nos[chaveNo]) nos[chaveNo].classList.add('aceso');
      if (evento.pensa && hub) hub.classList.add('pensando');
      if (hub) hub.querySelector('.sb').textContent = evento.sub || hubBase;
      if (chaveFio && fios[chaveFio]) {
        for (var p = 0; p < fios[chaveFio].length; p++) reiniciar(fios[chaveFio][p], 'corre');
      }
      if (evento.painel) reiniciar(registro, 'atualiza');

      empurrar(evento.texto);

      passo += 1;
      if (passo >= EVENTOS.length) { passo = 0; volta += 1; }
      temporizador = window.setTimeout(tocar, evento.espera);
    }

    function comecar(atraso) {
      if (rodando || movimentoPausado() || !visivel) return;
      rodando = true;
      temporizador = window.setTimeout(tocar, atraso || 0);
    }

    function parar() {
      rodando = false;
      window.clearTimeout(temporizador);
      temporizador = 0;
      apagarTudo();
      if (hub) hub.querySelector('.sb').textContent = hubBase;
      registro.classList.remove('atualiza');
    }

    /* O laço só começa depois da entrada do hero terminar. Ver a tela
       existir antes de vê-la trabalhar é o que o roteiro pede. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entradas) {
        visivel = entradas[0].isIntersecting;
        if (visivel) comecar(0); else parar();
      }, { threshold: 0.15 }).observe(janela);
    }
    comecar(1600);

    window.addEventListener('waveops:motion', function () {
      if (movimentoPausado()) parar(); else comecar(300);
    });
    if (preferencia) {
      var mudouPreferencia = function () { if (movimentoPausado()) parar(); else comecar(300); };
      if (preferencia.addEventListener) preferencia.addEventListener('change', mudouPreferencia);
      else if (preferencia.addListener) preferencia.addListener(mudouPreferencia);
    }
  }

  /* ==================================================================
     4. Rede de integrações

     Um sinal por vez, saindo de uma ferramenta e chegando ao centro. A
     ferramenta da vez acende junto, então o pulso tem dono: quem olha
     sabe de onde o dado veio.
     ================================================================== */
  var rede = document.querySelector('.rede');
  if (rede) {
    var pulsosRede = Array.prototype.slice.call(rede.querySelectorAll('.rede-pulso'));
    var itensRede = Array.prototype.slice.call(rede.querySelectorAll('.rede-item'));
    var centroRede = rede.querySelector('.rede-centro');
    var vez = 0;
    var relogioRede = 0;
    var relogioAnel = 0;
    var redeVisivel = false;

    function pulsarRede() {
      var alvo = vez % pulsosRede.length;
      for (var i = 0; i < itensRede.length; i++) itensRede[i].classList.toggle('aceso', i === alvo);
      reiniciar(pulsosRede[alvo], 'corre');
      // O anel do centro confirma a chegada, um pouco depois do traco
      // terminar o percurso. Sem isso a rede parece de mao unica.
      window.clearTimeout(relogioAnel);
      relogioAnel = window.setTimeout(function () {
        reiniciar(centroRede, 'recebe');
      }, 1150);
      vez += 1;
    }

    function ligarRede() {
      if (relogioRede || movimentoPausado() || !redeVisivel) return;
      pulsarRede();
      relogioRede = window.setInterval(pulsarRede, 2000);
    }

    function desligarRede() {
      window.clearInterval(relogioRede);
      window.clearTimeout(relogioAnel);
      relogioRede = 0;
      relogioAnel = 0;
      for (var i = 0; i < itensRede.length; i++) itensRede[i].classList.remove('aceso');
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entradas) {
        redeVisivel = entradas[0].isIntersecting;
        if (redeVisivel) ligarRede(); else desligarRede();
      }, { threshold: 0.2 }).observe(rede);
    } else {
      redeVisivel = true;
      ligarRede();
    }

    window.addEventListener('waveops:motion', function () {
      if (movimentoPausado()) desligarRede(); else ligarRede();
    });
  }
})();
