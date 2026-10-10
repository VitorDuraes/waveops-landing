// Workflows n8n do site v2 (docs/integrations/): estrutura, contrato, regras dos nós Code e
// simulação do fluxo. Nada aqui fala com o n8n nem com a planilha: o grafo do JSON roda em
// memória, com a planilha simulada, e o código dos nós Code roda de verdade num contexto isolado.
// O corpo enviado ao Code vem das mesmas funções que o site usa (payload.js e validacao.js),
// para o contrato não derivar sem ninguém ver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { montarLead, montarInteresse } from '../../../assets/site/lib/payload.js';
import { validarContato, validarInteresse, validarEmail, validarTelefone } from '../../../assets/site/lib/validacao.js';
import * as configSite from '../../../assets/site/config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PASTA = path.join(RAIZ, 'docs', 'integrations');
const ARQUIVO_LEAD = path.join(PASTA, 'n8n-waveops-lead-v2.json');
const ARQUIVO_INTERESSE = path.join(PASTA, 'n8n-waveops-interesse-v1.json');
const ARQUIVO_DOC = path.join(PASTA, 'n8n-site-v2.md');

/** Meia-risca ou travessão. Montado por código de caractere para o arquivo não conter nenhum dos dois. */
const TRAVESSAO = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
/** Separadores de linha e de parágrafo, também montados por código. */
const SEPARADORES = String.fromCharCode(0x2028, 0x2029);
// Checkout no Windows com core.autocrlf=true entrega CRLF; as regex do documento esperam LF.
const lerTexto = (arquivo) => fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
const lerJson = (arquivo) => JSON.parse(lerTexto(arquivo));
/** Os workflows como estão no repositório público: sem os valores do limite de volume. */
const leadPublicado = lerJson(ARQUIVO_LEAD);
const interessePublicado = lerJson(ARQUIVO_INTERESSE);

/* Os valores reais do limite de volume ficam no documento de operação restrita (local) e
   entram no n8n ao importar. Para exercitar a regra, o teste injeta valores próprios, que
   não têm relação com os de produção. */
const LIMITES_DE_TESTE = { lead: { minuto: 4, hora: 9 }, interesse: { minuto: 2, hora: 6 } };
const MARCA_MINUTO = "const LIMITE_POR_MINUTO = Number('__DEFINIR__');";
const MARCA_HORA = "const LIMITE_POR_HORA = Number('__DEFINIR__');";

/** Cópia do workflow com os limites preenchidos, como ficaria depois da importação. */
function comLimites(wf, { minuto, hora }) {
  const copia = structuredClone(wf);
  const no = copia.nodes.find((n) => n.name === 'Code: Validar e normalizar');
  const original = no.parameters.jsCode;
  if (!original.includes(MARCA_MINUTO) || !original.includes(MARCA_HORA)) throw new Error('o Code não traz os limites como __DEFINIR__');
  no.parameters.jsCode = original
    .replace(MARCA_MINUTO, `const LIMITE_POR_MINUTO = ${minuto};`)
    .replace(MARCA_HORA, `const LIMITE_POR_HORA = ${hora};`);
  return copia;
}
const lead = comLimites(leadPublicado, LIMITES_DE_TESTE.lead);
const interesse = comLimites(interessePublicado, LIMITES_DE_TESTE.interesse);

// Versões de texto que o site manda hoje. Se o site renomear uma constante, o teste segue com o valor de reserva.
const POLITICA_VERSAO = configSite.POLITICA_VERSAO ?? 'rascunho-2026-08-10';
const TEXTO_MARKETING = configSite.TEXTO_MARKETING ?? { contato: 'contato-marketing-v1', interesse: 'interesse-marketing-v1' };
const TEXTO_CIENCIA = configSite.TEXTO_CIENCIA ?? { contato: 'contato-ciencia-v1', interesse: 'interesse-ciencia-v1' };

const CODE = 'Code: Validar e normalizar';
const DECIDIR = 'Code: Decidir pela leitura';
const STOP = 'Stop and Error: Registrar falha';
const ORIGENS = ['https://waveops.com.br', 'https://www.waveops.com.br'];
const AGORA = '2026-10-10T09:15:00.000-03:00';
const AGORA_MS = Date.parse('2026-10-10T12:15:00.000Z');

// ---- Contrato pinado (mudou o contrato, mude aqui de propósito) ----
const CHAVES_ANTIGAS = ['nome', 'empresa', 'whatsapp', 'dor', 'mensagem', 'origem', 'enviadoEm', 'preenchidoEmMs',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landingUrl'];
const CHAVES_NOVAS_LEAD = ['versaoContrato', 'idEnvio', 'canalRetorno', 'telefone', 'email', 'melhorHorario', 'procura',
  'politicaCiente', 'politicaVersao', 'politicaCienteEm', 'cienciaTextoVersao', 'marketingAceito', 'marketingTextoVersao',
  'primeiraFonte', 'pagina', 'website'];
const CONTRATO_LEAD = [...CHAVES_ANTIGAS, ...CHAVES_NOVAS_LEAD];
const CONTRATO_INTERESSE = ['versaoContrato', 'idEnvio', 'email', 'politicaCiente', 'politicaVersao', 'politicaCienteEm',
  'cienciaTextoVersao', 'marketingAceito', 'marketingTextoVersao', 'finalidade', 'origem', 'pagina', 'enviadoEm', 'preenchidoEmMs',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landingUrl', 'primeiraFonte', 'website'];
/** Honeypot: a validação consome, não há o que guardar. */
const SEM_COLUNA = ['website'];
const COLUNAS_ATUAIS_DA_PLANILHA = ['nome', 'empresa', 'whatsapp', 'dor', 'mensagem', 'origem', 'enviadoEm',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landingUrl', 'recebidoEm'];
const COLUNAS_NOVAS_LEAD = ['versaoContrato', 'idEnvio', 'canalRetorno', 'telefone', 'email',
  'melhorHorario', 'procura', 'preenchidoEmMs', 'politicaCiente', 'politicaVersao', 'politicaCienteEm', 'cienciaTextoVersao',
  'marketingAceito', 'marketingTextoVersao', 'primeiraFonte', 'pagina'];
const COLUNAS_LEAD = [...COLUNAS_ATUAIS_DA_PLANILHA, ...COLUNAS_NOVAS_LEAD];
const COLUNAS_INTERESSE = ['email', 'recebidoEm', 'finalidade', 'origem', 'pagina', 'marketingAceito', 'marketingTextoVersao',
  'politicaCiente', 'politicaVersao', 'politicaCienteEm', 'cienciaTextoVersao', 'enviadoEm', 'preenchidoEmMs', 'idEnvio', 'versaoContrato',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landingUrl', 'primeiraFonte'];

const FLUXOS = [
  { nome: 'lead', wf: lead, arquivo: ARQUIVO_LEAD, path: 'waveops-lead-v2', contrato: CONTRATO_LEAD, colunas: COLUNAS_LEAD,
    colunaBusca: 'idEnvio', primeiraOcorrencia: true, nos: { buscar: 'Sheets: Buscar idEnvio', gravar: 'Sheets: Gravar lead',
      set: 'Set: Montar linha do lead', ja: 'IF: Já gravado?', respondeJa: 'Respond: 200 duplicado', respondeGravado: 'Respond: 200 gravado' } },
  { nome: 'interesse', wf: interesse, arquivo: ARQUIVO_INTERESSE, path: 'waveops-interesse', contrato: CONTRATO_INTERESSE, colunas: COLUNAS_INTERESSE,
    colunaBusca: 'email', primeiraOcorrencia: false, nos: { buscar: 'Sheets: Buscar e-mail', gravar: 'Sheets: Gravar na lista',
      set: 'Set: Montar linha da lista', ja: 'IF: Já registrado?', respondeJa: 'Respond: 200 já estava na lista', respondeGravado: 'Respond: 200 gravado' } },
];

// ---- Utilidades de grafo ----
const porNome = (wf, nome) => wf.nodes.find((n) => n.name === nome);
const tipoDe = (wf, tipo) => wf.nodes.filter((n) => n.type === `n8n-nodes-base.${tipo}`);
const saidasDe = (wf, nome) => wf.connections[nome]?.main ?? [];

/** Todos os caminhos do início até uma folha, com a saída usada em cada nó. */
function caminhos(wf, inicio) {
  const todos = [];
  const visitar = (nome, trilha) => {
    if (trilha.some((passo) => passo.no === nome)) throw new Error(`ciclo em ${nome}`);
    const proximos = [];
    saidasDe(wf, nome).forEach((lista, saida) => lista.forEach((destino) => proximos.push({ saida, para: destino.node })));
    if (proximos.length === 0) {
      todos.push([...trilha, { no: nome, saida: null }]);
      return;
    }
    for (const proximo of proximos) visitar(proximo.para, [...trilha, { no: nome, saida: proximo.saida }]);
  };
  visitar(inicio, []);
  return todos;
}

const nomeDoWebhook = (wf) => tipoDe(wf, 'webhook')[0].name;
const statusDe = (wf, nome) => porNome(wf, nome).parameters.options.responseCode;
const ehResposta = (wf, nome) => porNome(wf, nome).type === 'n8n-nodes-base.respondToWebhook';

// ---- Execução dos nós Code de verdade ----
/**
 * @param {string} jsCode
 * @param {{ json: object }[]} itens itens de entrada do nó
 * @param {{ anteriores?: Map<string, { json: object }[]>, memoria?: object, relogio?: { agora: number }, semMemoria?: boolean }} [opcoes]
 */
function executarCodigo(jsCode, itens, opcoes = {}) {
  const { anteriores = new Map(), memoria = {}, relogio = { agora: AGORA_MS }, semMemoria = false, memoriaQueLanca = false } = opcoes;
  // O n8n recebe o corpo já lido de um JSON: chave com valor indefinido não chega.
  itens = JSON.parse(JSON.stringify(itens));
  const RelogioFalso = class extends Date {
    static now() {
      return relogio.agora;
    }
  };
  const buscarNo = (nome) => ({
    first: () => {
      const lista = anteriores.get(nome);
      if (!lista || lista.length === 0) throw new Error(`sem dados em ${nome}`);
      return lista[0];
    },
  });
  const contexto = vm.createContext({
    $input: { first: () => itens[0], all: () => itens },
    $: buscarNo,
    $now: { toISO: () => AGORA },
    Date: RelogioFalso,
    ...(semMemoria ? {} : {
      $getWorkflowStaticData: () => {
        if (memoriaQueLanca) throw new Error('a memória do workflow não está disponível neste runner');
        return memoria;
      },
    }),
  });
  const roteiro = new vm.Script(`(function () {\n${jsCode}\n})()`);
  return JSON.parse(JSON.stringify(roteiro.runInContext(contexto, { timeout: 1000 })));
}
const rodarCode = (wf, requisicao, opcoes) => executarCodigo(porNome(wf, CODE).parameters.jsCode, [{ json: requisicao }], opcoes)[0].json;

/** Roda o Code de decisão como o n8n roda: com os itens que a busca devolveu e a saída do Code de validação à mão. */
function rodarDecisao(f, itensDaBusca, linhaEsperada) {
  const anteriores = new Map([[CODE, [{ json: { linha: linhaEsperada } }]]]);
  return executarCodigo(porNome(f.wf, DECIDIR).parameters.jsCode, itensDaBusca.map((json) => ({ json })), { anteriores })[0].json;
}

// ---- Corpos de exemplo (escritos à mão) ----
const corpoLead = (extra = {}) => ({
  nome: 'Ana Souza', empresa: 'ACME', whatsapp: '34991775784', dor: 'Time copiando e colando dados',
  mensagem: 'Quero automatizar o follow-up.', origem: 'contato', enviadoEm: '2026-10-10T12:15:00.000Z', preenchidoEmMs: 5300,
  utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'out', utm_content: 'a', utm_term: 'b',
  referrer: 'https://www.google.com/', landingUrl: 'https://waveops.com.br/?utm_source=google',
  versaoContrato: 2, idEnvio: '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11', canalRetorno: 'whatsapp', telefone: '34991775784',
  email: '', melhorHorario: '', procura: 'Projeto sob medida', politicaCiente: true, politicaVersao: 'rascunho-2026-08-10',
  politicaCienteEm: '2026-10-10T12:15:00.000Z', cienciaTextoVersao: 'contato-ciencia-v1', marketingAceito: false,
  marketingTextoVersao: 'contato-marketing-v1', primeiraFonte: 'google/cpc', pagina: '/contato/', website: '', ...extra,
});
const corpoInteresse = (extra = {}) => ({
  versaoContrato: 1, idEnvio: '9c1d2e3f-0a1b-4c2d-8e3f-4a5b6c7d8e9f', email: 'ana@empresa.com.br', politicaCiente: true,
  politicaVersao: 'rascunho-2026-08-10', politicaCienteEm: '2026-10-10T12:15:00.000Z', cienciaTextoVersao: 'interesse-ciencia-v1',
  marketingAceito: false, marketingTextoVersao: 'interesse-marketing-v1', finalidade: 'aviso_abertura_plataforma', origem: 'plataforma',
  pagina: '/plataforma/', enviadoEm: '2026-10-10T12:15:00.000Z', preenchidoEmMs: 4200, utm_source: '', utm_medium: '',
  utm_campaign: '', utm_content: '', utm_term: '', referrer: '', landingUrl: 'https://waveops.com.br/plataforma/',
  primeiraFonte: 'direto', website: '', ...extra,
});
const requisicao = (corpo, origin = 'https://waveops.com.br') => ({ headers: origin === null ? {} : { origin }, body: corpo });

// ---- Corpos que o código real do site monta ----
const ctxDoSite = (extra = {}) => ({
  idEnvio: 'b0c5a1f2-6d3e-4f70-9a8b-1c2d3e4f5a6b',
  agora: new Date('2026-10-10T12:15:00.000Z'),
  preenchidoEmMs: 5300,
  atribuicao: {
    fonte: 'google/cpc',
    landingUrl: 'https://waveops.com.br/?utm_source=google',
    referrer: 'https://www.google.com/',
    utm: { source: 'google', medium: 'cpc', campaign: 'out', term: '', content: '' },
  },
  pagina: '/contato/',
  politicaVersao: POLITICA_VERSAO,
  cienciaTextoVersao: TEXTO_CIENCIA.contato,
  marketingTextoVersao: TEXTO_MARKETING.contato,
  ...extra,
});
const dadosDoSite = (extra = {}) => ({
  nome: 'Ana Souza', empresa: 'ACME', canalRetorno: 'whatsapp', telefone: '(34) 99177-5784', email: '', mensagem: 'Oi',
  politicaCiente: true, marketingAceito: false, website: '', ...extra,
});
const rotulosDoSite = { dor: 'Time copiando e colando dados', procura: 'Projeto sob medida', melhorHorario: 'Tarde' };

// ---- Simulador do grafo ----
/** Avalia uma expressão do n8n (`={{ ... }}`) num contexto novo, sem acesso a process nem a require. */
function avaliar(valor, contexto) {
  if (typeof valor !== 'string' || !valor.startsWith('=')) return valor;
  const texto = valor.slice(1);
  const executar = (expressao) => {
    const resultado = vm.runInNewContext(`(${expressao})`, { $json: contexto.json, $: contexto.buscar }, { timeout: 500 });
    return resultado !== null && typeof resultado === 'object' ? JSON.parse(JSON.stringify(resultado)) : resultado;
  };
  const unica = texto.match(/^\{\{([\s\S]*)\}\}$/);
  if (unica && !unica[1].includes('}}')) return executar(unica[1]);
  return texto.replace(/\{\{([\s\S]*?)\}\}/g, (_, expressao) => String(executar(expressao)));
}

/**
 * Como o Google Sheets devolve a linha, conforme o formato pedido na leitura:
 * nativo (UNFORMATTED_VALUE, o que o JSON pede): booleano e número de verdade;
 * ingles (FORMATTED_VALUE em planilha em inglês): TRUE, FALSE e números como texto;
 * ptbr (FORMATTED_VALUE em planilha no Brasil): VERDADEIRO, FALSO e números como texto.
 */
const comoOSheetsDevolve = (linha, formato = 'nativo') => {
  if (formato === 'nativo') return { ...linha };
  const verdadeiro = formato === 'ptbr' ? 'VERDADEIRO' : 'TRUE';
  const falso = formato === 'ptbr' ? 'FALSO' : 'FALSE';
  return Object.fromEntries(Object.entries(linha).map(([chave, valor]) => [chave, typeof valor === 'boolean' ? (valor ? verdadeiro : falso) : String(valor)]));
};

function simular(wf, { corpo, headers = { origin: 'https://waveops.com.br' }, planilha, falharCode = false, memoria = {}, relogio = { agora: AGORA_MS } }) {
  const eventos = [];
  const respostas = [];
  const emails = [];
  const resultados = new Map();
  let execucaoFalhou = false;
  let mensagemDeErro = '';
  const buscar = (nome) => ({
    first: () => {
      const itens = resultados.get(nome);
      if (!itens || itens.length === 0) throw new Error(`sem dados em ${nome}`);
      return itens[0];
    },
  });
  const fila = [{ no: nomeDoWebhook(wf), itens: [{ json: { headers, body: corpo } }] }];
  const guarda = [];
  while (fila.length > 0) {
    const { no: nome, itens } = fila.shift();
    guarda.push(nome);
    assert.ok(guarda.length < 80, 'execução em laço');
    const n = porNome(wf, nome);
    const contexto = { json: itens[0]?.json ?? {}, buscar };
    let saidas;
    try {
      switch (n.type) {
        case 'n8n-nodes-base.webhook':
          saidas = [itens];
          break;
        case 'n8n-nodes-base.code':
          if (falharCode && nome === CODE) throw new Error('falha simulada no Code');
          saidas = [executarCodigo(n.parameters.jsCode, itens, { anteriores: resultados, memoria, relogio }).map((item) => item)];
          break;
        case 'n8n-nodes-base.if': {
          const condicao = n.parameters.conditions.conditions[0];
          const esquerda = avaliar(condicao.leftValue, contexto);
          const verdadeiro = condicao.operator.type === 'boolean'
            ? esquerda === true
            : String(esquerda) === String(avaliar(condicao.rightValue, contexto));
          saidas = verdadeiro ? [itens, []] : [[], itens];
          break;
        }
        case 'n8n-nodes-base.googleSheets': {
          if (n.parameters.operation === 'read') {
            eventos.push('leu');
            if (planilha.leituraSimulada) {
              saidas = [planilha.leituraSimulada({ itens }).map((json) => ({ json }))];
              break;
            }
            if (planilha.falharLeitura) throw new Error('planilha fora');
            const filtro = n.parameters.filtersUI.values[0];
            const valor = avaliar(filtro.lookupValue, contexto);
            const achadas = planilha.linhas.filter((linha) => String(linha[filtro.lookupColumn] ?? '') === String(valor));
            const limitadas = n.parameters.options.returnFirstMatch ? achadas.slice(0, 1) : achadas;
            saidas = [limitadas.length > 0 ? limitadas.map((linha) => ({ json: comoOSheetsDevolve(linha, planilha.formato) })) : (n.alwaysOutputData ? [{ json: {} }] : [])];
          } else {
            if (planilha.falharGravacao) throw new Error('escrita recusada');
            const linha = itens[0].json;
            if (n.parameters.options.handlingExtraData === 'error') {
              const sobra = Object.keys(linha).filter((chave) => !planilha.colunas.includes(chave));
              if (sobra.length > 0) throw new Error(`coluna não encontrada: ${sobra.join(', ')}`);
            }
            planilha.linhas.push({ ...linha });
            eventos.push('gravou');
            saidas = [[{ json: linha }]];
          }
          break;
        }
        case 'n8n-nodes-base.set': {
          const json = {};
          for (const atribuicao of n.parameters.assignments.assignments) json[atribuicao.name] = avaliar(atribuicao.value, contexto);
          saidas = [[{ json }]];
          break;
        }
        case 'n8n-nodes-base.respondToWebhook':
          respostas.push({
            status: n.parameters.options.responseCode,
            corpo: avaliar(n.parameters.responseBody, contexto),
            cabecalhos: Object.fromEntries(n.parameters.options.responseHeaders.entries.map((e) => [e.name, e.value])),
          });
          eventos.push(`respondeu:${n.parameters.options.responseCode}`);
          saidas = [itens];
          break;
        case 'n8n-nodes-base.gmail':
          emails.push({ assunto: avaliar(n.parameters.subject, contexto), corpo: avaliar(n.parameters.message, contexto) });
          eventos.push('email');
          saidas = [itens];
          break;
        case 'n8n-nodes-base.stopAndError':
          execucaoFalhou = true;
          mensagemDeErro = String(avaliar(n.parameters.errorMessage, contexto));
          eventos.push('falhou');
          saidas = [];
          break;
        default:
          throw new Error(`tipo não simulado: ${n.type}`);
      }
    } catch (erro) {
      const itemDeErro = { json: { error: String(erro.message) } };
      if (n.onError === 'continueErrorOutput') {
        saidas = [[], [itemDeErro]];
      } else if (n.onError === 'continueRegularOutput') {
        saidas = [[itemDeErro]];
      } else {
        execucaoFalhou = true;
        eventos.push(`erro-sem-tratamento:${nome}`);
        continue;
      }
    }
    resultados.set(nome, saidas[0] ?? []);
    saidas.forEach((lista, indice) => {
      if (lista.length === 0) return;
      for (const destino of saidasDe(wf, nome)[indice] ?? []) fila.push({ no: destino.node, itens: lista });
    });
  }
  return { respostas, emails, eventos, execucaoFalhou, mensagemDeErro, passou: guarda };
}

const planilhaVazia = (colunas, linhas = []) => ({ colunas, linhas: linhas.map((linha) => ({ ...linha })), falharLeitura: false, falharGravacao: false });
const respostaDe = (r) => r.respostas.map((x) => x.status);

// ================= Estrutura =================
for (const f of FLUXOS) {
  const { wf } = f;

  test(`${f.nome}: JSON importável, inativo e com configuração explícita`, () => {
    assert.equal(wf.active, false);
    assert.equal(typeof wf.name, 'string');
    assert.deepEqual(wf.pinData, {});
    assert.equal(wf.settings.executionOrder, 'v1');
    assert.equal(wf.settings.timezone, 'America/Sao_Paulo');
    assert.equal(wf.settings.saveDataErrorExecution, 'all');
    assert.equal(wf.settings.saveDataSuccessExecution, 'none');
    assert.ok(wf.settings.executionTimeout > 0);
    assert.equal(wf.nodes.length, 27);
    const nomes = wf.nodes.map((n) => n.name);
    assert.equal(new Set(nomes).size, nomes.length, 'nomes de nó duplicados');
    const ids = wf.nodes.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, 'ids de nó duplicados');
    for (const n of wf.nodes) {
      assert.ok(Array.isArray(n.position) && n.position.length === 2, `${n.name}: posição`);
      assert.equal(typeof n.typeVersion, 'number', `${n.name}: typeVersion`);
      assert.ok(n.type.startsWith('n8n-nodes-base.'), `${n.name}: tipo`);
    }
  });

  test(`${f.nome}: todo nó referenciado em connections existe e nada fica solto`, () => {
    const nomes = new Set(wf.nodes.map((n) => n.name));
    for (const [origem, ligacoes] of Object.entries(wf.connections)) {
      assert.ok(nomes.has(origem), `origem inexistente: ${origem}`);
      for (const lista of ligacoes.main) {
        for (const destino of lista) {
          assert.ok(nomes.has(destino.node), `destino inexistente: ${destino.node}`);
          assert.equal(destino.type, 'main');
          assert.equal(destino.index, 0);
        }
      }
    }
    const alcancados = new Set();
    const marcar = (nome) => {
      if (alcancados.has(nome)) return;
      alcancados.add(nome);
      for (const lista of saidasDe(wf, nome)) for (const destino of lista) marcar(destino.node);
    };
    marcar(nomeDoWebhook(wf));
    for (const gatilho of tipoDe(wf, 'errorTrigger')) marcar(gatilho.name);
    const soltos = wf.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote' && !alcancados.has(n.name));
    assert.deepEqual(soltos.map((n) => n.name), [], 'nós órfãos');
    assert.ok(wf.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote').length >= 1, 'falta a nota que explica o fluxo');
  });

  test(`${f.nome}: IF e saídas de erro têm os dois lados ligados`, () => {
    for (const n of tipoDe(wf, 'if')) {
      const saidas = saidasDe(wf, n.name);
      assert.equal(saidas.length, 2, `${n.name}: precisa de duas saídas`);
      assert.ok(saidas[0].length > 0 && saidas[1].length > 0, `${n.name}: ramo verdadeiro e falso`);
    }
    for (const n of wf.nodes.filter((x) => x.onError === 'continueErrorOutput')) {
      const saidas = saidasDe(wf, n.name);
      assert.equal(saidas.length, 2, `${n.name}: saída de sucesso e de erro`);
      assert.ok(saidas[0].length > 0 && saidas[1].length > 0, `${n.name}: as duas saídas ligadas`);
      assert.notEqual(n.alwaysOutputData, true, `${n.name}: alwaysOutputData com saída de erro pode emitir item vazio também no sucesso`);
    }
    // Quem continua pela saída regular (a busca) é seguido pelo Code que classifica a resposta, nunca direto por um IF.
    for (const n of wf.nodes.filter((x) => x.onError === 'continueRegularOutput')) {
      const [[destino]] = saidasDe(wf, n.name);
      assert.equal(destino.node, DECIDIR, `${n.name}: precisa do Code de decisão logo depois`);
    }
  });

  test(`${f.nome}: webhook, CORS e resposta por nó`, () => {
    const webhooks = tipoDe(wf, 'webhook');
    assert.equal(webhooks.length, 1);
    const p = webhooks[0].parameters;
    assert.equal(p.httpMethod, 'POST');
    assert.equal(p.path, f.path);
    assert.equal(p.responseMode, 'responseNode');
    assert.equal(p.authentication, 'none');
    assert.equal(p.options.allowedOrigins, ORIGENS.join(','), 'CORS: duas origens, sem espaço depois da vírgula');
    const codigo = porNome(wf, CODE).parameters.jsCode;
    for (const origem of ORIGENS) assert.ok(codigo.includes(`'${origem}'`), `o Code precisa da mesma lista de origens: ${origem}`);
  });

  test(`${f.nome}: todo caminho a partir do webhook passa por um Respond to Webhook`, () => {
    const todos = caminhos(wf, nomeDoWebhook(wf));
    assert.ok(todos.length >= 8);
    for (const caminho of todos) {
      assert.ok(caminho.some((passo) => ehResposta(wf, passo.no)), `sem resposta: ${caminho.map((x) => x.no).join(' > ')}`);
    }
  });

  test(`${f.nome}: 200 só depois da gravação, e as únicas exceções são o robô e a repetição`, () => {
    const todos = caminhos(wf, nomeDoWebhook(wf));
    const respostas200 = tipoDe(wf, 'respondToWebhook').filter((n) => statusDe(wf, n.name) === 200).map((n) => n.name);
    assert.deepEqual(respostas200.sort(), ['Respond: 200 descartado', f.nos.respondeGravado, f.nos.respondeJa].sort());
    for (const caminho of todos) {
      const nomes = caminho.map((passo) => passo.no);
      const indiceGravar = nomes.indexOf(f.nos.gravar);
      const indice200 = nomes.findIndex((nome) => ehResposta(wf, nome) && statusDe(wf, nome) === 200);
      if (indice200 === -1) continue;
      const resposta = nomes[indice200];
      const passo = (nome) => caminho.find((x) => x.no === nome);
      if (resposta === f.nos.respondeGravado) {
        assert.ok(indiceGravar !== -1 && indiceGravar < indice200, 'o 200 de gravado vem depois do append');
        assert.equal(caminho[indiceGravar].saida, 0, 'o 200 de gravado sai só do sucesso do append');
        assert.equal(passo('IF: Leitura falhou?').saida, 1);
        assert.equal(passo(f.nos.ja).saida, 1);
      } else if (resposta === f.nos.respondeJa) {
        assert.equal(indiceGravar, -1, 'repetição não grava');
        assert.equal(passo(f.nos.buscar).saida, 0);
        assert.equal(passo(DECIDIR).saida, 0);
        assert.equal(passo('IF: Leitura falhou?').saida, 1, 'só segue como repetição se a leitura deu certo');
        assert.equal(passo(f.nos.ja).saida, 0);
      } else {
        assert.equal(resposta, 'Respond: 200 descartado');
        assert.equal(indiceGravar, -1, 'robô não grava');
        assert.equal(nomes.includes(f.nos.buscar), false, 'robô nem consulta a planilha');
      }
    }
    // Nenhum caminho grava depois de ter respondido 200.
    for (const caminho of todos) {
      const nomes = caminho.map((passo) => passo.no);
      const indiceGravar = nomes.indexOf(f.nos.gravar);
      if (indiceGravar === -1) continue;
      const antes = nomes.slice(0, indiceGravar);
      assert.equal(antes.some((nome) => ehResposta(wf, nome) && statusDe(wf, nome) === 200), false, 'append depois de 200');
    }
  });

  test(`${f.nome}: respostas 403, 422, 429 e 503 nos lugares certos`, () => {
    assert.equal(statusDe(wf, 'Respond: 403 origem'), 403);
    assert.equal(statusDe(wf, 'Respond: 422 validação'), 422);
    assert.equal(statusDe(wf, 'Respond: 429 limite'), 429);
    assert.equal(statusDe(wf, 'Respond: 503 falha'), 503);
    const todos = caminhos(wf, nomeDoWebhook(wf));
    for (const caminho of todos) {
      const nomes = caminho.map((passo) => passo.no);
      const i503 = nomes.indexOf('Respond: 503 falha');
      if (i503 === -1) continue;
      const anterior = caminho[i503 - 1];
      if (anterior.no === 'IF: Leitura falhou?') {
        assert.equal(anterior.saida, 0, '503 pela leitura só quando o IF achou falha');
      } else if (anterior.no === 'Set: Etapa validação') {
        const origem = caminho[i503 - 2];
        assert.equal(origem.no, CODE);
        assert.equal(origem.saida, 1, 'etapa validação só pela saída de erro do Code');
      } else if (anterior.no === 'Set: Etapa gravação') {
        const origem = caminho[i503 - 2];
        assert.equal(origem.no, f.nos.gravar);
        assert.equal(origem.saida, 1, 'etapa gravação só pela saída de erro do append');
      } else {
        assert.fail(`503 alcançado por ${anterior.no}`);
      }
      assert.equal(nomes[i503 + 1], STOP, 'depois do 503 a execução falha de propósito');
    }
    const corpo = (nome) => porNome(wf, nome).parameters.responseBody;
    assert.match(corpo('Respond: 422 validação'), /erro: 'validacao'.*campos/);
    assert.match(corpo('Respond: 429 limite'), /erro: 'limite'/);
    assert.match(corpo('Respond: 503 falha'), /ok: false/);
    for (const n of tipoDe(wf, 'respondToWebhook')) {
      const cabecalhos = Object.fromEntries(n.parameters.options.responseHeaders.entries.map((e) => [e.name, e.value]));
      assert.equal(cabecalhos['Cache-Control'], 'no-store', `${n.name}: sem cache`);
    }
    const cabecalhos429 = porNome(wf, 'Respond: 429 limite').parameters.options.responseHeaders.entries;
    assert.ok(cabecalhos429.some((e) => e.name === 'Retry-After' && e.value === '60'));
  });

  test(`${f.nome}: credencial só por nome, destinatário e planilha como __DEFINIR__, sem segredo`, () => {
    const texto = lerTexto(f.arquivo);
    const permitidas = new Set(['WaveOps Google Sheets', 'WaveOps Gmail']);
    for (const n of wf.nodes.filter((x) => x.credentials)) {
      for (const [tipo, credencial] of Object.entries(n.credentials)) {
        assert.deepEqual(Object.keys(credencial), ['name'], `${n.name}: credencial ${tipo} só com nome`);
        assert.ok(permitidas.has(credencial.name), `${n.name}: nome de credencial inesperado`);
      }
    }
    for (const n of tipoDe(wf, 'gmail')) assert.equal(n.parameters.sendTo, '__DEFINIR__', `${n.name}: destinatário`);
    for (const n of tipoDe(wf, 'googleSheets')) {
      assert.equal(n.parameters.documentId.value, '__DEFINIR__', `${n.name}: documento`);
      assert.equal(n.parameters.sheetName.value, '__DEFINIR__', `${n.name}: aba`);
    }
    const padroes = [/sk-ant-[A-Za-z0-9_-]{20,}/, /sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}/, /xox[bpoas]-[0-9A-Za-z-]{10,}/,
      /ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{50,}/, /apify_api_[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /Bearer\s+\S+/, /pk_(live|test)_/];
    for (const padrao of padroes) assert.equal(padrao.test(texto), false, `padrão de segredo: ${padrao}`);
    assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(texto), false, 'endereço de e-mail no JSON');
    assert.equal(TRAVESSAO.test(texto), false, 'travessão no JSON');
    assert.equal(new RegExp('[' + SEPARADORES + ']').test(texto), false, 'separador de linha cru no JSON');
    assert.equal(/"id"\s*:\s*"[0-9A-Za-z]{16}"/.test(texto), false, 'id de credencial ou de documento');
  });

  test(`${f.nome}: gravação em RAW, com erro para coluna ausente, e uma atribuição por coluna`, () => {
    const gravar = porNome(wf, f.nos.gravar);
    assert.equal(gravar.parameters.operation, 'append');
    assert.equal(gravar.parameters.options.cellFormat, 'RAW', 'RAW evita fórmula vinda do formulário');
    assert.equal(gravar.parameters.options.handlingExtraData, 'error');
    assert.equal(gravar.parameters.options.useAppend, true);
    assert.equal(gravar.parameters.columns.mappingMode, 'autoMapInputData');
    assert.equal(gravar.retryOnFail, false, 'append não repete sozinho: repetição de resposta perdida duplicaria a linha');
    assert.equal(gravar.onError, 'continueErrorOutput');
    const buscar = porNome(wf, f.nos.buscar);
    assert.equal(buscar.parameters.operation, 'read');
    assert.equal(buscar.parameters.filtersUI.values[0].lookupColumn, f.colunaBusca);
    assert.equal(buscar.parameters.options.returnFirstMatch, f.primeiraOcorrencia);
    assert.equal(buscar.parameters.options.outputFormatting.values.general, 'UNFORMATTED_VALUE',
      'leitura sem formato: TRUE e FALSE chegam como booleano e não como VERDADEIRO e FALSO de planilha em português');
    assert.equal(buscar.alwaysOutputData, true);
    assert.equal(buscar.onError, 'continueRegularOutput');
    assert.equal(buscar.retryOnFail, false, 'com Continue o nó engole o erro e o retry nunca dispara: não prometa o que não acontece');
    const atribuicoes = porNome(wf, f.nos.set).parameters.assignments.assignments;
    assert.deepEqual(atribuicoes.map((a) => a.name), f.colunas, 'a ordem das colunas é a ordem da aba');
    for (const a of atribuicoes) assert.ok(a.value.includes(`.linha.${a.name} `) || a.value.endsWith(`.linha.${a.name} }}`), `${a.name}: aponta para o próprio campo`);
    assert.equal(porNome(wf, f.nos.set).parameters.includeOtherFields, false);
  });

  test(`${f.nome}: o Code de decisão classifica com falha fechada e nunca lança`, () => {
    const decidir = porNome(wf, DECIDIR);
    assert.equal(decidir.onError, undefined, 'a decisão não precisa de saída de erro: ela captura por dentro');
    assert.match(decidir.parameters.jsCode, /\bcatch\b/);
    assert.equal(porNome(wf, 'IF: Leitura falhou?').parameters.conditions.conditions[0].leftValue, "={{ $json.acao === 'falha' }}");
    assert.equal(porNome(wf, f.nos.ja).parameters.conditions.conditions[0].leftValue, "={{ $json.acao === 'repetida' }}");
  });

  test(`${f.nome}: cada campo do contrato chega a uma coluna`, () => {
    const colunas = new Set(f.colunas);
    for (const chave of f.contrato) {
      if (SEM_COLUNA.includes(chave)) continue;
      assert.ok(colunas.has(chave), `a chave ${chave} não tem coluna`);
    }
    for (const coluna of f.colunas) {
      assert.ok(f.contrato.includes(coluna) || coluna === 'recebidoEm', `coluna ${coluna} sem origem no contrato`);
    }
    // E o Code realmente a entrega: todas as colunas saem em linha, na ordem da aba.
    const corpo = f.nome === 'lead' ? corpoLead() : corpoInteresse();
    const saida = rodarCode(wf, requisicao(corpo));
    assert.equal(saida.decisao, 'gravar');
    assert.deepEqual(Object.keys(saida.linha), f.colunas);
  });

  test(`${f.nome}: Error Trigger avisa o time sem dado pessoal e a parada traz etapa e detalhe curtos`, () => {
    const gatilho = tipoDe(wf, 'errorTrigger');
    assert.equal(gatilho.length, 1);
    const [[destino]] = saidasDe(wf, gatilho[0].name);
    const aviso = porNome(wf, destino.node);
    assert.equal(aviso.type, 'n8n-nodes-base.gmail');
    const texto = `${aviso.parameters.subject}\n${aviso.parameters.message}`;
    assert.match(texto, /execution\.url/);
    assert.match(texto, /execution\.error\.message/);
    assert.doesNotMatch(texto, /\.linha\.|nome|telefone|whatsapp/, 'o aviso de falha não leva dado pessoal');
    const parada = porNome(wf, STOP);
    const buscar = () => ({ first: () => ({ json: {} }) });
    const mensagem = String(avaliar(parada.parameters.errorMessage, {
      json: { etapa: 'validação', detalhe: 'x'.repeat(50) }, buscar,
    }));
    assert.ok(mensagem.length < 100, `mensagem de erro curta: o n8n corta erro longo (${mensagem.length})`);
    assert.match(mensagem, /^Falha na validação\. O site recebeu 503\./);
    assert.match(String(avaliar(parada.parameters.errorMessage, { json: {}, buscar })), /^Falha na planilha\. O site recebeu 503\.$/);
  });

  test(`${f.nome}: os Set de etapa extraem o detalhe do erro em qualquer formato`, () => {
    const buscar = () => ({ first: () => ({ json: {} }) });
    for (const nome of ['Set: Etapa validação', 'Set: Etapa gravação']) {
      const [etapa, detalhe] = porNome(wf, nome).parameters.assignments.assignments;
      assert.equal(etapa.name, 'etapa');
      assert.equal(detalhe.name, 'detalhe');
      assert.equal(avaliar(detalhe.value, { json: { error: 'planilha  fora\ndo ar' }, buscar }), 'planilha fora do ar');
      assert.equal(avaliar(detalhe.value, { json: { error: { message: 'cota excedida' } }, buscar }), 'cota excedida');
      assert.equal(avaliar(detalhe.value, { json: { error: 'y'.repeat(200) }, buscar }).length, 50);
      assert.equal(avaliar(detalhe.value, { json: {}, buscar }), '');
    }
    assert.equal(porNome(wf, 'Set: Etapa validação').parameters.assignments.assignments[0].value, 'validação');
    assert.equal(porNome(wf, 'Set: Etapa gravação').parameters.assignments.assignments[0].value, 'gravação');
  });
}

test('colunas novas do lead entram depois das atuais, sem renomear nada', () => {
  assert.deepEqual(COLUNAS_LEAD.slice(0, COLUNAS_ATUAIS_DA_PLANILHA.length), COLUNAS_ATUAIS_DA_PLANILHA);
  const atribuicoes = porNome(lead, 'Set: Montar linha do lead').parameters.assignments.assignments.map((a) => a.name);
  assert.deepEqual(atribuicoes.slice(0, COLUNAS_ATUAIS_DA_PLANILHA.length), COLUNAS_ATUAIS_DA_PLANILHA);
  assert.equal(atribuicoes.length - COLUNAS_ATUAIS_DA_PLANILHA.length, 16, '16 colunas novas');
});

// ================= Regras do nó Code: lead =================
const lerLead = (corpo, origin, opcoes) => rodarCode(lead, requisicao(corpo, origin), opcoes);

test('lead válido pelo WhatsApp: grava, deriva whatsapp do telefone e carimba a hora do servidor', () => {
  const r = lerLead(corpoLead());
  assert.equal(r.decisao, 'gravar');
  assert.equal(r.protocolo, '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11');
  assert.equal(r.linha.whatsapp, '34991775784');
  assert.equal(r.linha.telefone, '34991775784');
  assert.equal(r.linha.recebidoEm, AGORA);
  assert.equal(r.linha.origem, 'contato');
  assert.equal(r.linha.preenchidoEmMs, 5300);
  assert.equal(r.linha.politicaCiente, true);
  assert.equal(r.linha.marketingAceito, false);
  assert.equal(r.linha.versaoContrato, 2);
  assert.deepEqual(r.chavesDesconhecidas, []);
  assert.match(r.alerta.assunto, /^Novo contato pelo site: Ana Souza \(ACME\)$/);
  assert.match(r.alerta.corpo, /Retorno por: WhatsApp/);
  assert.match(r.alerta.corpo, /Marketing: não aceito/);
});

test('lead pelo e-mail: telefone dispensado, e-mail normalizado, whatsapp vazio', () => {
  const r = lerLead(corpoLead({ canalRetorno: 'email', telefone: '', whatsapp: '', email: ' Ana@Empresa.com ' }));
  assert.equal(r.decisao, 'gravar');
  assert.equal(r.linha.email, 'ana@empresa.com');
  assert.equal(r.linha.telefone, '');
  assert.equal(r.linha.whatsapp, '');
});

test('lead por ligação: telefone obrigatório e melhor horário gravado', () => {
  const ok = lerLead(corpoLead({ canalRetorno: 'ligacao', whatsapp: '', melhorHorario: 'Tarde' }));
  assert.equal(ok.decisao, 'gravar');
  assert.equal(ok.linha.melhorHorario, 'Tarde');
  assert.equal(ok.linha.whatsapp, '');
  assert.match(ok.alerta.corpo, /Melhor horário: Tarde/);
  const sem = lerLead(corpoLead({ canalRetorno: 'ligacao', telefone: '' }));
  assert.deepEqual(sem.campos, ['telefone']);
});

test('telefone: +55 com máscara vale e sai sem o país, 9 dígitos e 14 dígitos não valem', () => {
  const comPais = lerLead(corpoLead({ telefone: '+55 (34) 99177-5784' }));
  assert.equal(comPais.linha.telefone, '34991775784', 'o site tira o +55 e o servidor também');
  assert.equal(comPais.linha.whatsapp, '34991775784');
  assert.equal(lerLead(corpoLead({ telefone: '(34) 99177-5784' })).linha.telefone, '34991775784');
  assert.equal(lerLead(corpoLead({ telefone: '551234567890' })).linha.telefone, '1234567890', '12 dígitos com 55 na frente');
  assert.equal(lerLead(corpoLead({ telefone: '123456789012' })).linha.telefone, '123456789012', '12 dígitos sem 55: fica como veio');
  assert.equal(lerLead(corpoLead({ telefone: '5534991775' })).linha.telefone, '5534991775', '10 dígitos começando com 55 são um DDD 55');
  assert.deepEqual(lerLead(corpoLead({ telefone: '991775784' })).campos, ['telefone']);
  assert.deepEqual(lerLead(corpoLead({ telefone: '55349917757841' })).campos, ['telefone']);
  assert.equal(lerLead(corpoLead({ telefone: '3433334444' })).decisao, 'gravar');
});

test('e-mail: obrigatório no canal e-mail, opcional nos outros mas válido se vier', () => {
  assert.deepEqual(lerLead(corpoLead({ canalRetorno: 'email', telefone: '', email: '' })).campos, ['email']);
  assert.deepEqual(lerLead(corpoLead({ email: 'sem-arroba' })).campos, ['email']);
  assert.deepEqual(lerLead(corpoLead({ email: 'a@b' })).campos, ['email']);
  assert.deepEqual(lerLead(corpoLead({ email: 'a b@c.com' })).campos, ['email']);
  assert.deepEqual(lerLead(corpoLead({ email: 'a@b.com,c@d.com' })).campos, ['email'], 'dois arrobas');
  assert.equal(lerLead(corpoLead({ email: 'a@b.c' })).decisao, 'gravar', 'mesma regra permissiva do formulário');
  assert.equal(lerLead(corpoLead({ email: 'joão@empresa.com.br' })).decisao, 'gravar', 'acento no e-mail não derruba um lead real');
  assert.equal(lerLead(corpoLead({ email: 'ana@x.com;' })).decisao, 'gravar', 'o site aceita, o servidor também');
  assert.deepEqual(lerLead(corpoLead({ email: `${'a'.repeat(155)}@b.com` })).campos, ['email']);
  assert.deepEqual(lerLead(corpoLead({ email: 'a\u0001@b.com' })).campos, ['email'], 'caractere de controle');
});

test('campos obrigatórios faltando voltam em ordem de contrato', () => {
  const r = lerLead(corpoLead({ nome: ' ', politicaCiente: false, politicaVersao: '', politicaCienteEm: 'ontem' }));
  assert.equal(r.decisao, 'invalido');
  assert.deepEqual(r.campos, ['nome', 'politicaCiente', 'politicaVersao', 'politicaCienteEm']);
  assert.equal(r.linha, null);
});

test('limites de tamanho: nome, empresa e mensagem recusam; metadado é cortado', () => {
  assert.deepEqual(lerLead(corpoLead({ nome: 'x'.repeat(121) })).campos, ['nome']);
  assert.deepEqual(lerLead(corpoLead({ nome: 'x' })).campos, ['nome']);
  assert.deepEqual(lerLead(corpoLead({ empresa: 'x'.repeat(121) })).campos, ['empresa']);
  assert.deepEqual(lerLead(corpoLead({ mensagem: 'x'.repeat(2001) })).campos, ['mensagem']);
  assert.equal(lerLead(corpoLead({ mensagem: 'x'.repeat(2000) })).decisao, 'gravar');
  const longo = lerLead(corpoLead({ utm_campaign: 'c'.repeat(900), landingUrl: `https://waveops.com.br/?${'q'.repeat(900)}`, dor: 'd'.repeat(300) }));
  assert.equal(longo.decisao, 'gravar');
  assert.equal(longo.linha.utm_campaign.length, 200);
  assert.equal(longo.linha.landingUrl.length, 500);
  assert.equal(longo.linha.dor.length, 120);
});

test('versão do contrato e idEnvio', () => {
  assert.deepEqual(lerLead(corpoLead({ versaoContrato: 1 })).campos, ['versaoContrato']);
  assert.deepEqual(lerLead(corpoLead({ idEnvio: 'curto' })).campos, ['idEnvio']);
  assert.deepEqual(lerLead(corpoLead({ idEnvio: 'tem espaço e é inválido' })).campos, ['idEnvio']);
  assert.equal(lerLead(corpoLead({ idEnvio: 'id-mgx1k2z-ab12cd34' })).decisao, 'gravar', 'o plano B do navegador, sem crypto.randomUUID');
  assert.deepEqual(lerLead(corpoLead({ origem: 'landing' })).campos, ['origem']);
  assert.deepEqual(lerLead(corpoLead({ canalRetorno: 'pombo' })).campos, ['canalRetorno']);
});

test('marketing é opt-in separado: ausente vale falso, aceito exige a versão do texto', () => {
  const semChave = corpoLead();
  delete semChave.marketingAceito;
  delete semChave.marketingTextoVersao;
  const r = lerLead(semChave);
  assert.equal(r.decisao, 'gravar');
  assert.equal(r.linha.marketingAceito, false);
  assert.deepEqual(lerLead(corpoLead({ marketingAceito: true, marketingTextoVersao: '' })).campos, ['marketingTextoVersao']);
  const aceito = lerLead(corpoLead({ marketingAceito: true }));
  assert.equal(aceito.linha.marketingAceito, true);
  assert.match(aceito.alerta.corpo, /Marketing: aceito \(texto contato-marketing-v1\)/);
  assert.deepEqual(lerLead(corpoLead({ marketingAceito: 'sim' })).campos, ['marketingAceito']);
  assert.deepEqual(lerLead(corpoLead({ politicaCiente: 'true' })).campos, ['politicaCiente']);
});

test('texto da ciência: gravado, cortado em 60 e opcional (JavaScript antigo em cache não derruba o lead)', () => {
  const r = lerLead(corpoLead());
  assert.equal(r.linha.cienciaTextoVersao, 'contato-ciencia-v1');
  assert.match(r.alerta.corpo, /texto contato-ciencia-v1/);
  const semChave = corpoLead();
  delete semChave.cienciaTextoVersao;
  const antigo = lerLead(semChave);
  assert.equal(antigo.decisao, 'gravar');
  assert.equal(antigo.linha.cienciaTextoVersao, '');
  assert.match(antigo.alerta.corpo, /texto \(não informado\)/);
  assert.equal(lerLead(corpoLead({ cienciaTextoVersao: 'v'.repeat(90) })).linha.cienciaTextoVersao.length, 60);
  assert.equal(lerLead(corpoLead({ cienciaTextoVersao: 123 })).linha.cienciaTextoVersao, '', 'só texto vale');
});

test('robô: isca preenchida ou menos de 1200 ms é descartado em silêncio, antes da validação', () => {
  const isca = lerLead(corpoLead({ website: 'http://spam.example', nome: '' }));
  assert.equal(isca.decisao, 'descartar');
  assert.equal(isca.motivo, 'honeypot');
  assert.equal(isca.protocolo, '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11');
  assert.equal(lerLead(corpoLead({ website: true })).decisao, 'descartar');
  assert.equal(lerLead(corpoLead({ website: '   ' })).decisao, 'gravar', 'só espaço no campo isca não é robô');
  assert.equal(lerLead(corpoLead({ preenchidoEmMs: 1199 })).decisao, 'descartar');
  assert.equal(lerLead(corpoLead({ preenchidoEmMs: 1200 })).decisao, 'gravar');
  assert.equal(lerLead(corpoLead({ preenchidoEmMs: 1200 })).linha.preenchidoEmMs, 1200);
  const semId = lerLead(corpoLead({ website: 'x', idEnvio: '' }));
  assert.equal(semId.protocolo, 'descartado');
});

test('tempo ausente ou não numérico é problema de contrato: 422 na hora, nunca confirmação falsa', () => {
  const semTempo = corpoLead();
  delete semTempo.preenchidoEmMs;
  const r = lerLead(semTempo);
  assert.equal(r.decisao, 'invalido');
  assert.deepEqual(r.campos, ['preenchidoEmMs']);
  assert.deepEqual(lerLead(corpoLead({ preenchidoEmMs: 'abc' })).campos, ['preenchidoEmMs']);
  assert.deepEqual(lerLead(corpoLead({ preenchidoEmMs: null })).campos, ['preenchidoEmMs']);
  assert.equal(lerLead(corpoLead({ preenchidoEmMs: '5300' })).decisao, 'gravar', 'número em texto vale');
  // Robô com isca preenchida continua descartado mesmo sem o tempo.
  assert.equal(lerLead({ ...semTempo, website: 'x' }).decisao, 'descartar');
  const listaSemTempo = corpoInteresse();
  delete listaSemTempo.preenchidoEmMs;
  assert.deepEqual(lerInteresse(listaSemTempo).campos, ['preenchidoEmMs']);
});

test('origem: só as duas origens do site passam', () => {
  assert.equal(lerLead(corpoLead(), 'https://www.waveops.com.br').decisao, 'gravar');
  for (const origin of ['https://waveops.com.br.evil.example', 'http://waveops.com.br', 'https://exemplo.com', 'null', '']) {
    assert.equal(lerLead(corpoLead(), origin).decisao, 'origem', `origem ${origin}`);
  }
  assert.equal(lerLead(corpoLead(), null).decisao, 'origem', 'sem cabeçalho Origin');
});

test('corpo que não é objeto: 422 com o campo corpo', () => {
  for (const corpo of [null, [], 'texto', 42, undefined]) {
    const r = lerLead(corpo);
    assert.equal(r.decisao, 'invalido');
    assert.deepEqual(r.campos, ['corpo']);
  }
});

test('texto de uma linha não carrega quebra de linha para o assunto do e-mail', () => {
  const r = lerLead(corpoLead({ nome: 'Ana\r\nBcc: alguem', empresa: `ACME${SEPARADORES}LTDA` }));
  assert.equal(r.decisao, 'gravar');
  assert.equal(r.linha.nome, 'Ana Bcc: alguem');
  assert.equal(r.linha.empresa, 'ACME LTDA');
  assert.equal(/[\r\n]/.test(r.alerta.assunto), false);
  const msg = lerLead(corpoLead({ mensagem: `linha 1\r\nlinha 2${String.fromCharCode(0, 7)}` }));
  assert.equal(msg.linha.mensagem, 'linha 1\nlinha 2');
});

test('fórmula: valor que começa com = + - ou @ vai à planilha com apóstrofo, e o aviso mantém o texto original', () => {
  const r = lerLead(corpoLead({
    nome: '=HYPERLINK("http://x.example","clique")', empresa: '+cmd', mensagem: '- item um', dor: '@alguem',
    utm_source: '-1+1', referrer: '=1+1', landingUrl: '+55', procura: '=SOMA(1;2)', primeiraFonte: '@x', pagina: '-',
  }));
  assert.equal(r.decisao, 'gravar');
  assert.equal(r.linha.nome, '\'=HYPERLINK("http://x.example","clique")');
  for (const coluna of ['empresa', 'mensagem', 'dor', 'utm_source', 'referrer', 'landingUrl', 'procura', 'primeiraFonte', 'pagina']) {
    assert.ok(r.linha[coluna].startsWith("'"), `${coluna} sem apóstrofo`);
  }
  assert.match(r.alerta.corpo, /Nome: =HYPERLINK/);
  assert.match(r.alerta.corpo, /Mensagem:\n- item um/);
  // Texto comum, números, datas e identificadores ficam como chegaram.
  const comum = lerLead(corpoLead());
  assert.equal(comum.linha.nome, 'Ana Souza');
  assert.equal(comum.linha.telefone, '34991775784');
  assert.equal(comum.linha.idEnvio, '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11');
  assert.equal(comum.linha.enviadoEm.startsWith("'"), false);
  const emailComMais = lerLead(corpoLead({ canalRetorno: 'email', telefone: '', whatsapp: '', email: '+ana@x.com' }));
  assert.equal(emailComMais.linha.email, "'+ana@x.com");
});

test('chave fora do contrato não vira coluna e fica visível', () => {
  const r = lerLead(corpoLead({ novoCampo: 'x', outro: 1 }));
  assert.equal(r.decisao, 'gravar');
  assert.deepEqual(r.chavesDesconhecidas, ['novoCampo', 'outro']);
  assert.equal('novoCampo' in r.linha, false);
  assert.match(r.alerta.corpo, /Atenção: o corpo trouxe chaves que não viram coluna: novoCampo, outro/);
  assert.doesNotMatch(lerLead(corpoLead()).alerta.corpo, /Atenção/);
});

// ================= Limite de volume =================
test('limite por minuto: no teto, o envio seguinte recebe a decisão limite e o contador volta depois de 60 s', () => {
  const { minuto } = LIMITES_DE_TESTE.lead;
  const id = (i) => `envio-${String(i).padStart(4, '0')}-abcd`;
  const memoria = {};
  const relogio = { agora: AGORA_MS };
  for (let i = 0; i < minuto; i++) {
    const r = lerLead(corpoLead({ idEnvio: id(i) }), undefined, { memoria, relogio });
    assert.equal(r.decisao, 'gravar', `envio ${i + 1}`);
    relogio.agora += 1000;
  }
  const estourou = lerLead(corpoLead({ idEnvio: id(minuto) }), undefined, { memoria, relogio });
  assert.equal(estourou.decisao, 'limite');
  assert.equal(estourou.linha, null);
  assert.equal(memoria.envios.length, minuto, 'o envio recusado não entra na contagem');
  relogio.agora += 60_000;
  assert.equal(lerLead(corpoLead({ idEnvio: id(minuto + 1) }), undefined, { memoria, relogio }).decisao, 'gravar', 'a janela de 60 s andou');
});

test('limite por hora: vale mesmo com envios espaçados; envio inválido, robô e origem errada não contam', () => {
  const { hora } = LIMITES_DE_TESTE.lead;
  const id = (i) => `hora-${String(i).padStart(4, '0')}-abcd`;
  const memoria = {};
  const relogio = { agora: AGORA_MS };
  for (let i = 0; i < hora; i++) {
    const r = lerLead(corpoLead({ idEnvio: id(i) }), undefined, { memoria, relogio });
    assert.equal(r.decisao, 'gravar', `envio ${i + 1}`);
    relogio.agora += 30_000;
  }
  assert.equal(lerLead(corpoLead({ idEnvio: id(hora) }), undefined, { memoria, relogio }).decisao, 'limite');
  relogio.agora += 3_600_000;
  assert.equal(lerLead(corpoLead({ idEnvio: id(hora + 1) }), undefined, { memoria, relogio }).decisao, 'gravar', 'uma hora depois, liberado');
  const limpa = {};
  lerLead(corpoLead({ nome: '' }), undefined, { memoria: limpa });
  lerLead(corpoLead({ website: 'x' }), undefined, { memoria: limpa });
  lerLead(corpoLead(), 'https://exemplo.com', { memoria: limpa });
  assert.equal(limpa.envios, undefined, 'só envio válido entra na contagem');
});

test('limite: sem a memória do n8n o Code segue sem contar, e com 0 o limite fica desligado', () => {
  assert.equal(lerLead(corpoLead(), undefined, { semMemoria: true }).decisao, 'gravar');
  const comErro = lerLead(corpoLead(), undefined, { memoriaQueLanca: true });
  assert.equal(comErro.decisao, 'gravar');
  assert.equal(comErro.linha.idEnvio, '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11');
  assert.equal(lerInteresse(corpoInteresse(), undefined, { memoriaQueLanca: true }).decisao, 'gravar');
  const desligado = porNome(comLimites(leadPublicado, { minuto: 0, hora: 0 }), CODE).parameters.jsCode;
  const memoria = {};
  for (let i = 0; i < 30; i++) {
    const saida = executarCodigo(desligado, [{ json: requisicao(corpoLead({ idEnvio: `livre-${String(i).padStart(4, '0')}-abcd` })) }], { memoria })[0].json;
    assert.equal(saida.decisao, 'gravar');
  }
  assert.deepEqual(memoria, {}, 'desligado não mexe na memória');
});

test('os workflows publicados não trazem os valores do limite, e o nó Code falha até alguém definir', () => {
  for (const wf of [leadPublicado, interessePublicado]) {
    const js = porNome(wf, CODE).parameters.jsCode;
    assert.ok(js.includes(MARCA_MINUTO) && js.includes(MARCA_HORA), `${wf.name}: limites como __DEFINIR__`);
    assert.throws(() => executarCodigo(js, [{ json: requisicao(corpoLead()) }]), /Defina LIMITE_POR_MINUTO e LIMITE_POR_HORA/);
  }
  for (const arquivo of [ARQUIVO_LEAD, ARQUIVO_INTERESSE, ARQUIVO_DOC]) {
    const texto = lerTexto(arquivo);
    assert.doesNotMatch(texto, /LIMITE_POR_(MINUTO|HORA) = \d/, `${arquivo}: valor do limite`);
    assert.doesNotMatch(texto, /\d+ envios válidos por (minuto|hora)|\d+ por (minuto|hora)/, `${arquivo}: valor do limite`);
  }
});

// ================= Regras do nó Code: lista de interesse =================
const lerInteresse = (corpo, origin, opcoes) => rodarCode(interesse, requisicao(corpo, origin), opcoes);

test('interesse válido: e-mail normalizado, hora do servidor, finalidade fixa', () => {
  const r = lerInteresse(corpoInteresse({ email: ' Ana@Empresa.com.br ' }));
  assert.equal(r.decisao, 'gravar');
  assert.equal(r.linha.email, 'ana@empresa.com.br');
  assert.equal(r.linha.recebidoEm, AGORA);
  assert.equal(r.linha.finalidade, 'aviso_abertura_plataforma');
  assert.equal(r.linha.origem, 'plataforma');
  assert.equal(r.protocolo, '9c1d2e3f-0a1b-4c2d-8e3f-4a5b6c7d8e9f');
});

test('interesse: texto da ciência gravado e opcional', () => {
  assert.equal(lerInteresse(corpoInteresse()).linha.cienciaTextoVersao, 'interesse-ciencia-v1');
  const semChave = corpoInteresse();
  delete semChave.cienciaTextoVersao;
  const antigo = lerInteresse(semChave);
  assert.equal(antigo.decisao, 'gravar');
  assert.equal(antigo.linha.cienciaTextoVersao, '');
});

test('interesse inválido: e-mail, ciência, versão, finalidade e origem', () => {
  assert.deepEqual(lerInteresse(corpoInteresse({ email: 'ana@empresa' })).campos, ['email']);
  assert.deepEqual(lerInteresse(corpoInteresse({ email: 'ana @empresa.com' })).campos, ['email']);
  assert.deepEqual(lerInteresse(corpoInteresse({ email: '' })).campos, ['email']);
  assert.equal(lerInteresse(corpoInteresse({ email: 'a@b.c' })).decisao, 'gravar');
  assert.equal(lerInteresse(corpoInteresse({ email: 'ana@x.com;' })).decisao, 'gravar', 'o site aceita, o servidor também');
  assert.deepEqual(lerInteresse(corpoInteresse({ politicaCiente: false })).campos, ['politicaCiente']);
  assert.deepEqual(lerInteresse(corpoInteresse({ versaoContrato: 2 })).campos, ['versaoContrato']);
  assert.deepEqual(lerInteresse(corpoInteresse({ finalidade: 'outra' })).campos, ['finalidade']);
  assert.deepEqual(lerInteresse(corpoInteresse({ origem: 'contato' })).campos, ['origem']);
  assert.deepEqual(lerInteresse(corpoInteresse({ marketingAceito: true, marketingTextoVersao: '' })).campos, ['marketingTextoVersao']);
});

test('interesse: robô, origem, corpo, fórmula e limite seguem as mesmas regras do lead', () => {
  assert.equal(lerInteresse(corpoInteresse({ website: 'x' })).decisao, 'descartar');
  assert.equal(lerInteresse(corpoInteresse({ preenchidoEmMs: 900 })).decisao, 'descartar');
  assert.equal(lerInteresse(corpoInteresse(), 'https://exemplo.com').decisao, 'origem');
  assert.equal(lerInteresse(corpoInteresse(), null).decisao, 'origem');
  assert.deepEqual(lerInteresse([]).campos, ['corpo']);
  const r = lerInteresse(corpoInteresse({ extra: 1 }));
  assert.deepEqual(r.chavesDesconhecidas, ['extra']);
  assert.match(r.alerta.corpo, /Atenção: o corpo trouxe chaves que não viram coluna: extra/);
  assert.equal(lerInteresse(corpoInteresse({ email: '+ana@x.com' })).linha.email, "'+ana@x.com");
  const { minuto, hora } = LIMITES_DE_TESTE.interesse;
  const id = (prefixo, i) => `${prefixo}-${String(i).padStart(4, '0')}-abcd`;
  const memoria = {};
  const relogio = { agora: AGORA_MS };
  for (let i = 0; i < minuto; i++) {
    assert.equal(lerInteresse(corpoInteresse({ idEnvio: id('lista', i) }), undefined, { memoria, relogio }).decisao, 'gravar');
  }
  assert.equal(lerInteresse(corpoInteresse({ idEnvio: id('lista', minuto) }), undefined, { memoria, relogio }).decisao, 'limite', 'teto por minuto da lista');
  const memoriaHora = {};
  const relogioHora = { agora: AGORA_MS };
  for (let i = 0; i < hora; i++) {
    assert.equal(lerInteresse(corpoInteresse({ idEnvio: id('hora', i) }), undefined, { memoria: memoriaHora, relogio: relogioHora }).decisao, 'gravar');
    relogioHora.agora += 30_000;
  }
  assert.equal(lerInteresse(corpoInteresse({ idEnvio: id('hora', hora) }), undefined, { memoria: memoriaHora, relogio: relogioHora }).decisao, 'limite', 'teto por hora da lista');
});

// ================= Decisão depois da leitura =================
const linhaDoLead = (extra = {}) => ({ idEnvio: 'abc-12345678', ...extra });
const linhaDaLista = (extra = {}) => ({ email: 'ana@empresa.com.br', marketingAceito: false, marketingTextoVersao: 'interesse-marketing-v1', ...extra });
const FLUXO_LEAD = FLUXOS[0];
const FLUXO_LISTA = FLUXOS[1];

test('decisão: item vazio é "nada achado", linha com a chave é repetição, e os dois seguem para gravar ou repetir', () => {
  assert.equal(rodarDecisao(FLUXO_LEAD, [{}], linhaDoLead()).acao, 'gravar');
  assert.equal(rodarDecisao(FLUXO_LEAD, [{ idEnvio: 'abc-12345678', nome: 'Ana', row_number: '5' }], linhaDoLead()).acao, 'repetida');
  assert.equal(rodarDecisao(FLUXO_LEAD, [{ idEnvio: 'outro-12345678', nome: 'Bia' }], linhaDoLead()).acao, 'gravar', 'linha de outra chave não é repetição');
});

test('decisão: qualquer formato de erro ou de resposta estranha vira falha na leitura, nunca "gravar"', () => {
  const formas = [
    ['erro em json.error (texto)', [{ error: 'The resource you are requesting could not be found' }]],
    ['erro em json.error (objeto)', [{ error: { message: 'cota excedida', description: 'x' } }]],
    ['eco do item de entrada, erro fora do json', [{ decisao: 'gravar', motivo: 'ok', linha: { idEnvio: 'abc-12345678' } }]],
    ['resposta que não parece busca', [{ foo: 'bar' }]],
    ['mistura de linha e erro', [{ idEnvio: 'abc-12345678' }, { error: 'meio da leitura' }]],
    ['nenhum item', []],
  ];
  for (const f of FLUXOS) {
    const esperado = f.nome === 'lead' ? linhaDoLead() : linhaDaLista();
    for (const [rotulo, itens] of formas) {
      const r = rodarDecisao(f, itens, esperado);
      assert.equal(r.acao, 'falha', `${f.nome}: ${rotulo}`);
      assert.equal(r.etapa, 'leitura');
      assert.ok(r.detalhe.length <= 50);
    }
  }
  assert.equal(rodarDecisao(FLUXO_LEAD, [{ error: 'cota excedida no Google' }], linhaDoLead()).detalhe, 'cota excedida no Google');
  assert.equal(rodarDecisao(FLUXO_LEAD, [{ error: { message: 'x'.repeat(200) } }], linhaDoLead()).detalhe.length, 50);
  assert.equal(rodarDecisao(FLUXO_LEAD, [{ foo: 1 }], linhaDoLead()).detalhe, 'resposta inesperada da planilha');
});

test('decisão: entrada sem a saída do Code de validação não lança, vira falha', () => {
  const bruto = executarCodigo(porNome(lead, DECIDIR).parameters.jsCode, [{ json: {} }], { anteriores: new Map() })[0].json;
  assert.equal(bruto.acao, 'falha');
  assert.equal(bruto.etapa, 'leitura');
});

test('decisão da lista: vale a linha mais recente do e-mail; consentimento igual repete, diferente grava', () => {
  const nova = (extra) => linhaDaLista(extra);
  const texto = 'interesse-marketing-v1';
  const antiga = { email: 'ana@empresa.com.br', marketingAceito: 'FALSE', marketingTextoVersao: texto, recebidoEm: '2026-10-09T10:00:00.000-03:00' };
  const recente = { email: 'ana@empresa.com.br', marketingAceito: 'TRUE', marketingTextoVersao: texto, recebidoEm: '2026-10-10T10:00:00.000-03:00' };
  assert.equal(rodarDecisao(FLUXO_LISTA, [{}], nova()).acao, 'gravar');
  assert.equal(rodarDecisao(FLUXO_LISTA, [antiga], nova({ marketingAceito: false })).acao, 'repetida');
  assert.equal(rodarDecisao(FLUXO_LISTA, [antiga], nova({ marketingAceito: true })).acao, 'gravar', 'marcou marketing depois');
  assert.equal(rodarDecisao(FLUXO_LISTA, [recente], nova({ marketingAceito: false })).acao, 'gravar', 'desmarcou marketing depois');
  assert.equal(rodarDecisao(FLUXO_LISTA, [recente], nova({ marketingAceito: true })).acao, 'repetida');
  // A ordem das linhas na aba não manda: a data manda.
  assert.equal(rodarDecisao(FLUXO_LISTA, [recente, antiga], nova({ marketingAceito: true })).acao, 'repetida');
  assert.equal(rodarDecisao(FLUXO_LISTA, [antiga, recente], nova({ marketingAceito: false })).acao, 'gravar');
  assert.equal(rodarDecisao(FLUXO_LISTA, [recente, antiga], nova({ marketingAceito: false })).acao, 'gravar', 'a mais recente é TRUE, mesmo vindo primeiro');
  // Valor booleano nativo também vale (UNFORMATTED_VALUE).
  assert.equal(rodarDecisao(FLUXO_LISTA, [{ ...recente, marketingAceito: true }], nova({ marketingAceito: true })).acao, 'repetida');
  // E-mail com caixa diferente na planilha ainda é o mesmo e-mail.
  assert.equal(rodarDecisao(FLUXO_LISTA, [{ ...antiga, email: 'ANA@empresa.com.br' }], nova({ marketingAceito: false })).acao, 'repetida');
  // Planilha no Brasil devolve VERDADEIRO e FALSO quando a leitura vem formatada.
  const ptAntiga = { ...antiga, marketingAceito: 'FALSO' };
  const ptRecente = { ...recente, marketingAceito: 'VERDADEIRO' };
  assert.equal(rodarDecisao(FLUXO_LISTA, [ptAntiga], nova({ marketingAceito: false })).acao, 'repetida');
  assert.equal(rodarDecisao(FLUXO_LISTA, [ptAntiga], nova({ marketingAceito: true })).acao, 'gravar');
  assert.equal(rodarDecisao(FLUXO_LISTA, [ptRecente], nova({ marketingAceito: true })).acao, 'repetida');
  assert.equal(rodarDecisao(FLUXO_LISTA, [ptRecente], nova({ marketingAceito: false })).acao, 'gravar', 'desmarcou: a linha VERDADEIRO não pode continuar valendo');
  // Valor que não é booleano em nenhuma língua nunca vira "mesmo consentimento".
  for (const estranho of ['', 'SIM', 'sim', 'x', null, 0]) {
    assert.equal(rodarDecisao(FLUXO_LISTA, [{ ...recente, marketingAceito: estranho }], nova({ marketingAceito: true })).acao, 'gravar', `valor ${JSON.stringify(estranho)}`);
    assert.equal(rodarDecisao(FLUXO_LISTA, [{ ...antiga, marketingAceito: estranho }], nova({ marketingAceito: false })).acao, 'gravar', `valor ${JSON.stringify(estranho)}`);
  }
  // Aceitar marketing de novo com outra versão do texto registra o aceite do texto novo. Sem aceitar, a versão não importa.
  assert.equal(rodarDecisao(FLUXO_LISTA, [recente], nova({ marketingAceito: true, marketingTextoVersao: 'interesse-marketing-v2' })).acao, 'gravar');
  assert.equal(rodarDecisao(FLUXO_LISTA, [antiga], nova({ marketingAceito: false, marketingTextoVersao: 'interesse-marketing-v2' })).acao, 'repetida');
});

// ================= Simulação do fluxo inteiro =================
test('fluxo do lead novo: grava, só então responde 200 e depois avisa', () => {
  const planilha = planilhaVazia(COLUNAS_LEAD);
  const r = simular(lead, { corpo: corpoLead(), planilha });
  assert.deepEqual(r.eventos.slice(0, 4), ['leu', 'gravou', 'respondeu:200', 'email']);
  assert.deepEqual(respostaDe(r), [200]);
  assert.deepEqual(r.respostas[0].corpo, { ok: true, protocolo: '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11' });
  assert.equal(planilha.linhas.length, 1);
  assert.deepEqual(Object.keys(planilha.linhas[0]), COLUNAS_LEAD);
  assert.equal(planilha.linhas[0].politicaCiente, true);
  assert.equal(r.emails.length, 1);
  assert.match(r.emails[0].assunto, /Ana Souza/);
  assert.equal(r.execucaoFalhou, false);
});

test('fluxo do lead repetido (mesmo idEnvio): 200, sem segunda linha e sem novo aviso', () => {
  const planilha = planilhaVazia(COLUNAS_LEAD);
  simular(lead, { corpo: corpoLead(), planilha });
  const r = simular(lead, { corpo: corpoLead(), planilha });
  assert.equal(planilha.linhas.length, 1);
  assert.deepEqual(respostaDe(r), [200]);
  assert.deepEqual(r.respostas[0].corpo, { ok: true, protocolo: '2f6b0c1e-8a4d-4a55-9d2a-2a3f1d0b9e11' });
  assert.equal(r.emails.length, 0);
  assert.equal(r.eventos.includes('gravou'), false);
});

test('fluxo do lead: linhas antigas da planilha seguem intactas e idEnvio diferente grava outra', () => {
  const antigo = Object.fromEntries(COLUNAS_ATUAIS_DA_PLANILHA.map((c) => [c, `antigo-${c}`]));
  const planilha = planilhaVazia(COLUNAS_LEAD, [antigo]);
  const r = simular(lead, { corpo: corpoLead({ idEnvio: 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb' }), planilha });
  assert.deepEqual(respostaDe(r), [200]);
  assert.equal(planilha.linhas.length, 2);
  assert.deepEqual(planilha.linhas[0], antigo);
});

test('fluxo do lead: robô, validação, origem e limite respondem sem tocar na planilha', () => {
  const planilha = planilhaVazia(COLUNAS_LEAD);
  const robo = simular(lead, { corpo: corpoLead({ website: 'x' }), planilha });
  assert.deepEqual(respostaDe(robo), [200]);
  assert.deepEqual(robo.eventos, ['respondeu:200']);
  const invalido = simular(lead, { corpo: corpoLead({ nome: '' }), planilha });
  assert.deepEqual(respostaDe(invalido), [422]);
  assert.deepEqual(invalido.respostas[0].corpo, { ok: false, erro: 'validacao', campos: ['nome'] });
  const origem = simular(lead, { corpo: corpoLead(), headers: { origin: 'https://exemplo.com' }, planilha });
  assert.deepEqual(respostaDe(origem), [403]);
  assert.deepEqual(origem.respostas[0].corpo, { ok: false, erro: 'origem' });
  assert.equal(planilha.linhas.length, 0);
  assert.equal(robo.emails.length + invalido.emails.length + origem.emails.length, 0);
  for (const r of [robo, invalido, origem]) assert.equal(r.execucaoFalhou, false);
});

test('fluxo do lead: o envio acima do teto por minuto recebe 429 sem tocar na planilha nem no e-mail', () => {
  const { minuto } = LIMITES_DE_TESTE.lead;
  const id = (i) => `fluxo-${String(i).padStart(4, '0')}-abcd`;
  const planilha = planilhaVazia(COLUNAS_LEAD);
  const memoria = {};
  const relogio = { agora: AGORA_MS };
  for (let i = 0; i < minuto; i++) {
    const r = simular(lead, { corpo: corpoLead({ idEnvio: id(i) }), planilha, memoria, relogio });
    assert.deepEqual(respostaDe(r), [200], `envio ${i + 1}`);
  }
  const ultimo = simular(lead, { corpo: corpoLead({ idEnvio: id(minuto) }), planilha, memoria, relogio });
  assert.deepEqual(respostaDe(ultimo), [429]);
  assert.deepEqual(ultimo.respostas[0].corpo, { ok: false, erro: 'limite' });
  assert.equal(ultimo.respostas[0].cabecalhos['Retry-After'], '60');
  assert.deepEqual(ultimo.eventos, ['respondeu:429']);
  assert.equal(planilha.linhas.length, minuto);
});

test('fluxo do lead: planilha fora na leitura ou na escrita vira 503, falha registrada e nenhum 200', () => {
  for (const modo of ['falharLeitura', 'falharGravacao']) {
    const planilha = planilhaVazia(COLUNAS_LEAD);
    planilha[modo] = true;
    const r = simular(lead, { corpo: corpoLead(), planilha });
    assert.deepEqual(respostaDe(r), [503], modo);
    assert.deepEqual(r.respostas[0].corpo, { ok: false, erro: 'indisponivel' });
    assert.equal(r.execucaoFalhou, true, `${modo}: a execução precisa falhar para acionar o aviso`);
    assert.equal(r.eventos[r.eventos.length - 1], 'falhou');
    assert.equal(planilha.linhas.length, 0);
    assert.equal(r.emails.length, 0);
    const etapa = modo === 'falharLeitura' ? 'leitura' : 'gravação';
    assert.match(r.mensagemDeErro, new RegExp(`^Falha na ${etapa}\\. O site recebeu 503\\.`));
    assert.ok(r.mensagemDeErro.length < 100);
  }
});

test('fluxo do lead: falha de leitura em qualquer formato nunca grava e responde 503 (falha fechada)', () => {
  const formas = {
    'erro em json.error': null,
    'eco do item de entrada': ({ itens }) => [{ ...itens[0].json }],
    'resposta estranha': () => [{ foo: 'bar' }],
    'erro com objeto': () => [{ error: { message: 'cota excedida' } }],
  };
  for (const [rotulo, leituraSimulada] of Object.entries(formas)) {
    const planilha = planilhaVazia(COLUNAS_LEAD);
    if (leituraSimulada) planilha.leituraSimulada = leituraSimulada;
    else planilha.falharLeitura = true;
    const r = simular(lead, { corpo: corpoLead(), planilha });
    assert.deepEqual(respostaDe(r), [503], rotulo);
    assert.equal(planilha.linhas.length, 0, `${rotulo}: não pode gravar sem checar a repetição`);
    assert.equal(r.eventos.includes('gravou'), false);
    assert.equal(r.execucaoFalhou, true);
  }
});

test('fluxo do lead: coluna que falta na aba nunca vira dado perdido em silêncio', () => {
  const planilha = planilhaVazia(COLUNAS_LEAD.filter((coluna) => coluna !== 'pagina'));
  const r = simular(lead, { corpo: corpoLead(), planilha });
  assert.deepEqual(respostaDe(r), [503]);
  assert.equal(planilha.linhas.length, 0);
  assert.equal(r.execucaoFalhou, true);
  assert.match(r.mensagemDeErro, /^Falha na gravação\./);
});

test('fluxo do lead: erro no nó Code também responde 503 e falha a execução', () => {
  const r = simular(lead, { corpo: corpoLead(), planilha: planilhaVazia(COLUNAS_LEAD), falharCode: true });
  assert.deepEqual(respostaDe(r), [503]);
  assert.equal(r.execucaoFalhou, true);
  assert.match(r.mensagemDeErro, /^Falha na validação\. O site recebeu 503\. falha simulada no Code$/);
});

test('fluxo: o workflow publicado, sem os valores do limite, responde 503 em todo envio e nunca grava', () => {
  const casos = [[leadPublicado, corpoLead(), COLUNAS_LEAD], [interessePublicado, corpoInteresse(), COLUNAS_INTERESSE]];
  for (const [wf, corpo, colunas] of casos) {
    const planilha = planilhaVazia(colunas);
    for (const origin of ['https://waveops.com.br', 'https://exemplo.com']) {
      const r = simular(wf, { corpo, planilha, headers: { origin } });
      assert.deepEqual(respostaDe(r), [503], `${wf.name}, Origin ${origin}`);
      assert.equal(r.execucaoFalhou, true, 'a execução falha para acionar o aviso ao time');
      assert.match(r.mensagemDeErro, /^Falha na validação\. O site recebeu 503\. Defina LIMITE_POR_MINUTO/);
    }
    assert.equal(planilha.linhas.length, 0);
  }
});

test('fluxo da lista: inscrição nova grava; e-mail repetido recebe a mesma resposta sem nova linha', () => {
  const planilha = planilhaVazia(COLUNAS_INTERESSE);
  const primeira = simular(interesse, { corpo: corpoInteresse(), planilha });
  assert.deepEqual(primeira.eventos.slice(0, 4), ['leu', 'gravou', 'respondeu:200', 'email']);
  assert.equal(planilha.linhas.length, 1);
  assert.deepEqual(Object.keys(planilha.linhas[0]), COLUNAS_INTERESSE);
  const repetida = simular(interesse, {
    corpo: corpoInteresse({ idEnvio: '11111111-2222-4333-8444-555555555555', email: '  ANA@Empresa.com.br ' }),
    planilha,
  });
  assert.equal(planilha.linhas.length, 1, 'e-mail repetido não duplica');
  assert.deepEqual(respostaDe(repetida), [200]);
  assert.deepEqual(Object.keys(repetida.respostas[0].corpo).sort(), Object.keys(primeira.respostas[0].corpo).sort());
  assert.equal(repetida.respostas[0].corpo.ok, true);
  assert.equal(repetida.emails.length, 0);
  assert.equal(repetida.eventos.includes('gravou'), false);
});

test('fluxo da lista: mudança de consentimento de marketing grava linha nova e a mais recente vale, em planilha em qualquer idioma', () => {
  for (const formato of ['nativo', 'ingles', 'ptbr']) {
    const planilha = { ...planilhaVazia(COLUNAS_INTERESSE), formato };
    const relogio = { agora: AGORA_MS };
    let n = 0;
    const enviar = (marketingAceito, extra = {}) => {
      n += 1;
      relogio.agora += 120_000;
      return simular(interesse, {
        corpo: corpoInteresse({ idEnvio: `consent-${String(n).padStart(4, '0')}-abcd`, marketingAceito, ...extra }),
        planilha,
        relogio,
        memoria: {},
      });
    };
    const passos = [[false, 1], [false, 1], [true, 2], [true, 2], [false, 3], [false, 3], [true, 4]];
    for (const [marketing, linhasEsperadas] of passos) {
      const r = enviar(marketing);
      assert.deepEqual(respostaDe(r), [200], formato);
      assert.equal(planilha.linhas.length, linhasEsperadas, `${formato}: marketing ${marketing}`);
    }
    assert.deepEqual(planilha.linhas.map((l) => l.marketingAceito), [false, true, false, true], formato);
    // Mesmo aceite com outra versão do texto: grava, para o texto novo ficar registrado.
    enviar(true, { marketingTextoVersao: 'interesse-marketing-v2' });
    assert.equal(planilha.linhas.length, 5, `${formato}: texto novo`);
    assert.equal(planilha.linhas[4].marketingTextoVersao, 'interesse-marketing-v2');
    enviar(true, { marketingTextoVersao: 'interesse-marketing-v2' });
    assert.equal(planilha.linhas.length, 5, `${formato}: mesmo texto novo de novo`);
  }
});

test('fluxo da lista: a linha mais recente vale mesmo com a aba fora de ordem', () => {
  for (const formato of ['nativo', 'ingles', 'ptbr']) {
    const base = { email: 'ana@empresa.com.br', marketingAceito: true, marketingTextoVersao: 'interesse-marketing-v1', politicaCiente: true };
    const planilha = {
      ...planilhaVazia(COLUNAS_INTERESSE, [
        { ...base, marketingAceito: true, recebidoEm: '2026-10-10T08:00:00.000-03:00' },
        { ...base, marketingAceito: false, recebidoEm: '2026-10-09T08:00:00.000-03:00' },
      ]),
      formato,
    };
    const desmarcou = simular(interesse, { corpo: corpoInteresse({ marketingAceito: false }), planilha });
    assert.equal(planilha.linhas.length, 3, `${formato}: a mais recente é TRUE, então FALSE vira linha nova`);
    assert.deepEqual(respostaDe(desmarcou), [200]);
  }
});

test('fluxo da lista: falha da planilha vira 503 e e-mail inválido vira 422', () => {
  const planilha = planilhaVazia(COLUNAS_INTERESSE);
  planilha.falharGravacao = true;
  const falha = simular(interesse, { corpo: corpoInteresse(), planilha });
  assert.deepEqual(respostaDe(falha), [503]);
  assert.equal(falha.execucaoFalhou, true);
  const invalido = simular(interesse, { corpo: corpoInteresse({ email: 'ruim' }), planilha: planilhaVazia(COLUNAS_INTERESSE) });
  assert.deepEqual(respostaDe(invalido), [422]);
  assert.deepEqual(invalido.respostas[0].corpo.campos, ['email']);
  const lendo = planilhaVazia(COLUNAS_INTERESSE);
  lendo.leituraSimulada = () => [{ foo: 'bar' }];
  const estranha = simular(interesse, { corpo: corpoInteresse(), planilha: lendo });
  assert.deepEqual(respostaDe(estranha), [503]);
  assert.equal(lendo.linhas.length, 0);
});

// ================= Contrato real do site =================
test('o que o site monta é aceito pelo servidor: lead nos três canais e lista de interesse', () => {
  const casos = [
    dadosDoSite(),
    dadosDoSite({ canalRetorno: 'email', telefone: '', email: ' Ana@Empresa.com ' }),
    dadosDoSite({ canalRetorno: 'ligacao', telefone: '+55 (34) 3333-4444', email: 'ana@x.com' }),
    dadosDoSite({ marketingAceito: true, mensagem: '' }),
  ];
  for (const dados of casos) {
    assert.equal(validarContato(dados).valido, true, 'o caso de teste precisa ser válido para o site');
    const corpo = montarLead(dados, rotulosDoSite, ctxDoSite());
    const r = rodarCode(lead, requisicao(corpo));
    assert.equal(r.decisao, 'gravar', JSON.stringify(r.campos));
    assert.deepEqual(r.chavesDesconhecidas, [], 'o site manda chave que o servidor não conhece');
    assert.equal(r.linha.pagina, '/contato/');
    assert.equal(r.linha.marketingAceito, dados.marketingAceito);
    assert.equal(r.linha.politicaVersao, POLITICA_VERSAO);
    assert.equal(r.linha.cienciaTextoVersao, TEXTO_CIENCIA.contato);
    assert.equal(r.linha.marketingTextoVersao, TEXTO_MARKETING.contato);
    assert.equal(r.linha.primeiraFonte, 'google/cpc');
  }
  const dadosLista = { email: ' Ana@Empresa.com ', politicaCiente: true, marketingAceito: true, website: '' };
  assert.equal(validarInteresse(dadosLista).valido, true);
  const corpoLista = montarInteresse(dadosLista, ctxDoSite({ pagina: '/plataforma/', cienciaTextoVersao: TEXTO_CIENCIA.interesse, marketingTextoVersao: TEXTO_MARKETING.interesse }));
  const lista = rodarCode(interesse, requisicao(corpoLista));
  assert.equal(lista.decisao, 'gravar', JSON.stringify(lista.campos));
  assert.deepEqual(lista.chavesDesconhecidas, []);
  assert.equal(lista.linha.email, 'ana@empresa.com');
  assert.equal(lista.linha.marketingTextoVersao, TEXTO_MARKETING.interesse);
  assert.equal(lista.linha.cienciaTextoVersao, TEXTO_CIENCIA.interesse);
});

test('o plano B do idEnvio do navegador (sem crypto.randomUUID) é aceito', () => {
  const planoB = `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const corpo = montarLead(dadosDoSite(), rotulosDoSite, ctxDoSite({ idEnvio: planoB }));
  assert.equal(rodarCode(lead, requisicao(corpo)).decisao, 'gravar');
});

/** Gerador pseudoaleatório com semente, para o ensaio ser repetível. */
function sorteador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('paridade de e-mail: o servidor aceita exatamente o que o formulário aceita (ensaio com semente fixa)', () => {
  const sorte = sorteador(20261010);
  const alfabeto = ['a', 'b', 'c', '1', '.', '@', '+', '-', '_', ' ', "'", ';', ',', '"', '<', '>', '\\', 'é', 'ç', '=', '!', 'X'];
  const casosFixos = ['ana@x.com;', 'a@b.c', 'a@b..c', 'a@.c', 'a@b.', '@b.c', 'ana@x', 'a b@c.com', ' ana@x.com ', 'ANA@X.COM', "o'brien@x.com",
    'a+b@x.com', 'joão@empresa.com.br', 'a@b@c.com', 'a@b.c,d@e.f', '"a b"@x.com', 'ana@x.com\\', 'x@y.z', '=1+1@x.co', '-a@b.cc'];
  const candidatos = [...casosFixos];
  for (let i = 0; i < 2500; i++) {
    const tamanho = 1 + Math.floor(sorte() * 14);
    let e = '';
    for (let j = 0; j < tamanho; j++) e += alfabeto[Math.floor(sorte() * alfabeto.length)];
    candidatos.push(e);
  }
  let aceitos = 0;
  for (const email of candidatos) {
    const dados = dadosDoSite({ canalRetorno: 'email', telefone: '', email });
    const noSite = validarContato(dados).valido;
    const corpo = montarLead(dados, rotulosDoSite, ctxDoSite());
    const r = rodarCode(lead, requisicao(corpo));
    assert.equal(r.decisao === 'gravar', noSite, `e-mail ${JSON.stringify(email)}: site ${noSite}, servidor ${r.decisao}`);
    assert.equal(validarEmail(email), noSite);
    if (noSite) aceitos += 1;
  }
  assert.ok(aceitos > 30, `o ensaio precisa exercitar os dois lados (${aceitos} aceitos)`);
  assert.ok(candidatos.length - aceitos > 30);
  // Mesma regra na lista de interesse.
  for (const email of candidatos.slice(0, 600)) {
    const dados = { email, politicaCiente: true, marketingAceito: false, website: '' };
    const noSite = validarInteresse(dados).valido;
    const r = rodarCode(interesse, requisicao(montarInteresse(dados, ctxDoSite({ pagina: '/plataforma/', cienciaTextoVersao: TEXTO_CIENCIA.interesse, marketingTextoVersao: TEXTO_MARKETING.interesse }))));
    assert.equal(r.decisao === 'gravar', noSite, `lista, e-mail ${JSON.stringify(email)}`);
  }
});

test('paridade de telefone: o servidor aceita exatamente o que o formulário aceita (ensaio com semente fixa)', () => {
  const sorte = sorteador(20261011);
  const alfabeto = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '9', '9', ' ', '(', ')', '-', '+', '.', 'a'];
  const candidatos = ['', '+55 (34) 99177-5784', '991775784', '3433334444', '55349917757841', '(34) 3333-4444', '34 9 9177 5784', 'abcdefghij'];
  for (let i = 0; i < 2500; i++) {
    const tamanho = Math.floor(sorte() * 19);
    let t = '';
    for (let j = 0; j < tamanho; j++) t += alfabeto[Math.floor(sorte() * alfabeto.length)];
    candidatos.push(t);
  }
  let aceitos = 0;
  for (const telefone of candidatos) {
    const dados = dadosDoSite({ telefone });
    const noSite = validarContato(dados).valido;
    const corpo = montarLead(dados, rotulosDoSite, ctxDoSite());
    const r = rodarCode(lead, requisicao(corpo));
    assert.equal(r.decisao === 'gravar', noSite, `telefone ${JSON.stringify(telefone)}: site ${noSite}, servidor ${r.decisao}`);
    assert.equal(validarTelefone(telefone), noSite);
    if (noSite) aceitos += 1;
  }
  assert.ok(aceitos > 30 && candidatos.length - aceitos > 30);
});

// ================= Documento =================
test('documento do n8n: existe, cita todas as colunas, os dois paths e cada pendência', () => {
  const doc = lerTexto(ARQUIVO_DOC);
  assert.equal(TRAVESSAO.test(doc), false, 'travessão no documento');
  for (const coluna of new Set([...COLUNAS_LEAD, ...COLUNAS_INTERESSE])) {
    assert.ok(doc.includes(`\`${coluna}\``), `o documento não cita a coluna ${coluna}`);
  }
  for (const chave of new Set([...CONTRATO_LEAD, ...CONTRATO_INTERESSE])) {
    assert.ok(doc.includes(`\`${chave}\``), `o documento não cita a chave ${chave}`);
  }
  for (const trecho of ['waveops-lead-v2', 'waveops-interesse', 'lista_interesse', '__DEFINIR__', 'Access-Control-Allow-Origin', '429']) {
    assert.ok(doc.includes(trecho), `o documento não cita ${trecho}`);
  }
  assert.equal(/[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9-]+\.[A-Za-z]{2,}/i.test(doc), false, 'e-mail real no documento');
});

test('documento do n8n: os cabeçalhos para colar na planilha são exatamente as colunas do JSON', () => {
  const doc = lerTexto(ARQUIVO_DOC);
  const blocos = [...doc.matchAll(/```\n([\s\S]*?)\n```/g)]
    .map((m) => m[1].split('\n'))
    .filter((linhas) => linhas.length > 5 && linhas.every((linha) => /^[A-Za-z_]+$/.test(linha)));
  assert.equal(blocos.length, 2, 'dois blocos de cabeçalho: leads (16 novas) e lista (23)');
  assert.deepEqual(blocos[0], COLUNAS_NOVAS_LEAD);
  assert.deepEqual(blocos[1], COLUNAS_INTERESSE);
});
