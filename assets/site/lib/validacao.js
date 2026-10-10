// @ts-check
/* Regras de validação dos formulários do site. Funções puras: sem DOM, testadas em
   Node (tests/site/unit/validacao.test.mjs). As regras e as mensagens são as do design
   aprovado (ContatoForm e Plataforma), com o texto do aceite da política ajustado para
   ciência, como pediu o Vitor. */

/** @typedef {'whatsapp' | 'email' | 'ligacao'} CanalRetorno */
/**
 * @typedef {{
 *   nome: string,
 *   empresa: string,
 *   canalRetorno: CanalRetorno,
 *   telefone: string,
 *   email: string,
 *   mensagem: string,
 *   politicaCiente: boolean,
 *   marketingAceito: boolean,
 *   website: string,
 * }} DadosContato
 * @typedef {'nome' | 'telefone' | 'email' | 'politicaCiente'} CampoContato
 * @typedef {{ email: string, politicaCiente: boolean, marketingAceito: boolean, website: string }} DadosInteresse
 * @typedef {'email' | 'politicaCiente'} CampoInteresse
 */

export const MENSAGENS_CONTATO = Object.freeze({
  nome: 'Informe o seu nome.',
  telefone: 'Informe um número com DDD.',
  email: 'Informe um e-mail válido.',
  politicaCiente: 'Para enviar, confirme que leu a Política de Privacidade.',
});

export const MENSAGENS_INTERESSE = Object.freeze({
  email: 'Informe um e-mail válido.',
  politicaCiente: 'Para entrar na lista, confirme que leu a Política de Privacidade.',
});

/** @param {unknown} valor */
export function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Telefone com DDD: de 10 a 13 dígitos, o que aceita o +55 colado. @param {unknown} valor */
export function validarTelefone(valor) {
  const digitos = soDigitos(valor);
  return digitos.length >= 10 && digitos.length <= 13;
}

/** @param {unknown} valor */
export function normalizarEmail(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

/** Mesma regra do design: algo antes do arroba, ponto depois do domínio, sem espaço. @param {unknown} valor */
export function validarEmail(valor) {
  const email = String(valor ?? '').trim();
  const arroba = email.indexOf('@');
  const ponto = email.lastIndexOf('.');
  return arroba > 0 && ponto > arroba + 1 && email.length > ponto + 1 && !/\s/.test(email) && email.indexOf('@', arroba + 1) === -1;
}

/**
 * Valida o formulário de contato. O canal de retorno decide o que é obrigatório:
 * WhatsApp e Ligação pedem telefone; E-mail pede e-mail. O contato opcional, se vier
 * preenchido, também tem de ser válido.
 * @param {DadosContato} dados
 * @returns {{ valido: boolean, erros: Partial<Record<CampoContato, string>> }}
 */
export function validarContato(dados) {
  /** @type {Partial<Record<CampoContato, string>>} */
  const erros = {};
  const querTelefone = dados.canalRetorno !== 'email';
  const temTelefone = soDigitos(dados.telefone).length > 0;
  const temEmail = dados.email.trim().length > 0;
  if (dados.nome.trim().length < 2) erros.nome = MENSAGENS_CONTATO.nome;
  if (querTelefone ? !validarTelefone(dados.telefone) : temTelefone && !validarTelefone(dados.telefone)) {
    erros.telefone = MENSAGENS_CONTATO.telefone;
  }
  if (querTelefone ? temEmail && !validarEmail(dados.email) : !validarEmail(dados.email)) {
    erros.email = MENSAGENS_CONTATO.email;
  }
  if (!dados.politicaCiente) erros.politicaCiente = MENSAGENS_CONTATO.politicaCiente;
  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * @param {DadosInteresse} dados
 * @returns {{ valido: boolean, erros: Partial<Record<CampoInteresse, string>> }}
 */
export function validarInteresse(dados) {
  /** @type {Partial<Record<CampoInteresse, string>>} */
  const erros = {};
  if (!validarEmail(dados.email)) erros.email = MENSAGENS_INTERESSE.email;
  if (!dados.politicaCiente) erros.politicaCiente = MENSAGENS_INTERESSE.politicaCiente;
  return { valido: Object.keys(erros).length === 0, erros };
}

/** Texto do resumo de erros, igual ao design. @param {number} quantidade */
export function resumoErros(quantidade) {
  return quantidade === 1 ? 'Falta 1 campo para enviar.' : `Faltam ${quantidade} campos para enviar.`;
}
