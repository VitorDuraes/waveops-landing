// Contrato de envio dos formulários: atribuição, corpo do lead e da lista, POST com
// tempo limite e escolha de endpoint por ambiente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAtribuicao, lerAtribuicao, CHAVE_ORIGEM } from '../../../assets/site/lib/atribuicao.js';
import { montarLead, montarInteresse } from '../../../assets/site/lib/payload.js';
import { enviarJson, novoIdEnvio, TEMPO_LIMITE_MS } from '../../../assets/site/lib/enviar.js';
import { normalizarTelefone } from '../../../assets/site/lib/validacao.js';
import { endpoints, POLITICA_VERSAO } from '../../../assets/site/config.js';
import { criarControleDeEnvio, TEMPO_MINIMO_MS } from '../../../assets/site/lib/formulario.js';

const local = (href) => {
  const u = new URL(href);
  return { href: u.href, search: u.search, hostname: u.hostname };
};

test('atribuição: UTM vence referrer; referrer interno vira direto', () => {
  const comUtm = calcularAtribuicao(local('https://waveops.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=x'), 'https://www.google.com/');
  assert.equal(comUtm.fonte, 'google/cpc');
  assert.equal(comUtm.utm.campaign, 'x');
  assert.equal(comUtm.referrer, 'https://www.google.com/');
  const externo = calcularAtribuicao(local('https://waveops.com.br/'), 'https://www.linkedin.com/feed/');
  assert.equal(externo.fonte, 'www.linkedin.com');
  const interno = calcularAtribuicao(local('https://waveops.com.br/contato/'), 'https://waveops.com.br/solucoes/');
  assert.equal(interno.fonte, 'direto');
  assert.equal(interno.referrer, '');
  const portal = calcularAtribuicao(local('https://waveops.com.br/'), 'https://portal.waveops.com.br/checkout');
  assert.equal(portal.fonte, 'direto', 'o portal é interno, não é origem');
});

test('atribuição: o primeiro toque gravado pelo funil.js vence a página atual', () => {
  const gravado = { fonte: 'google/cpc', landingUrl: 'https://waveops.com.br/?utm_source=google', referrer: 'https://www.google.com/', utm: { source: 'google', medium: 'cpc', campaign: 'out', term: '', content: '' } };
  const armazenamento = { getItem: (chave) => (chave === CHAVE_ORIGEM ? JSON.stringify(gravado) : null) };
  const a = lerAtribuicao(local('https://waveops.com.br/contato/'), 'https://waveops.com.br/', armazenamento);
  assert.equal(a.fonte, 'google/cpc');
  assert.equal(a.utm.campaign, 'out');
  assert.equal(a.landingUrl, gravado.landingUrl);
});

test('atribuição: sessionStorage que lança ou registro ilegível não quebra', () => {
  const quebrado = { getItem: () => { throw new Error('SecurityError'); } };
  assert.equal(lerAtribuicao(local('https://waveops.com.br/contato/'), '', quebrado).fonte, 'direto');
  const lixo = { getItem: () => '{nao json' };
  assert.equal(lerAtribuicao(local('https://waveops.com.br/?utm_source=x'), '', lixo).fonte, 'x');
});

const ctx = {
  idEnvio: 'id-1',
  agora: new Date('2026-10-10T12:00:00.000Z'),
  preenchidoEmMs: 5300,
  atribuicao: { fonte: 'google/cpc', landingUrl: 'https://waveops.com.br/?utm_source=google', referrer: 'https://www.google.com/', utm: { source: 'google', medium: 'cpc', campaign: 'out', term: 't', content: 'c' } },
  pagina: '/contato/',
  politicaVersao: 'v-teste',
  cienciaTextoVersao: 'c-teste',
  marketingTextoVersao: 'm-teste',
};

test('lead mantém as 15 chaves antigas com os mesmos nomes', () => {
  const lead = montarLead(
    { nome: ' Ana ', empresa: ' ACME ', canalRetorno: 'whatsapp', telefone: '(34) 99177-5784', email: '', mensagem: ' oi ', politicaCiente: true, marketingAceito: false, website: '' },
    { dor: 'Time copiando e colando dados', procura: '', melhorHorario: 'Manhã' },
    ctx,
  );
  for (const chave of ['nome', 'empresa', 'whatsapp', 'dor', 'mensagem', 'origem', 'enviadoEm', 'preenchidoEmMs', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landingUrl']) {
    assert.ok(chave in lead, `falta a chave antiga ${chave}`);
  }
  assert.equal(lead.nome, 'Ana');
  assert.equal(lead.whatsapp, '34991775784');
  assert.equal(lead.telefone, '34991775784');
  assert.equal(lead.origem, 'contato');
  assert.equal(lead.melhorHorario, '', 'melhor horário só vai no canal Ligação');
  assert.equal(lead.utm_campaign, 'out');
  assert.equal(lead.versaoContrato, 2);
  assert.equal(lead.politicaVersao, 'v-teste');
  assert.equal(lead.politicaCienteEm, '2026-10-10T12:00:00.000Z');
  assert.equal(lead.marketingAceito, false);
  assert.equal(lead.primeiraFonte, 'google/cpc');
});

test('lead pelo canal Ligação não preenche whatsapp e leva o horário', () => {
  const lead = montarLead(
    { nome: 'Ana', empresa: '', canalRetorno: 'ligacao', telefone: '34 3333 4444', email: 'A@X.com', mensagem: '', politicaCiente: true, marketingAceito: true, website: '' },
    { dor: '', procura: 'Projeto sob medida', melhorHorario: 'Tarde' },
    ctx,
  );
  assert.equal(lead.whatsapp, '');
  assert.equal(lead.telefone, '3433334444');
  assert.equal(lead.melhorHorario, 'Tarde');
  assert.equal(lead.email, 'a@x.com');
  assert.equal(lead.marketingAceito, true);
});

test('lista de interesse normaliza o e-mail e registra a finalidade', () => {
  const corpo = montarInteresse({ email: '  Ana@X.COM ', politicaCiente: true, marketingAceito: false, website: '' }, { ...ctx, pagina: '/plataforma/' });
  assert.equal(corpo.email, 'ana@x.com');
  assert.equal(corpo.finalidade, 'aviso_abertura_plataforma');
  assert.equal(corpo.origem, 'plataforma');
  assert.equal(corpo.utm_source, 'google');
});

/** fetch falso que responde depois de `atraso` ms e respeita o AbortSignal. */
const fetchFalso = (status, corpo, atraso = 0) => (url, init) =>
  new Promise((resolver, rejeitar) => {
    const t = setTimeout(() => resolver(new Response(corpo === undefined ? '' : JSON.stringify(corpo), { status })), atraso);
    init.signal.addEventListener('abort', () => {
      clearTimeout(t);
      rejeitar(new DOMException('abortado', 'AbortError'));
    });
  });

test('envio: 200 com protocolo é sucesso; 200 sem corpo também', async () => {
  assert.deepEqual(await enviarJson('/x', {}, { fetchImpl: fetchFalso(200, { ok: true, protocolo: 'p1' }) }), { ok: true, status: 200, protocolo: 'p1' });
  assert.deepEqual(await enviarJson('/x', {}, { fetchImpl: fetchFalso(200, undefined) }), { ok: true, status: 200, protocolo: undefined });
});

test('envio: 422 é validação com campos; 503 é falha de servidor', async () => {
  assert.deepEqual(await enviarJson('/x', {}, { fetchImpl: fetchFalso(422, { ok: false, erro: 'validacao', campos: ['email'] }) }), { ok: false, status: 422, motivo: 'validacao', campos: ['email'] });
  assert.deepEqual(await enviarJson('/x', {}, { fetchImpl: fetchFalso(503, { ok: false }) }), { ok: false, status: 503, motivo: 'servidor' });
});

test('envio: sem resposta até o tempo limite vira timeout; erro de rede vira rede', async () => {
  assert.deepEqual(await enviarJson('/x', {}, { tempoLimiteMs: 30, fetchImpl: fetchFalso(200, {}, 500) }), { ok: false, status: 0, motivo: 'timeout' });
  const semRede = () => Promise.reject(new TypeError('Failed to fetch'));
  assert.deepEqual(await enviarJson('/x', {}, { fetchImpl: semRede }), { ok: false, status: 0, motivo: 'rede' });
});

test('envio: manda JSON por POST sem cookie', async () => {
  let pedido;
  await enviarJson('/x', { a: 1 }, { fetchImpl: async (url, init) => { pedido = init; return new Response('{}', { status: 200 }); } });
  assert.equal(pedido.method, 'POST');
  assert.equal(pedido.headers['Content-Type'], 'application/json');
  assert.equal(pedido.credentials, 'omit');
  assert.equal(pedido.body, '{"a":1}');
});

test('idEnvio é único', () => {
  assert.notEqual(novoIdEnvio(), novoIdEnvio());
});

test('reenvio com os mesmos dados reaproveita o idEnvio; dado editado gera id novo', () => {
  let n = 0;
  const controle = criarControleDeEnvio(() => `id-${++n}`);
  const primeiro = controle.idPara({ nome: 'Ana' });
  assert.equal(controle.idPara({ nome: 'Ana' }), primeiro);
  const editado = controle.idPara({ nome: 'Ana Souza' });
  assert.notEqual(editado, primeiro);
  controle.reiniciar();
  assert.notEqual(controle.idPara({ nome: 'Ana Souza' }), editado);
});

test('endpoints: produção só em waveops.com.br; localhost simulado; preview desligado', () => {
  assert.equal(endpoints('waveops.com.br').ambiente, 'producao');
  assert.match(endpoints('www.waveops.com.br').lead, /^https:\/\/cowboyhouse\.app\.n8n\.cloud\/webhook\//);
  assert.deepEqual(endpoints('localhost'), { ambiente: 'local', lead: '/__dev/lead', interesse: '/__dev/interesse' });
  assert.equal(endpoints('127.0.0.1', 'falha').lead, '/__dev/lead?simular=falha');
  assert.equal(endpoints('127.0.0.1', '<script>').lead, '/__dev/lead');
  assert.deepEqual(endpoints('deploy-preview-70--waveops.netlify.app'), { ambiente: 'desligado', lead: '', interesse: '' });
  assert.match(POLITICA_VERSAO, /\S/);
});

test('endpoints: host com ponto final ou em maiúsculas é o mesmo site; [::1] é dev local', () => {
  assert.equal(endpoints('waveops.com.br.').ambiente, 'producao');
  assert.equal(endpoints('WWW.WAVEOPS.COM.BR').ambiente, 'producao');
  assert.equal(endpoints('[::1]').ambiente, 'local');
  assert.equal(endpoints('waveops.com.br.exemplo.com').ambiente, 'desligado');
  assert.equal(endpoints('xwaveops.com.br').ambiente, 'desligado');
});

test('contrato do lead: exatamente estas chaves, nesta grafia', () => {
  const lead = montarLead(
    { nome: 'Ana', empresa: '', canalRetorno: 'email', telefone: '', email: 'a@x.com', mensagem: '', politicaCiente: true, marketingAceito: false, website: '' },
    { dor: '', procura: '', melhorHorario: '' },
    ctx,
  );
  assert.deepEqual(Object.keys(lead).sort(), [
    'canalRetorno', 'cienciaTextoVersao', 'dor', 'email', 'empresa', 'enviadoEm', 'idEnvio', 'landingUrl', 'marketingAceito',
    'marketingTextoVersao', 'melhorHorario', 'mensagem', 'nome', 'origem', 'pagina', 'politicaCiente', 'politicaCienteEm',
    'politicaVersao', 'preenchidoEmMs', 'primeiraFonte', 'procura', 'referrer', 'telefone', 'utm_campaign', 'utm_content',
    'utm_medium', 'utm_source', 'utm_term', 'versaoContrato', 'website', 'whatsapp',
  ]);
  assert.equal(lead.cienciaTextoVersao, 'c-teste');
});

test('contrato da lista de interesse: exatamente estas chaves', () => {
  const corpo = montarInteresse({ email: 'a@x.com', politicaCiente: true, marketingAceito: true, website: '' }, ctx);
  assert.deepEqual(Object.keys(corpo).sort(), [
    'cienciaTextoVersao', 'email', 'enviadoEm', 'finalidade', 'idEnvio', 'landingUrl', 'marketingAceito', 'marketingTextoVersao',
    'origem', 'pagina', 'politicaCiente', 'politicaCienteEm', 'politicaVersao', 'preenchidoEmMs', 'primeiraFonte', 'referrer',
    'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term', 'versaoContrato', 'website',
  ]);
});

test('limites do envio: 12 s de tempo limite e 1,2 s de trava anti-robô', () => {
  assert.equal(TEMPO_LIMITE_MS, 12000);
  assert.equal(TEMPO_MINIMO_MS, 1200);
});

test('produção não manda o contrato v2 ao workflow antigo, que descartaria e-mail e consentimento', () => {
  const { lead, interesse } = endpoints('waveops.com.br');
  assert.doesNotMatch(lead, /flowops-lead/);
  assert.match(lead, /^https:\/\/cowboyhouse\.app\.n8n\.cloud\/webhook\/waveops-lead-v2$/);
  assert.match(interesse, /^https:\/\/cowboyhouse\.app\.n8n\.cloud\/webhook\/waveops-interesse$/);
});

test('telefone sai num formato só, sem o +55', () => {
  assert.equal(normalizarTelefone('+55 (34) 99177-5784'), '34991775784');
  assert.equal(normalizarTelefone('(34) 99177-5784'), '34991775784');
  assert.equal(normalizarTelefone('55 99999-9999'), '55999999999', 'DDD 55 sem DDI fica como está');
  assert.equal(normalizarTelefone('+55 34 3333-4444'), '3433334444');
});
