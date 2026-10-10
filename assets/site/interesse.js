// @ts-check
/* WaveOps · lista de interesse da Plataforma (parcial dev/site/parciais/form-interesse.html).

   Só confirma depois que o servidor responde que gravou. E-mail repetido recebe a
   mesma confirmação (o servidor deduplica e não revela que já estava na lista).
   Robô (honeypot ou envio antes de 1,2 s) vê a confirmação e nada é enviado. */
import { validarInteresse, normalizarEmail, MENSAGENS_INTERESSE } from './lib/validacao.js';
import { lerAtribuicao } from './lib/atribuicao.js';
import { montarInteresse } from './lib/payload.js';
import { enviarJson } from './lib/enviar.js';
import { TEMPO_MINIMO_MS, armazenamentoDaSessao, criarControleDeEnvio, definirBotao, liberarEnvio, marcarErro, medir } from './lib/formulario.js';
import { endpoints, POLITICA_VERSAO, TEXTO_CIENCIA, TEXTO_MARKETING } from './config.js';

const TEXTO_BOTAO = 'Entrar na lista de interesse';

/**
 * @param {ParentNode} raiz
 */
export function iniciarInteresse(raiz = document) {
  const caixa = raiz.querySelector('[data-form-interesse]');
  const form = /** @type {HTMLFormElement | null} */ (caixa?.querySelector('form') ?? null);
  const botao = /** @type {HTMLButtonElement | null} */ (form?.querySelector('[data-botao-enviar]') ?? null);
  if (!caixa || !form || !botao) return;
  const doc = form.ownerDocument;
  const email = /** @type {HTMLInputElement | null} */ (doc.getElementById('pl-email'));
  const politica = /** @type {HTMLInputElement | null} */ (doc.getElementById('pl-politica'));
  const marketing = /** @type {HTMLInputElement | null} */ (doc.getElementById('pl-marketing'));
  const isca = /** @type {HTMLInputElement | null} */ (doc.getElementById('pl-website'));
  const falha = doc.getElementById('interesse-falha');
  const confirmacao = doc.getElementById('interesse-confirmacao');
  const carregadoEm = Date.now();
  const envio = criarControleDeEnvio();
  let tentou = false;
  let enviando = false;

  const lerDados = () => ({
    email: email?.value ?? '',
    politicaCiente: Boolean(politica?.checked),
    marketingAceito: Boolean(marketing?.checked),
    website: isca?.value ?? '',
  });

  const validar = () => {
    const resultado = validarInteresse(lerDados());
    marcarErro(email, doc.getElementById('e-pl-email'), resultado.erros.email);
    marcarErro(politica, doc.getElementById('e-pl-politica'), resultado.erros.politicaCiente);
    return resultado;
  };

  /** @param {ReturnType<typeof lerDados>} dados */
  const mostrarConfirmacao = (dados) => {
    if (!confirmacao) return;
    const destino = confirmacao.querySelector('[data-confirmacao-email]');
    if (destino) destino.textContent = normalizarEmail(dados.email);
    form.hidden = true;
    confirmacao.hidden = false;
    /** @type {HTMLElement | null} */ (confirmacao.querySelector('[data-confirmacao-titulo]'))?.focus();
  };

  /** @param {string} [mensagem] */
  const mostrarFalha = (mensagem) => {
    if (falha) {
      const primeira = falha.querySelector('p');
      if (primeira) primeira.textContent = mensagem ?? 'Não foi possível registrar agora.';
      falha.hidden = false;
    }
    enviando = false;
    definirBotao(form, botao, { enviando: false, texto: 'Tentar de novo' });
  };

  form.addEventListener('input', () => {
    if (tentou) validar();
  });
  form.addEventListener('change', () => {
    if (tentou) validar();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    tentou = true;
    if (falha) falha.hidden = true;
    const dados = lerDados();
    const { valido, erros } = validar();
    if (!valido) {
      (erros.email ? email : politica)?.focus();
      return;
    }
    if (dados.website || Date.now() - carregadoEm < TEMPO_MINIMO_MS) {
      mostrarConfirmacao(dados);
      return;
    }
    const destino = endpoints(location.hostname, new URLSearchParams(location.search).get('simular') ?? '');
    if (!destino.interesse) {
      mostrarFalha('Envio desligado neste ambiente de teste.');
      return;
    }
    enviando = true;
    definirBotao(form, botao, { enviando: true, texto: 'Enviando…' });
    const corpo = montarInteresse(dados, {
      idEnvio: envio.idPara(dados),
      agora: new Date(),
      preenchidoEmMs: Date.now() - carregadoEm,
      atribuicao: lerAtribuicao(location, document.referrer, armazenamentoDaSessao()),
      pagina: location.pathname,
      politicaVersao: POLITICA_VERSAO,
      cienciaTextoVersao: TEXTO_CIENCIA.interesse,
      marketingTextoVersao: TEXTO_MARKETING.interesse,
    });
    const resultado = await enviarJson(destino.interesse, corpo);
    if (resultado.ok) {
      enviando = false;
      definirBotao(form, botao, { enviando: false, texto: TEXTO_BOTAO });
      medir('interesse_plataforma');
      mostrarConfirmacao(dados);
      return;
    }
    // 422 com campos: o servidor recusou o e-mail ou a ciência. Mostra no campo.
    const campos = resultado.campos ?? [];
    if (resultado.motivo === 'validacao' && (campos.includes('email') || campos.includes('politicaCiente'))) {
      if (campos.includes('email')) marcarErro(email, doc.getElementById('e-pl-email'), MENSAGENS_INTERESSE.email);
      if (campos.includes('politicaCiente')) marcarErro(politica, doc.getElementById('e-pl-politica'), MENSAGENS_INTERESSE.politicaCiente);
      enviando = false;
      definirBotao(form, botao, { enviando: false, texto: TEXTO_BOTAO });
      (campos.includes('email') ? email : politica)?.focus();
      return;
    }
    mostrarFalha();
  });

  liberarEnvio(botao);
}

iniciarInteresse();
