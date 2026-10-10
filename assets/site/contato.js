// @ts-check
/* WaveOps · formulário de contato (parcial dev/site/parciais/form-contato.html).

   Estados do design: vazio, erro (resumo e campo), enviando, confirmação e falha.
   O canal de retorno decide o que é obrigatório. Robô (honeypot preenchido ou envio
   antes de 1,2 s) vê a confirmação e nada é enviado, como no site antigo. A falha
   preserva tudo o que foi digitado e oferece WhatsApp; "Tentar de novo" reenvia o
   mesmo idEnvio enquanto os dados não mudarem. */
import { validarContato, resumoErros } from './lib/validacao.js';
import { lerAtribuicao } from './lib/atribuicao.js';
import { montarLead } from './lib/payload.js';
import { enviarJson } from './lib/enviar.js';
import { TEMPO_MINIMO_MS, armazenamentoDaSessao, criarControleDeEnvio, definirBotao, marcarErro, medir } from './lib/formulario.js';
import { endpoints, POLITICA_VERSAO, TEXTO_MARKETING } from './config.js';

/** @typedef {import('./lib/validacao.js').CanalRetorno} CanalRetorno */

/** @type {Record<CanalRetorno, string>} */
const DICAS = {
  whatsapp: 'A gente responde pelo WhatsApp, em horário comercial.',
  email: 'A gente responde no e-mail informado.',
  ligacao: 'A gente liga no número informado, no horário que você indicar.',
};
/** @type {Record<CanalRetorno, string>} */
const RETORNOS = {
  whatsapp: 'A gente responde pelo WhatsApp que você informou.',
  email: 'A gente responde no e-mail que você informou.',
  ligacao: 'A gente liga no número que você informou.',
};
/** @type {Record<CanalRetorno, string>} */
const NOMES_CANAL = { whatsapp: 'WhatsApp', email: 'E-mail', ligacao: 'Ligação' };
const CAMPOS = /** @type {const} */ ({
  nome: ['f-nome', 'e-nome'],
  telefone: ['f-tel', 'e-tel'],
  email: ['f-email', 'e-email'],
  politicaCiente: ['f-politica', 'e-politica'],
});

/**
 * @param {ParentNode} raiz
 */
export function iniciarContato(raiz = document) {
  const caixa = raiz.querySelector('[data-form-contato]');
  const form = /** @type {HTMLFormElement | null} */ (caixa?.querySelector('form') ?? null);
  const botao = /** @type {HTMLButtonElement | null} */ (form?.querySelector('[data-botao-enviar]') ?? null);
  if (!caixa || !form || !botao) return;
  const doc = form.ownerDocument;
  /** @param {string} id */
  const porId = (id) => doc.getElementById(id);
  /** @param {string} seletor */
  const achar = (seletor) => /** @type {HTMLElement | null} */ (caixa.querySelector(seletor));

  const resumo = porId('contato-resumo');
  const falha = porId('contato-falha');
  const confirmacao = porId('contato-confirmacao');
  const carregadoEm = Date.now();
  const envio = criarControleDeEnvio();
  let tentou = false;
  let enviando = false;

  /** @param {string} nome */
  const valor = (nome) => {
    const campo = form.elements.namedItem(nome);
    return campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement || campo instanceof HTMLTextAreaElement ? campo.value : '';
  };
  /** @param {string} nome */
  const marcado = (nome) => {
    const campo = form.elements.namedItem(nome);
    return campo instanceof HTMLInputElement && campo.checked;
  };
  /** @returns {CanalRetorno} */
  const canal = () => {
    const escolhido = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="canalRetorno"]:checked'));
    const v = escolhido?.value;
    return v === 'email' || v === 'ligacao' ? v : 'whatsapp';
  };
  /** Texto da opção escolhida; vazio quando é a opção neutra "Selecione". @param {string} nome @param {boolean} [neutraConta] */
  const rotulo = (nome, neutraConta = false) => {
    const campo = form.elements.namedItem(nome);
    if (!(campo instanceof HTMLSelectElement)) return '';
    const opcao = campo.selectedOptions[0];
    if (!opcao || (!opcao.value && !neutraConta)) return '';
    return (opcao.textContent ?? '').trim().slice(0, 120);
  };

  const lerDados = () => ({
    nome: valor('nome'),
    empresa: valor('empresa'),
    canalRetorno: canal(),
    telefone: valor('telefone'),
    email: valor('email'),
    mensagem: valor('mensagem'),
    politicaCiente: marcado('politicaCiente'),
    marketingAceito: marcado('marketingAceito'),
    website: valor('website'),
  });

  const atualizarCanal = () => {
    const c = canal();
    const dica = achar('[data-canal-dica]');
    if (dica) dica.textContent = DICAS[c];
    const rotuloTel = achar('[data-rotulo-tel]');
    if (rotuloTel) rotuloTel.textContent = c === 'ligacao' ? 'Telefone para ligação' : 'WhatsApp';
    achar('[data-tel-opcional]')?.toggleAttribute('hidden', c !== 'email');
    achar('[data-email-opcional]')?.toggleAttribute('hidden', c === 'email');
    achar('[data-campo-horario]')?.toggleAttribute('hidden', c !== 'ligacao');
    const telefone = porId('f-tel');
    const email = porId('f-email');
    if (telefone) telefone.toggleAttribute('required', c !== 'email');
    if (email) email.toggleAttribute('required', c === 'email');
  };

  /** @param {boolean} doEnvio true quando veio do clique em enviar */
  const validar = (doEnvio) => {
    const { valido, erros } = validarContato(lerDados());
    for (const [campo, [idCampo, idErro]] of Object.entries(CAMPOS)) {
      marcarErro(porId(idCampo), porId(idErro), erros[/** @type {keyof typeof CAMPOS} */ (campo)]);
    }
    const quantidade = Object.keys(erros).length;
    if (resumo) {
      // O resumo é role="alert": só muda no envio, para não repetir a contagem a cada tecla.
      if (doEnvio && quantidade) {
        const texto = resumo.querySelector('[data-resumo-texto]');
        if (texto) texto.textContent = resumoErros(quantidade);
        resumo.hidden = false;
      }
      if (!quantidade) resumo.hidden = true;
    }
    return { valido, erros };
  };

  /** @param {'enviar' | 'tentar'} modo */
  const pronto = (modo) => {
    enviando = false;
    definirBotao(form, botao, { enviando: false, texto: modo === 'tentar' ? 'Tentar de novo' : 'Enviar pedido' });
  };

  /** @param {string} [mensagem] */
  const mostrarFalha = (mensagem) => {
    if (falha) {
      const primeira = falha.querySelector('p');
      if (primeira) primeira.textContent = mensagem ?? 'Não foi possível enviar agora.';
      falha.hidden = false;
    }
    achar('[data-falha-whatsapp]')?.removeAttribute('hidden');
    achar('[data-nota-privacidade]')?.setAttribute('hidden', '');
    pronto('tentar');
  };

  /** @param {ReturnType<typeof lerDados>} dados */
  const mostrarConfirmacao = (dados) => {
    if (!confirmacao) return;
    const primeiroNome = dados.nome.trim().split(/\s+/)[0] ?? '';
    const titulo = /** @type {HTMLElement | null} */ (confirmacao.querySelector('[data-confirmacao-titulo]'));
    if (titulo) titulo.textContent = primeiroNome ? `Recebido, ${primeiroNome}.` : 'Recebido.';
    const retorno = confirmacao.querySelector('[data-confirmacao-retorno]');
    if (retorno) retorno.textContent = RETORNOS[dados.canalRetorno];
    const nomeCanal = confirmacao.querySelector('[data-confirmacao-canal]');
    if (nomeCanal) nomeCanal.textContent = NOMES_CANAL[dados.canalRetorno];
    const contato = confirmacao.querySelector('[data-confirmacao-contato]');
    if (contato) contato.textContent = dados.canalRetorno === 'email' ? dados.email.trim().toLowerCase() : dados.telefone.trim();
    form.hidden = true;
    confirmacao.hidden = false;
    titulo?.focus();
  };

  form.addEventListener('change', (evento) => {
    if (evento.target instanceof HTMLInputElement && evento.target.name === 'canalRetorno') atualizarCanal();
    if (tentou) validar(false);
  });
  form.addEventListener('input', () => {
    if (tentou) validar(false);
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    tentou = true;
    if (falha) falha.hidden = true;
    const dados = lerDados();
    const { valido, erros } = validar(true);
    if (!valido) {
      const primeiro = Object.keys(CAMPOS).find((campo) => campo in erros);
      if (primeiro) porId(CAMPOS[/** @type {keyof typeof CAMPOS} */ (primeiro)][0])?.focus();
      return;
    }
    if (dados.website || Date.now() - carregadoEm < TEMPO_MINIMO_MS) {
      mostrarConfirmacao(dados);
      return;
    }
    const destino = endpoints(location.hostname, new URLSearchParams(location.search).get('simular') ?? '');
    if (!destino.lead) {
      mostrarFalha('Envio desligado neste ambiente de teste.');
      return;
    }
    const rotulos = { dor: rotulo('dor'), procura: rotulo('procura'), melhorHorario: rotulo('melhorHorario', true) };
    enviando = true;
    definirBotao(form, botao, { enviando: true, texto: 'Enviando…' });
    const corpo = montarLead(dados, rotulos, {
      idEnvio: envio.idPara({ dados, rotulos }),
      agora: new Date(),
      preenchidoEmMs: Date.now() - carregadoEm,
      atribuicao: lerAtribuicao(location, document.referrer, armazenamentoDaSessao()),
      pagina: location.pathname,
      politicaVersao: POLITICA_VERSAO,
      marketingTextoVersao: TEXTO_MARKETING.contato,
    });
    const resultado = await enviarJson(destino.lead, corpo);
    if (resultado.ok) {
      pronto('enviar');
      medir('lead_enviado', { canal: dados.canalRetorno, dor: rotulos.dor.slice(0, 64) });
      mostrarConfirmacao(dados);
      return;
    }
    mostrarFalha();
  });

  confirmacao?.querySelector('[data-novo-pedido]')?.addEventListener('click', () => {
    form.reset();
    envio.reiniciar();
    tentou = false;
    validar(false);
    if (resumo) resumo.hidden = true;
    if (falha) falha.hidden = true;
    achar('[data-falha-whatsapp]')?.setAttribute('hidden', '');
    achar('[data-nota-privacidade]')?.removeAttribute('hidden');
    atualizarCanal();
    pronto('enviar');
    confirmacao.hidden = true;
    form.hidden = false;
    porId('f-nome')?.focus();
  });

  atualizarCanal();
}

iniciarContato();
