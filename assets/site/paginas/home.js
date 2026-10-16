// @ts-check
/* WaveOps · módulo da Home. Só a Home carrega este arquivo.

   Palco das cinco frentes (spec 13). Melhoria progressiva, nunca requisito: sem este módulo, ou
   com menos movimento, as cinco cenas aparecem montadas, cada uma ao lado (desktop) ou embaixo
   (celular) da sua frente.

   Marcação esperada (index.html):
     [data-palco]               a seção
       [data-frente="..."]      bloco de texto de cada frente, em ordem
       [data-cena="..."]        a cena de cada frente, na mesma ordem
         [data-passo="1".."n"]  peças da cena; um passo pode ter mais de uma peça

   Estado que só este módulo escreve:
     data-palco-modo="fixo" | "local"  na seção; sem ele, o palco está desligado
     data-ativa                        na cena e no bloco da frente da vez, só no modo fixo
     data-visivel                      em cada peça já montada
   O CSS (paginas/home.css) só esconde peça quando a seção tem data-palco-modo: se este módulo
   falhar, nada some. As contas ficam em lib/palco.js. */
import { MIDIA_FIXO, estadoFixo, passoLocal } from '../lib/palco.js';

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
 * Liga o palco das cinco frentes: escolhe o modo pela janela e monta as cenas com a rolagem.
 * @param {Document} doc
 * @param {Window} janela
 */
export function iniciarPalco(doc = document, janela = window) {
  const secao = doc.querySelector('[data-palco]');
  if (!secao) return;
  const frentes = [...secao.querySelectorAll('[data-frente]')];
  const cenas = [...secao.querySelectorAll('[data-cena]')];
  if (!frentes.length || frentes.length !== cenas.length) return;
  const pecas = cenas.map((cena) => /** @type {HTMLElement[]} */ ([...cena.querySelectorAll('[data-passo]')]));
  const totais = pecas.map((lista) => Math.max(0, ...lista.map(passoDe)));

  const menosMovimento = janela.matchMedia('(prefers-reduced-motion: reduce)');
  const midiaFixo = janela.matchMedia(MIDIA_FIXO);

  /** @type {'fixo' | 'local' | null} */
  let modo = null;
  // O que já está escrito no DOM, para cada quadro escrever só a diferença. Passo 0 é cena vazia.
  let ativaEscrita = -1;
  let passosEscritos = cenas.map(() => 0);
  let acabouDeLigar = false;
  let pedido = 0;

  const quadro = () => {
    pedido = 0;
    if (!modo) return;
    // Primeiro todas as leituras.
    const alturaJanela = janela.innerHeight;
    let ativa = -1;
    /** @type {number[]} */
    let passos;
    if (modo === 'fixo') {
      const blocos = frentes.map((frente) => {
        const caixa = frente.getBoundingClientRect();
        return { topo: caixa.top, altura: caixa.height };
      });
      const estado = estadoFixo(blocos, alturaJanela, totais);
      ativa = estado.ativa;
      // A cena que ficou para trás continua montada, para a troca esmaecer a cena inteira.
      passos = totais.map((total, i) => (i < ativa ? total : i === ativa ? estado.passo : 0));
    } else {
      passos = cenas.map((cena, i) => passoLocal({ topo: cena.getBoundingClientRect().top }, alturaJanela, totais[i]));
    }

    // Depois as escritas, só do que mudou.
    if (ativa !== ativaEscrita) {
      frentes.forEach((frente, i) => marcar(frente, 'data-ativa', i === ativa));
      cenas.forEach((cena, i) => marcar(cena, 'data-ativa', i === ativa));
      ativaEscrita = ativa;
    }
    passos.forEach((passo, i) => {
      if (passo === passosEscritos[i]) return;
      for (const peca of pecas[i]) marcar(peca, 'data-visivel', passoDe(peca) <= passo);
      passosEscritos[i] = passo;
    });

    // Ao ligar ou trocar de modo, o estado aparece pronto, sem transição: na carga ninguém vê a
    // seção esmaecer, e nenhuma medida pega peça no meio do caminho.
    if (acabouDeLigar) {
      acabouDeLigar = false;
      if ('getAnimations' in secao) for (const animacao of secao.getAnimations({ subtree: true })) animacao.finish();
    }
  };

  const agendar = () => {
    if (modo && !pedido) pedido = janela.requestAnimationFrame(quadro);
  };

  const desligar = () => {
    secao.removeAttribute('data-palco-modo');
    for (const elemento of [...frentes, ...cenas]) elemento.removeAttribute('data-ativa');
    for (const lista of pecas) for (const peca of lista) peca.removeAttribute('data-visivel');
    ativaEscrita = -1;
    passosEscritos = cenas.map(() => 0);
  };

  const avaliar = () => {
    const novo = menosMovimento.matches ? null : midiaFixo.matches ? 'fixo' : 'local';
    if (novo === modo) return;
    modo = novo;
    if (!novo) {
      desligar();
      return;
    }
    secao.setAttribute('data-palco-modo', novo);
    acabouDeLigar = true;
    agendar();
  };

  // A rolagem só é ouvida com a seção perto da tela (uma altura de janela acima e abaixo).
  let ouvindo = false;
  /** @param {boolean} ligar */
  const ouvirRolagem = (ligar) => {
    if (ligar === ouvindo) return;
    ouvindo = ligar;
    if (ligar) {
      janela.addEventListener('scroll', agendar, { passive: true });
      agendar();
    } else {
      janela.removeEventListener('scroll', agendar);
    }
  };
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver((entradas) => ouvirRolagem(entradas[entradas.length - 1].isIntersecting), { rootMargin: '100% 0px' }).observe(secao);
  } else {
    ouvirRolagem(true);
  }

  menosMovimento.addEventListener('change', avaliar);
  midiaFixo.addEventListener('change', avaliar);
  janela.addEventListener('resize', agendar);
  // O navegador pode restaurar a rolagem depois que este módulo roda: ao recarregar e ao voltar
  // do histórico. Por isso o quadro também roda no load e no pageshow.
  janela.addEventListener('load', agendar);
  janela.addEventListener('pageshow', agendar);
  avaliar();
  agendar();
}

if (typeof document !== 'undefined') iniciarPalco();
