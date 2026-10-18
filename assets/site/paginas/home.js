// @ts-check
/* WaveOps · módulo da Home. Só a Home carrega este arquivo.

   Palco de fundo das cinco frentes (spec 13). Melhoria progressiva, nunca requisito: sem este
   módulo, com menos movimento ou com a janela abaixo de 560 px de altura, cada capítulo mostra o
   painel e a cena montada, lado a lado (desktop) ou um embaixo do outro (celular).

   Marcação esperada (index.html):
     .wo-fundo                  fundo vivo da página (parcial fundo): pôster e vídeo
     [data-palco]               a seção das cinco frentes
       [data-frente="..."]      cada capítulo, em ordem, com o .wo-home-painel e a cena
         [data-cena="..."]      a cena do capítulo
           [data-passo="1".."n"]  peças da cena; um passo pode ter mais de uma peça
     [data-palco] + section     a primeira seção depois do palco

   Estado que só este módulo escreve:
     data-palco-modo="fundo"   na seção; sem ele, o palco está desligado
     --wo-palco-escala         na seção: quanto a cena encolhe para caber na área útil
     --wo-palco-corte-cena     na seção: quanto da cena fixa a primeira seção depois do palco cobre
     --wo-palco-corte-painel   na seção: o mesmo para o painel fixo do celular
     data-ativa                no capítulo e na cena da vez
     data-visivel              em cada peça já montada
     data-capitulo             no fundo, com o nome do capítulo da vez: a onda escurece
     data-palco-oculto         no WhatsApp flutuante enquanto o painel ocupa o canto dele
   O CSS (paginas/home.css) só fixa e esconde as cenas quando a seção tem data-palco-modo: se
   este módulo falhar, nada some. As contas ficam em lib/palco.js. O vídeo do fundo é de toda
   página e fica em fundo.js: ele continua tocando durante os capítulos (spec 15.3). */
import { MIDIA_PALCO, CENA_DESKTOP, CENA_CELULAR, estadoFixo, escalaDaCena } from '../lib/palco.js';

/** A partir desta largura a cena usa o desenho do desktop e o painel fica ao lado dela (home.css). */
const MIDIA_DESKTOP = '(min-width: 1024px)';
/** Respiro entre a cena e o painel do celular, que fica embaixo dela (spec 13.3). */
const RESPIRO_DO_PAINEL = 16;

/**
 * Liga ou desliga um atributo sem valor.
 * @param {Element} elemento
 * @param {string} nome
 * @param {boolean} ligado
 */
function marcar(elemento, nome, ligado) {
  if (ligado) elemento.setAttribute(nome, '');
  else elemento.removeAttribute(nome);
}

/** @param {HTMLElement} peca */
const passoDe = (peca) => Number(peca.dataset.passo) || 0;

/**
 * Encerra as transições em andamento, para o estado aparecer pronto.
 * @param {(Element | null)[]} elementos
 */
function encerrarTransicoes(elementos) {
  if (typeof CSSTransition !== 'function') return;
  for (const elemento of elementos) {
    if (!elemento || !('getAnimations' in elemento)) continue;
    for (const animacao of elemento.getAnimations({ subtree: true })) {
      if (animacao instanceof CSSTransition) animacao.finish();
    }
  }
}

/**
 * Liga o palco de fundo: fixa as cenas na tela e monta a do capítulo da vez com a rolagem.
 * @param {Document} doc
 * @param {Window} janela
 */
export function iniciarPalco(doc = document, janela = window) {
  const secao = doc.querySelector('[data-palco]');
  if (!(secao instanceof HTMLElement)) return;
  const capitulos = /** @type {HTMLElement[]} */ ([...secao.querySelectorAll('[data-frente]')]);
  const cenas = capitulos.map((capitulo) => capitulo.querySelector('[data-cena]'));
  const paineis = capitulos.map((capitulo) => capitulo.querySelector('.wo-home-painel'));
  if (!capitulos.length || cenas.some((cena) => !cena) || paineis.some((painel) => !painel)) return;
  const cenasProntas = /** @type {HTMLElement[]} */ (cenas);
  const paineisProntos = /** @type {HTMLElement[]} */ (paineis);
  const fundo = doc.querySelector('.wo-fundo');
  const depois = secao.nextElementSibling;
  const flutuante = doc.querySelector('.wo-whatsapp-flutuante');
  const pecas = cenasProntas.map((cena) => /** @type {HTMLElement[]} */ ([...cena.querySelectorAll('[data-passo]')]));
  const totais = pecas.map((lista) => Math.max(0, ...lista.map(passoDe)));

  const menosMovimento = janela.matchMedia('(prefers-reduced-motion: reduce)');
  const midiaPalco = janela.matchMedia(MIDIA_PALCO);
  const midiaDesktop = janela.matchMedia(MIDIA_DESKTOP);

  let ligado = false;
  // O que já está escrito no DOM, para cada quadro escrever só a diferença. Passo 0 é cena vazia.
  let ativaEscrita = -1;
  let passosEscritos = cenasProntas.map(() => 0);
  let escalaEscrita = '';
  let corteEscrito = '';
  let flutuanteOcultoEscrito = false;
  let acabouDeLigar = false;
  let pedido = 0;

  const quadro = () => {
    pedido = 0;
    if (!ligado) return;

    // Primeiro todas as leituras.
    const caixas = capitulos.map((capitulo) => {
      const caixa = capitulo.getBoundingClientRect();
      return { topo: caixa.top, altura: caixa.height };
    });
    const { ativa, passo } = estadoFixo(caixas, janela.innerHeight, totais);
    // Depois do palco (spec 15.4): quando o fim da seção passa da metade da janela, a mesma linha que
    // liga um capítulo, nenhuma cena fica na tela e a onda volta ao brilho inteiro, porque o véu das
    // seções seguintes é translúcido. A cena do último capítulo continua montada, para voltar inteira
    // quando a pessoa sobe.
    const mostrada = secao.getBoundingClientRect().bottom > janela.innerHeight / 2 ? ativa : -1;
    // Área útil: o CSS fixa as cinco cenas no mesmo lugar, e a caixa delas já é a área (desktop:
    // colunas 6 a 12, do topo fixo mais 32 px até 32 px do fim; celular: do topo fixo mais 16 px
    // até 16 px acima do painel do capítulo). Onde não há posicionamento por âncora, a caixa do
    // celular vai até o fim da janela, e a área para aqui, 16 px acima do painel. Sem capítulo
    // ativo, valem a cena e o painel do primeiro, para a cena 1 já entrar na escala certa e não
    // encolher durante o esmaecimento.
    const indice = Math.max(0, ativa);
    const area = cenasProntas[indice].getBoundingClientRect();
    const painel = paineisProntos[indice].getBoundingClientRect();
    const embaixo = painel.top > area.top && painel.left < area.right && painel.right > area.left;
    const fimDaArea = embaixo ? Math.min(area.bottom, painel.top - RESPIRO_DO_PAINEL) : area.bottom;
    const base = midiaDesktop.matches ? CENA_DESKTOP : CENA_CELULAR;
    const escala = escalaDaCena({ largura: area.width, altura: Math.max(0, fimDaArea - area.top) }, base);
    const passos = totais.map((total, i) => (i < ativa ? total : i === ativa ? passo : 0));
    // A primeira seção depois do palco sobe por cima da cena e do painel fixo do celular, e o véu dela
    // é translúcido: o que fica embaixo do alto dela é recortado (spec 15.4). Arredondado para cima,
    // para nem uma fração de pixel aparecer através do véu.
    const altoDepois = depois ? depois.getBoundingClientRect().top : Infinity;
    const corteCena = Math.max(0, Math.ceil(area.bottom - altoDepois));
    const cortePainel = Math.max(0, Math.ceil(painel.bottom - altoDepois));
    // A mesma seção libera o botão quando cobre a caixa dele (spec 15.4), usando a caixa real para
    // respeitar o tamanho e a área segura do CSS.
    const ocultarFlutuante = Boolean(
      ativa >= 0 && !midiaDesktop.matches && depois && flutuante && altoDepois > flutuante.getBoundingClientRect().top,
    );

    // Depois as escritas, só do que mudou.
    if (flutuante && ocultarFlutuante !== flutuanteOcultoEscrito) {
      marcar(flutuante, 'data-palco-oculto', ocultarFlutuante);
      flutuanteOcultoEscrito = ocultarFlutuante;
    }
    const escalaTexto = String(Math.round(Math.max(0, escala) * 1000) / 1000);
    if (escalaTexto !== escalaEscrita) {
      secao.style.setProperty('--wo-palco-escala', escalaTexto);
      escalaEscrita = escalaTexto;
    }
    const corteTexto = `${corteCena} ${cortePainel}`;
    if (corteTexto !== corteEscrito) {
      secao.style.setProperty('--wo-palco-corte-cena', `${corteCena}px`);
      secao.style.setProperty('--wo-palco-corte-painel', `${cortePainel}px`);
      corteEscrito = corteTexto;
    }
    if (mostrada !== ativaEscrita) {
      if (ativaEscrita >= 0) {
        capitulos[ativaEscrita].removeAttribute('data-ativa');
        cenasProntas[ativaEscrita].removeAttribute('data-ativa');
      }
      if (mostrada >= 0) {
        capitulos[mostrada].setAttribute('data-ativa', '');
        cenasProntas[mostrada].setAttribute('data-ativa', '');
        fundo?.setAttribute('data-capitulo', capitulos[mostrada].dataset.frente ?? '');
      } else {
        fundo?.removeAttribute('data-capitulo');
      }
      ativaEscrita = mostrada;
    }
    // A cena que ficou para trás continua montada, para a troca esmaecer a cena inteira. Só as
    // peças cujo passo fica entre o passo escrito e o novo mudam.
    passos.forEach((novo, i) => {
      const antigo = passosEscritos[i];
      if (novo === antigo) return;
      const de = Math.min(novo, antigo);
      const ate = Math.max(novo, antigo);
      for (const peca of pecas[i]) {
        const numero = passoDe(peca);
        if (numero > de && numero <= ate) marcar(peca, 'data-visivel', numero <= novo);
      }
      passosEscritos[i] = novo;
    });

    // Ao ligar, o estado aparece pronto, sem transição: na carga ninguém vê a seção esmaecer, e
    // nenhuma medida pega peça no meio do caminho.
    if (acabouDeLigar) {
      acabouDeLigar = false;
      encerrarTransicoes([secao, fundo]);
    }
  };

  const agendar = () => {
    if (ligado && !pedido) pedido = janela.requestAnimationFrame(quadro);
  };

  // A rolagem só é ouvida com a seção perto da tela (uma altura de janela acima e abaixo). Ao
  // deixar de ouvir, um último quadro grava o estado de fora da seção: depois de um salto para
  // longe, nenhuma cena fica ativa atrás do véu translúcido das seções.
  let ouvindo = false;
  /** @param {boolean} ligar */
  const ouvirRolagem = (ligar) => {
    if (ligar === ouvindo) return;
    ouvindo = ligar;
    if (ligar) janela.addEventListener('scroll', agendar, { passive: true });
    else janela.removeEventListener('scroll', agendar);
    agendar();
  };
  const observador =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entradas) => ouvirRolagem(entradas[entradas.length - 1].isIntersecting), { rootMargin: '100% 0px' })
      : null;

  // O navegador pode restaurar a rolagem depois que este módulo roda: ao recarregar e ao voltar
  // do histórico. Por isso o quadro também roda no load e no pageshow.
  const EVENTOS = /** @type {const} */ (['resize', 'load', 'pageshow']);

  const ligar = () => {
    ligado = true;
    acabouDeLigar = true;
    secao.setAttribute('data-palco-modo', 'fundo');
    for (const evento of EVENTOS) janela.addEventListener(evento, agendar);
    if (observador) observador.observe(secao);
    else ouvirRolagem(true);
    agendar();
  };

  const desligar = () => {
    ligado = false;
    for (const evento of EVENTOS) janela.removeEventListener(evento, agendar);
    observador?.disconnect();
    ouvirRolagem(false);
    if (pedido) janela.cancelAnimationFrame(pedido);
    pedido = 0;
    secao.removeAttribute('data-palco-modo');
    secao.style.removeProperty('--wo-palco-escala');
    secao.style.removeProperty('--wo-palco-corte-cena');
    secao.style.removeProperty('--wo-palco-corte-painel');
    fundo?.removeAttribute('data-capitulo');
    flutuante?.removeAttribute('data-palco-oculto');
    for (const elemento of [...capitulos, ...cenasProntas]) elemento.removeAttribute('data-ativa');
    for (const lista of pecas) for (const peca of lista) peca.removeAttribute('data-visivel');
    ativaEscrita = -1;
    passosEscritos = cenasProntas.map(() => 0);
    escalaEscrita = '';
    corteEscrito = '';
    flutuanteOcultoEscrito = false;
  };

  const avaliar = () => {
    const deveLigar = !menosMovimento.matches && midiaPalco.matches;
    if (deveLigar === ligado) return;
    if (deveLigar) ligar();
    else desligar();
  };

  menosMovimento.addEventListener('change', avaliar);
  midiaPalco.addEventListener('change', avaliar);
  // A fonte da página muda a altura do painel do celular, e com ela a área útil.
  doc.fonts?.ready.then(agendar);
  avaliar();
}

if (typeof document !== 'undefined') iniciarPalco();
