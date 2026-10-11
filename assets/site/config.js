// @ts-check
/* Para onde os formulários enviam, por ambiente. Em produção, os dois formulários gravam
   no portal (portal.waveops.com.br): POST /api/site/contato e POST /api/site/interesse,
   com o contrato e a operação descritos em docs/integrations/portal-site-v2.md.
   Fora de waveops.com.br os formulários não enviam para o portal de produção: localhost
   usa os endpoints simulados do dev/site/serve.mjs e o Deploy Preview do Netlify fica
   desligado até existir um endpoint de homologação.

   As duas rotas estão no ar desde 11/10/2026. Se o portal cair, o envio vai para o
   estado de falha, com os dados preservados e saída pelo WhatsApp.

   O lead NÃO aponta para o flowops-lead que roda hoje de propósito: aquele workflow só
   lê as 15 chaves antigas, então um lead pelo canal E-mail chegaria sem o e-mail, e a
   ciência da política e o consentimento de marketing se perderiam em silêncio. Falha
   visível é melhor que perda silenciosa. O teste tests/site/unit/envio.test.mjs trava
   isso. */

/** Versão da Política de Privacidade registrada junto com a ciência. Mudou o texto da
    política (portal/src/app/(public)/privacidade), mude a versão; a revisada pelo jurídico
    entra no gate H4. 2026-10-11: código diário relacionável aos dados de contato. */
export const POLITICA_VERSAO = 'rascunho-2026-10-11';

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
  lead: 'https://portal.waveops.com.br/api/site/contato',
  interesse: 'https://portal.waveops.com.br/api/site/interesse',
});

/** Preencha quando existir endpoint de homologação do portal (com banco separado). */
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
