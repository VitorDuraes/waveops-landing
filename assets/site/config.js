// @ts-check
/* Para onde os formulários enviam, por ambiente. Fora de waveops.com.br nada vai para
   o n8n de produção: localhost usa os endpoints simulados do dev/site/serve.mjs e o
   Deploy Preview do Netlify fica desligado até existir um webhook de homologação.

   PENDENTE antes de publicar (gate H2, ver docs/integrations/n8n-site-v2.md):
   - lead: hoje aponta para o workflow que já roda (flowops-lead), que recebe as
     mesmas 15 chaves antigas e ignora as novas até ser atualizado;
   - interesse: o webhook ainda não existe no n8n. Até ser criado, o envio cai no
     estado de falha, sem perder o e-mail digitado. */

/** Versão da Política de Privacidade registrada junto com a ciência. Troque pela
    versão datada da política revisada quando ela for publicada (gate H4). */
export const POLITICA_VERSAO = 'rascunho-2026-08-10';

/** Versão do texto de consentimento de marketing de cada formulário. Mudou o texto, mude a versão. */
export const TEXTO_MARKETING = Object.freeze({
  contato: 'contato-marketing-v1',
  interesse: 'interesse-marketing-v1',
});

const PRODUCAO = Object.freeze({
  lead: 'https://cowboyhouse.app.n8n.cloud/webhook/flowops-lead',
  interesse: 'https://cowboyhouse.app.n8n.cloud/webhook/waveops-interesse',
});

/** Preencha quando existir webhook de homologação (planilha separada). */
const HOMOLOGACAO = Object.freeze({ lead: '', interesse: '' });

/**
 * @typedef {{ ambiente: 'producao' | 'local' | 'homologacao' | 'desligado', lead: string, interesse: string }} Endpoints
 */

/**
 * @param {string} host location.hostname
 * @param {string} [simular] valor de ?simular= na URL da página, só em localhost
 * @returns {Endpoints}
 */
export function endpoints(host, simular = '') {
  if (host === 'waveops.com.br' || host === 'www.waveops.com.br') return { ambiente: 'producao', ...PRODUCAO };
  if (host === 'localhost' || host === '127.0.0.1') {
    const consulta = /^(falha|lento|validacao)$/.test(simular) ? `?simular=${simular}` : '';
    return { ambiente: 'local', lead: `/__dev/lead${consulta}`, interesse: `/__dev/interesse${consulta}` };
  }
  if (HOMOLOGACAO.lead && HOMOLOGACAO.interesse) return { ambiente: 'homologacao', ...HOMOLOGACAO };
  return { ambiente: 'desligado', lead: '', interesse: '' };
}
