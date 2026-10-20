// @ts-check
/* WaveOps · comportamento compartilhado das páginas do site institucional.

   Quatro peças, todas melhoria e nunca requisito: sem este arquivo, a página continua
   inteira (o <noscript> do <head> mostra o menu e todos os painéis, e o topo entra no fluxo).
   1. Menu do topo em telas até 1180 px: abre e fecha, Esc fecha e devolve o foco.
   2. Topo fixo, sempre no estado escuro (o fundo vivo fica atrás da página inteira).
   3. Seletores [data-seletor]: um painel por vez, com aria-pressed nos botões.
   4. Clique em link de WhatsApp marcado com data-whatsapp vira evento de funil.
   Na Home, também resolve as âncoras da página única antiga (lib/legado.js). O vídeo do fundo
   e o botão de pausa do topo ficam em fundo.js.

   O Meta Pixel está desligado no site novo até existir consentimento (decisão de
   09/10/2026), então nada aqui chama fbq. */
import { destinoLegado } from './lib/legado.js';

/**
 * Liga o botão de menu ao painel indicado em aria-controls.
 * @param {Document} doc
 */
export function iniciarTopo(doc = document) {
  const botao = /** @type {HTMLButtonElement | null} */ (doc.querySelector('.wo-topo__menu[aria-controls]'));
  const painel = botao ? doc.getElementById(botao.getAttribute('aria-controls') ?? '') : null;
  if (!botao || !painel) return;

  /** @param {boolean} aberto */
  const definir = (aberto) => {
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    painel.hidden = !aberto;
  };

  botao.addEventListener('click', () => definir(botao.getAttribute('aria-expanded') !== 'true'));
  doc.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && botao.getAttribute('aria-expanded') === 'true') {
      definir(false);
      botao.focus();
    }
  });
  painel.addEventListener('click', (evento) => {
    if (evento.target instanceof Element && evento.target.closest('a')) definir(false);
  });
  doc.addEventListener('focusin', (evento) => {
    const alvo = evento.target;
    if (botao.getAttribute('aria-expanded') === 'true' && alvo instanceof Element && !alvo.closest('.wo-topo')) {
      definir(false);
    }
  });
}

/**
 * Liga o topo fixo (spec 5.5 e 15.2). O HTML nasce com o topo solto; aqui ele passa a fixo
 * (data-topo="fixo" no <html>). O topo fica sempre no estado escuro: a página inteira está no
 * contexto escuro, sobre o fundo vivo, então não há faixa clara para vigiar.
 * @param {Document} doc
 */
export function iniciarTopoFixo(doc = document) {
  if (doc.querySelector('.wo-topo')) doc.documentElement.dataset.topo = 'fixo';
}

/**
 * Seletores de painel único. Marcação esperada:
 *   [data-seletor] > [data-opcoes] > button[data-opcao="0".."n"][aria-controls]
 *   [data-seletor] ... [data-painel="0".."n"][id]
 * @param {ParentNode} raiz
 */
export function iniciarSeletores(raiz = document) {
  for (const seletor of raiz.querySelectorAll('[data-seletor]')) {
    const botoes = /** @type {HTMLButtonElement[]} */ ([...seletor.querySelectorAll('[data-opcao]')]);
    const paineis = /** @type {HTMLElement[]} */ ([...seletor.querySelectorAll('[data-painel]')]);
    if (!botoes.length || !paineis.length) continue;

    /** @param {string} valor */
    const mostrar = (valor) => {
      for (const botao of botoes) botao.setAttribute('aria-pressed', String(botao.dataset.opcao === valor));
      for (const painel of paineis) painel.hidden = painel.dataset.painel !== valor;
    };

    const inicial = botoes.find((b) => b.getAttribute('aria-pressed') === 'true') ?? botoes[0];
    mostrar(inicial.dataset.opcao ?? '0');
    seletor.setAttribute('data-pronto', '');
    for (const botao of botoes) botao.addEventListener('click', () => mostrar(botao.dataset.opcao ?? '0'));
  }
}

/**
 * Conta clique em WhatsApp no funil. O rótulo vem de data-whatsapp.
 * @param {Document} doc
 */
export function iniciarWhatsApp(doc = document) {
  doc.addEventListener('click', (evento) => {
    const link = evento.target instanceof Element ? evento.target.closest('a[data-whatsapp]') : null;
    if (!(link instanceof HTMLElement)) return;
    try {
      window.WaveFunil?.enviar('whatsapp_click', { local: link.dataset.whatsapp || 'outro' });
    } catch {
      /* medição nunca atrapalha o clique */
    }
  });
}

/**
 * Leva a âncora antiga da página única para a página nova.
 * @param {Location} local
 * @returns {boolean} true quando redirecionou
 */
export function redirecionarAncoraLegada(local = window.location) {
  const destino = destinoLegado(local.hash);
  if (!destino) return false;
  local.replace(destino);
  return true;
}

if (typeof document !== 'undefined') {
  const naHome = document.body?.dataset.pagina === 'home';
  if (!(naHome && redirecionarAncoraLegada())) {
    iniciarTopo();
    iniciarTopoFixo();
    iniciarSeletores();
    iniciarWhatsApp();
  }
}
