// @ts-check
/* Para onde os formulários enviam, por ambiente. Fora de waveops.com.br nada vai para
   o n8n de produção: localhost usa os endpoints simulados do dev/site/serve.mjs e o
   Deploy Preview do Netlify fica desligado até existir um webhook de homologação.

   PENDENTE antes de publicar (gate H2, ver docs/integrations/n8n-site-v2.md): os dois
   webhooks abaixo ainda não existem no n8n. Até serem criados, o envio cai no estado
   de falha, com os dados preservados e saída pelo WhatsApp.

   O lead NÃO aponta para o flowops-lead que roda hoje de propósito: aquele workflow só
   lê as 15 chaves antigas, então um lead pelo canal E-mail chegaria sem o e-mail, e a
   ciência da política e o consentimento de marketing se perderiam em silêncio. Falha
   visível é melhor que perda silenciosa. O teste tests/site/unit/envio.test.mjs trava
   isso. */

/** Versão da Política de Privacidade registrada junto com a ciência. Troque pela
    versão datada da política revisada quando ela for publicada (gate H4). */
export const POLITICA_VERSAO = 'rascunho-2026-08-10';

/** Versão do texto da caixa de ciência da política, por formulário. Mudou o texto, mude a versão. */
export const TEXTO_CIENCIA = Object.freeze({
  contato: 'contato-ciencia-v1',
  interesse: 'interesse-ciencia-v1',
});

/** Versão do texto de consentimento de marketing de cada formulário. Mudou o texto, mude a versão. */
export const TEXTO_MARKETING = Object.freeze({
  contato: 'contato-marketing-v1',
  interesse: 'interesse-marketing-v1',
});

const PRODUCAO = Object.freeze({
  lead: 'https://n8n.waveops.com.br/webhook/waveops-lead-v2',
  interesse: 'https://n8n.waveops.com.br/webhook/waveops-interesse',
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
  // Minúsculas e sem o ponto final de FQDN: "waveops.com.br." é o mesmo site.
  const h = host.toLowerCase().replace(/\.$/, '');
  if (h === 'waveops.com.br' || h === 'www.waveops.com.br') return { ambiente: 'producao', ...PRODUCAO };
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') {
    const consulta = /^(falha|lento|validacao)$/.test(simular) ? `?simular=${simular}` : '';
    return { ambiente: 'local', lead: `/__dev/lead${consulta}`, interesse: `/__dev/interesse${consulta}` };
  }
  if (HOMOLOGACAO.lead && HOMOLOGACAO.interesse) return { ambiente: 'homologacao', ...HOMOLOGACAO };
  return { ambiente: 'desligado', lead: '', interesse: '' };
}
