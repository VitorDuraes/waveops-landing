// @ts-check
/* WaveOps · fundo vivo de toda página (spec 15). Melhoria progressiva: sem este módulo, com menos
   movimento, economia de dados ou sem codec, fica o pôster. Marcação (parciais fundo e rodapé):
   [data-fundo-video], o <video> sem src, e [data-fundo-pausa], o botão "Pausar animação" do rodapé,
   nascido com hidden. O mesmo estado pausa a vitrine do hero da Home (paginas/vitrine.js e home.css).
   O vídeo toca em qualquer ponto da página com a aba visível, também nos capítulos do palco da Home.
   A pausa do botão vale para a visita: o sessionStorage guarda só o estado do botão. */
import { escolherVideo, deveTocar } from './lib/video.js';

/** Chave do estado do botão na visita. Só existe enquanto o fundo está pausado pelo botão. */
const CHAVE_PAUSA = 'waveops:fundo-pausado';

// Sem armazenamento (bloqueado pelo navegador), a escolha vale só nesta página.
/** @param {Window} janela */
function lerPausa(janela) {
  try {
    return janela.sessionStorage.getItem(CHAVE_PAUSA) === '1';
  } catch {
    return false;
  }
}

/** @param {Window} janela @param {boolean} pausado */
function gravarPausa(janela, pausado) {
  try {
    if (pausado) janela.sessionStorage.setItem(CHAVE_PAUSA, '1');
    else janela.sessionStorage.removeItem(CHAVE_PAUSA);
  } catch {
    /* fica só nesta página */
  }
}

/**
 * Liga o vídeo do fundo e o botão de pausa do rodapé.
 * @param {Document} doc
 * @param {Window} janela
 */
export function iniciarFundo(doc = document, janela = window) {
  const video = doc.querySelector('[data-fundo-video]');
  const botao = doc.querySelector('[data-fundo-pausa]');
  if (!(video instanceof HTMLVideoElement) || !(botao instanceof HTMLButtonElement)) return;
  const fonte = escolherVideo(janela.innerWidth, video.canPlayType.bind(video));
  if (!fonte) return;
  const preferencia = janela.matchMedia('(prefers-reduced-motion: reduce)');
  const estado = {
    movimentoReduzido: preferencia.matches,
    economiaDeDados: Boolean(janela.navigator.connection?.saveData),
    carregada: doc.readyState === 'complete',
    abaVisivel: doc.visibilityState !== 'hidden',
    pausadoPeloUsuario: lerPausa(janela),
  };
  let tentativa = 0;
  let pendente = false;
  // muted no HTML é o valor padrão. A propriedade também é explícita para o autoplay móvel.
  video.muted = true;

  const aplicar = () => {
    botao.hidden = estado.movimentoReduzido || estado.economiaDeDados;
    botao.setAttribute('aria-pressed', String(estado.pausadoPeloUsuario));
    if (!deveTocar(estado)) {
      tentativa += 1;
      pendente = false;
      video.pause();
      video.removeAttribute('data-tocando');
      return;
    }
    if (pendente || !video.paused) return;
    if (!video.hasAttribute('src')) video.src = fonte.src;
    video.removeAttribute('data-video-erro');
    const atual = ++tentativa;
    pendente = true;
    video.play().then(() => {
      if (atual === tentativa) pendente = false;
    }).catch((erro) => {
      // pause() rejeita uma tentativa antiga com AbortError: ela não pode parar uma mais recente.
      if (atual !== tentativa) return;
      pendente = false;
      video.pause();
      video.removeAttribute('data-tocando');
      video.setAttribute('data-video-erro', erro instanceof Error ? erro.name : 'FalhaDeReproducao');
      // Fica o pôster e o botão marca a pausa, para tentar de novo à mão. A falha não é escolha da
      // pessoa: nada vai para a visita.
      estado.pausadoPeloUsuario = true;
      botao.setAttribute('aria-pressed', 'true');
    });
  };

  video.addEventListener('playing', () => {
    if (deveTocar(estado)) video.setAttribute('data-tocando', '');
    else aplicar();
  });
  botao.addEventListener('click', () => {
    estado.pausadoPeloUsuario = !estado.pausadoPeloUsuario;
    gravarPausa(janela, estado.pausadoPeloUsuario);
    aplicar();
  });
  preferencia.addEventListener('change', () => {
    estado.movimentoReduzido = preferencia.matches;
    aplicar();
  });
  doc.addEventListener('visibilitychange', () => {
    estado.abaVisivel = doc.visibilityState !== 'hidden';
    aplicar();
  });
  janela.addEventListener('load', () => {
    estado.carregada = true;
    aplicar();
  }, { once: true });
  // Volta pelo cache do histórico: a escolha feita em outra página da visita chega pela sessão.
  janela.addEventListener('pageshow', (evento) => {
    if (!evento.persisted) return;
    estado.pausadoPeloUsuario = lerPausa(janela);
    aplicar();
  });
  aplicar();
}

if (typeof document !== 'undefined') iniciarFundo();
