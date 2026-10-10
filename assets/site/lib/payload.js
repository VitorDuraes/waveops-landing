// @ts-check
/* Corpo enviado ao n8n. O lead mantém as 15 chaves que o site antigo mandava, com os
   mesmos nomes, para nada se perder se o workflow atual ainda estiver recebendo, e
   acrescenta as chaves novas do contrato v2 (spec do site v2, seção 5.7). */
import { normalizarTelefone, normalizarEmail } from './validacao.js';

/**
 * @typedef {import('./validacao.js').DadosContato} DadosContato
 * @typedef {import('./validacao.js').DadosInteresse} DadosInteresse
 * @typedef {import('./atribuicao.js').Atribuicao} Atribuicao
 * @typedef {{
 *   idEnvio: string,
 *   agora: Date,
 *   preenchidoEmMs: number,
 *   atribuicao: Atribuicao,
 *   pagina: string,
 *   politicaVersao: string,
 *   cienciaTextoVersao: string,
 *   marketingTextoVersao: string,
 * }} ContextoEnvio
 * @typedef {{ dor: string, procura: string, melhorHorario: string }} RotulosContato
 */

/** @param {Atribuicao} a */
function camposUtm(a) {
  return {
    utm_source: a.utm.source,
    utm_medium: a.utm.medium,
    utm_campaign: a.utm.campaign,
    utm_content: a.utm.content,
    utm_term: a.utm.term,
    referrer: a.referrer,
    landingUrl: a.landingUrl,
  };
}

/**
 * @param {DadosContato} dados
 * @param {RotulosContato} rotulos texto das opções escolhidas (a planilha mostra texto, não código)
 * @param {ContextoEnvio} ctx
 */
export function montarLead(dados, rotulos, ctx) {
  const telefone = normalizarTelefone(dados.telefone);
  const agora = ctx.agora.toISOString();
  return {
    nome: dados.nome.trim(),
    empresa: dados.empresa.trim(),
    whatsapp: dados.canalRetorno === 'whatsapp' ? telefone : '',
    dor: rotulos.dor,
    mensagem: dados.mensagem.trim(),
    origem: 'contato',
    enviadoEm: agora,
    preenchidoEmMs: ctx.preenchidoEmMs,
    ...camposUtm(ctx.atribuicao),
    versaoContrato: 2,
    idEnvio: ctx.idEnvio,
    canalRetorno: dados.canalRetorno,
    telefone,
    email: normalizarEmail(dados.email),
    melhorHorario: dados.canalRetorno === 'ligacao' ? rotulos.melhorHorario : '',
    procura: rotulos.procura,
    politicaCiente: dados.politicaCiente === true,
    politicaVersao: ctx.politicaVersao,
    politicaCienteEm: agora,
    cienciaTextoVersao: ctx.cienciaTextoVersao,
    marketingAceito: dados.marketingAceito === true,
    marketingTextoVersao: ctx.marketingTextoVersao,
    primeiraFonte: ctx.atribuicao.fonte,
    pagina: ctx.pagina,
    website: dados.website,
  };
}

/**
 * @param {DadosInteresse} dados
 * @param {ContextoEnvio} ctx
 */
export function montarInteresse(dados, ctx) {
  const agora = ctx.agora.toISOString();
  return {
    versaoContrato: 1,
    idEnvio: ctx.idEnvio,
    email: normalizarEmail(dados.email),
    politicaCiente: dados.politicaCiente === true,
    politicaVersao: ctx.politicaVersao,
    politicaCienteEm: agora,
    cienciaTextoVersao: ctx.cienciaTextoVersao,
    marketingAceito: dados.marketingAceito === true,
    marketingTextoVersao: ctx.marketingTextoVersao,
    finalidade: 'aviso_abertura_plataforma',
    origem: 'plataforma',
    pagina: ctx.pagina,
    enviadoEm: agora,
    preenchidoEmMs: ctx.preenchidoEmMs,
    ...camposUtm(ctx.atribuicao),
    primeiraFonte: ctx.atribuicao.fonte,
    website: dados.website,
  };
}
