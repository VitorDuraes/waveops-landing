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

test('toda página marca a primeira faixa escura, que decide o estado do topo', () => {
  for (const p of paginas) {
    assert.match(ler(p.arquivo), /\sdata-faixa-escura(?=[\s>])/, `${p.arquivo}: sem data-faixa-escura`);
  }
});

test('botão flutuante de WhatsApp em toda página menos Contato', () => {
  for (const p of paginas) {
    const tem = ler(p.arquivo).includes('<!-- parcial:whatsapp-flutuante');
    assert.equal(tem, p.id !== 'contato', `${p.arquivo}: ${p.id === 'contato' ? 'Contato já tem o canal e o formulário' : 'falta o marcador do botão flutuante'}`);
  }
});

test('o parcial do botão flutuante tem o link do site, o nome acessível e o gancho do funil', () => {
  const parcial = ler('dev/site/parciais/whatsapp-flutuante.html');
  assert.match(parcial, /class="wo-whatsapp-flutuante"/);
  assert.ok(parcial.includes('href="https://wa.me/5534991775784?text=Ol%C3%A1%2C%20WaveOps.%20Vim%20pelo%20site."'));
  assert.match(parcial, /data-whatsapp="flutuante"/);
  assert.match(parcial, /aria-label="Falar no WhatsApp"/);
  assert.match(parcial, /<svg[^>]*aria-hidden="true"/, 'o ícone é decorativo');
});

test('a logo é a plana de antes do selo 3D', () => {
  for (const p of paginas) assert.doesNotMatch(ler(p.arquivo), /waveops-badge-3d/, p.arquivo);
  for (const nome of ['topo', 'rodape']) {
    const parcial = ler(`dev/site/parciais/${nome}.html`);
    assert.doesNotMatch(parcial, /waveops-badge-3d/, `parcial ${nome}`);
    const selo = /<span class="wo-marca__selo">([\s\S]*?)<\/span>/.exec(parcial);
    assert.ok(selo, `parcial ${nome}: sem wo-marca__selo`);
    assert.match(selo[1], /M18 50 Q 30 33 41 50/, `parcial ${nome}: falta a primeira onda do Sine Nodes`);
    assert.match(selo[1], /M59 50 Q 70 67 82 50/, `parcial ${nome}: falta a segunda onda do Sine Nodes`);
    assert.match(selo[1], /<circle cx="50" cy="50" r="9" fill="none"/, `parcial ${nome}: falta o núcleo vazado do Sine Nodes`);
  }
});

test('a chamada final mostra quem responde', () => {
  const parcial = ler('dev/site/parciais/cta-final.html');
  for (const texto of ['Vitor Duraes', 'Fundador da WaveOps', 'Primeira conversa sem custo e sem compromisso.', 'Resposta em até 1 dia útil.']) {
    assert.ok(parcial.includes(texto), `cta-final sem "${texto}"`);
  }
  // Sem o link real da agenda, a opção não existe: nunca sai link morto ou provisório.
  assert.doesNotMatch(parcial, /calendly|cal\.com|calendar|agendar/i, 'agenda sem link real');
});

test('a chamada final oferece formulário e WhatsApp no cartão escuro', () => {
  const parcial = ler('dev/site/parciais/cta-final.html');
  const texto = parcial.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(parcial, /class="wo-cartao-noite/);
  assert.ok(texto.includes('Como prefere começar?'));
  assert.ok(texto.includes('Contar o problema pelo formulário. Você escolhe como quer o retorno.'));
  assert.ok(texto.includes('Falar agora no WhatsApp.'));
  assert.match(parcial, /href="\/contato\/"/);
  assert.match(parcial, /data-whatsapp="cta-final"/);
  assert.ok(parcial.includes('href="https://wa.me/5534991775784?text=Ol%C3%A1%2C%20WaveOps.%20Quero%20conversar%20sobre%20a%20minha%20opera%C3%A7%C3%A3o."'));
});

test('o rodapé traz a cidade', () => {
  assert.ok(ler('dev/site/parciais/rodape.html').includes('Uberlândia, MG'));
});
