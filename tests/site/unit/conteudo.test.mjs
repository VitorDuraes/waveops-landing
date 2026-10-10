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
  let conferidas = 0;
  for (const p of paginas) {
    const html = ler(p.arquivo);
    for (const m of html.matchAll(/Assinatura[^<]{0,40}<\/h3>\s*<span class="wo-selo ([^"]+)"/g)) {
      conferidas += 1;
      assert.equal(m[1], 'wo-selo--desenvolvimento', `${p.arquivo}: assinatura com ${m[1]}`);
    }
  }
  assert.ok(conferidas >= 1, 'o teste não achou nenhum selo de assinatura para conferir');
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
