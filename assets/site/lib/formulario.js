// @ts-check
/* Peças comuns aos dois formulários (contato e lista de interesse). */
import { novoIdEnvio } from './enviar.js';

/** Trava anti-robô herdada do site antigo: envio antes disso é tratado como robô. */
export const TEMPO_MINIMO_MS = 1200;

/** sessionStorage pode lançar só de ser lido (Safari privado, política do navegador). */
export function armazenamentoDaSessao() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Mantém o mesmo idEnvio enquanto os dados não mudam. "Tentar de novo" com os mesmos
 * dados reaproveita o id (o servidor deduplica); dado editado gera id novo, para a
 * correção não ser descartada como repetição.
 * @param {() => string} [gerar]
 */
export function criarControleDeEnvio(gerar = novoIdEnvio) {
  let id = '';
  let assinatura = '';
  return {
    /** @param {unknown} dados */
    idPara(dados) {
      const atual = JSON.stringify(dados);
      if (!id || atual !== assinatura) {
        assinatura = atual;
        id = gerar();
      }
      return id;
    },
    reiniciar() {
      id = '';
      assinatura = '';
    },
  };
}

/**
 * Estado visual do botão de envio.
 * @param {HTMLFormElement} form
 * @param {HTMLButtonElement} botao
 * @param {{ enviando: boolean, texto: string }} estado
 */
export function definirBotao(form, botao, estado) {
  form.setAttribute('aria-busy', String(estado.enviando));
  botao.setAttribute('aria-disabled', String(estado.enviando));
  const texto = botao.querySelector('[data-botao-texto]');
  if (texto) texto.textContent = estado.texto;
  const girar = /** @type {SVGElement | null} */ (botao.querySelector('[data-icone-enviando]'));
  const seta = /** @type {SVGElement | null} */ (botao.querySelector('[data-icone-seta]'));
  if (girar) girar.toggleAttribute('hidden', !estado.enviando);
  if (seta) seta.toggleAttribute('hidden', estado.enviando);
}

/**
 * Liga ou desliga a mensagem de erro de um campo e o aria-invalid dele.
 * @param {HTMLElement | null} campo
 * @param {HTMLElement | null} mensagem
 * @param {string | undefined} erro
 */
export function marcarErro(campo, mensagem, erro) {
  if (campo) campo.setAttribute('aria-invalid', erro ? 'true' : 'false');
  if (mensagem) {
    mensagem.hidden = !erro;
    if (erro) mensagem.textContent = erro;
  }
}

/** Evento de funil sem dado pessoal. Nunca atrapalha o formulário. @param {string} nome @param {Record<string, string>} [props] */
export function medir(nome, props) {
  try {
    window.WaveFunil?.enviar(nome, props);
  } catch {
    /* medição é melhoria */
  }
}
