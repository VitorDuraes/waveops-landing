// @ts-check
/* Vídeos locais do fundo vivo. Sem fonte no HTML: a escolha só é aplicada depois do load. */
export const VIDEOS = Object.freeze({
  webm: Object.freeze({ 1280: '/assets/site/video/onda-1280.webm', 1920: '/assets/site/video/onda-1920.webm' }),
  mp4: Object.freeze({ 1280: '/assets/site/video/onda-1280.mp4', 1920: '/assets/site/video/onda-1920.mp4' }),
});

/**
 * @param {number} larguraCss
 * @param {(tipo: string) => CanPlayTypeResult} podeTocar
 * @returns {{ src: string, tipo: 'video/webm' | 'video/mp4' } | null}
 */
export function escolherVideo(larguraCss, podeTocar) {
  const tamanho = larguraCss > 1280 ? 1920 : 1280;
  if (podeTocar('video/webm; codecs="vp9"')) return { src: VIDEOS.webm[tamanho], tipo: 'video/webm' };
  if (podeTocar('video/mp4; codecs="avc1.640028"')) return { src: VIDEOS.mp4[tamanho], tipo: 'video/mp4' };
  return null;
}

/**
 * O vídeo toca em qualquer ponto da página (spec 15.3): só a página ainda carregando, a aba oculta,
 * o pedido de menos movimento, a economia de dados e a pausa no botão o param.
 * @param {{ movimentoReduzido: boolean, economiaDeDados: boolean, carregada: boolean,
 * abaVisivel: boolean, pausadoPeloUsuario: boolean }} estado
 * @returns {boolean}
 */
export function deveTocar(estado) {
  return estado.carregada && estado.abaVisivel &&
    !estado.movimentoReduzido && !estado.economiaDeDados && !estado.pausadoPeloUsuario;
}
