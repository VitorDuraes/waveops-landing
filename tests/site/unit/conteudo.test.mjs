// Guardas de conteúdo: o que o site não pode afirmar. "Não publique funcionalidade
// planejada como disponível" e "não invente cliente, resultado ou preço" (pedido do
// Vitor, 09/10/2026) viram teste, para uma edição futura não reintroduzir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerPaginas } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const paginas = lerPaginas(raiz).paginas.filter((p) => fs.existsSync(path.join(raiz, p.arquivo)));
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

test('nenhum módulo da Plataforma aparece como disponível', { skip: !fs.existsSync(path.join(raiz, 'plataforma/index.html')) }, () => {
  const html = ler('plataforma/index.html');
  const inicio = html.indexOf('id="modulos"');
  assert.ok(inicio > 0, 'seção #modulos não encontrada');
  const secao = html.slice(inicio, html.indexOf('</section>', inicio));
  const iDisponivel = secao.indexOf('wo-selo--disponivel');
  const iDesenvolvimento = secao.indexOf('wo-selo--desenvolvimento');
  const iPlanejado = secao.indexOf('wo-selo--planejado');
  assert.ok(iDisponivel !== -1 && iDisponivel < iDesenvolvimento && iDesenvolvimento < iPlanejado, 'colunas fora da ordem do design');
  const nomes = (trecho) => [...trecho.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1].trim());
  assert.deepEqual(nomes(secao.slice(iDisponivel, iDesenvolvimento)), [], 'coluna Disponível tem de ficar vazia');
  assert.match(secao.slice(iDisponivel, iDesenvolvimento), /Nenhum módulo aberto para contratação ainda\./);
  assert.deepEqual(nomes(secao.slice(iDesenvolvimento, iPlanejado)), ['Painel operacional', 'Automações por modelo', 'Execuções e alertas', 'Integrações', 'Gestão comercial']);
  assert.deepEqual(nomes(secao.slice(iPlanejado)), ['Atendimento', 'Agentes de IA', 'Processos e tarefas', 'Financeiro', 'Marketing', 'Analytics e relatórios']);
});

test('assinatura da plataforma nunca aparece como disponível', () => {
  for (const p of paginas) {
    const html = ler(p.arquivo);
    for (const m of html.matchAll(/Assinatura[^<]{0,40}<\/h3>\s*<span class="wo-selo ([^"]+)"/g)) {
      assert.equal(m[1], 'wo-selo--desenvolvimento', `${p.arquivo}: assinatura com ${m[1]}`);
    }
  }
  // Desde 14/10/2026 a assinatura saiu dos modelos de contratação da Home e de Projetos sob
  // medida, e o laço acima pode não achar nenhum bloco. Ela continua descrita na página da
  // Plataforma e no llms.txt, sempre como em definição: é isso que se confere aqui.
  const plataforma = ler('plataforma/index.html');
  assert.match(plataforma, /<meta name="description" content="[^"]*sem contratação aberta\./);
  assert.match(plataforma, /Assinatura por plano e módulos\. Planos em definição/);
  assert.match(ler('llms.txt'), /A assinatura da plataforma está em desenvolvimento/);
});

test('a Plataforma só aparece no rodapé, fora da própria página', () => {
  // Decisão do Vitor em 14/10/2026: menu, Home e páginas de oferta mostram o que está à venda.
  assert.doesNotMatch(ler('dev/site/parciais/topo.html'), /href="\/plataforma\//, 'menu com link para a Plataforma');
  const rodape = ler('dev/site/parciais/rodape.html');
  for (const destino of ['/plataforma/', '/plataforma/#modulos', '/plataforma/#lista']) {
    assert.ok(rodape.includes(`href="${destino}"`), `rodapé sem ${destino}`);
  }
  for (const p of paginas.filter((x) => x.id !== 'plataforma')) {
    const semRodape = ler(p.arquivo).replace(/<!-- parcial:rodape[\s\S]*?<!-- \/parcial:rodape -->/, '');
    assert.doesNotMatch(semRodape, /href="\/plataforma\//, `${p.arquivo}: link para a Plataforma fora do rodapé`);
  }
});

test('Projetos sob medida apresenta as quatro frentes da base WaveOps', () => {
  const html = ler('projetos-sob-medida/index.html');
  const nomes = [...html.matchAll(/<h3 class="wo-sobmedida-frente__nome">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(nomes, ['Automação de processos', 'Integração de sistemas', 'Sistemas e painéis sob medida', 'Agentes de IA supervisionados']);
});

test('nenhuma página anuncia uma frente retirada em 14/10/2026', () => {
  const retiradas = /Desenvolvimento web|Engenharia de dados|Consultoria de TI|Sistemas empresariais|E-commerce e pagamentos/;
  for (const p of paginas) assert.doesNotMatch(ler(p.arquivo), retiradas, p.arquivo);
  assert.doesNotMatch(ler('llms.txt'), retiradas, 'llms.txt');
});

test('nenhuma página traz preço, placeholder de caso ou afirmação que o refino retirou', () => {
  const proibidos = [
    [/R\$\s?\d/, 'preço'],
    [/\[Nome do cliente\]|\[X\]/, 'placeholder de caso'],
    [/3 a 7 dias/i, 'prazo retirado'],
    [/preço fechado/i, 'afirmação retirada'],
    [/sem fidelidade/i, 'afirmação retirada'],
  ];
  for (const p of paginas) {
    const html = ler(p.arquivo);
    for (const [padrao, motivo] of proibidos) assert.doesNotMatch(html, padrao, `${p.arquivo}: ${motivo}`);
  }
});

test('maquete de interface sempre leva o aviso de ilustração', () => {
  for (const p of paginas) {
    const html = ler(p.arquivo);
    const maquetes = (html.match(/class="[^"]*\bwo-maquete\b/g) ?? []).length;
    const avisos = (html.match(/class="wo-maquete__aviso"/g) ?? []).length;
    assert.ok(avisos >= maquetes, `${p.arquivo}: ${maquetes} maquete(s) e só ${avisos} aviso(s)`);
  }
});
