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

test('nenhuma página nem o llms.txt falam em quatro frentes', () => {
  for (const p of paginas) assert.doesNotMatch(ler(p.arquivo), /quatro frentes/i, p.arquivo);
  const llms = ler('llms.txt');
  assert.doesNotMatch(llms, /quatro frentes/i);
  assert.match(llms, /automação de atendimento, agentes de IA, painéis de gestão, CRMs sob medida e apps e sistemas/i);
});

test('o JSON-LD da Home traz a cidade', () => {
  const json = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(ler('index.html'))[1]);
  const empresa = json['@graph'].find((item) => item['@type'] === 'Organization');
  assert.deepEqual(empresa.address, { '@type': 'PostalAddress', addressLocality: 'Uberlândia', addressRegion: 'MG', addressCountry: 'BR' });
  assert.ok(!JSON.stringify(empresa).includes('streetAddress'));
});

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

test('Projetos sob medida apresenta as cinco frentes da base WaveOps', () => {
  const html = ler('projetos-sob-medida/index.html');
  const nomes = [...html.matchAll(/<h3 class="wo-sobmedida-frente__nome">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(nomes, ['Automação de atendimento', 'Agentes de IA', 'Painéis de gestão', 'CRMs sob medida', 'Apps e sistemas']);
});

test('as âncoras das frentes existem, as novas e as de antes de 15/10/2026', () => {
  const html = ler('projetos-sob-medida/index.html');
  const secao = html.slice(html.indexOf('id="frentes"'));
  for (const id of ['atendimento', 'agentes', 'dashboards', 'crms', 'saas', 'automacoes', 'integracoes', 'sistemas']) {
    assert.ok(secao.includes(`id="${id}"`), `#${id} fora da seção #frentes`);
  }
  for (const antiga of ['automacoes', 'integracoes', 'sistemas']) {
    assert.ok(secao.indexOf(`id="${antiga}"`) < secao.indexOf('id="atendimento"'), `#${antiga} tem de cair no topo da seção`);
  }
});

test('o rodapé leva às cinco frentes', () => {
  const rodape = ler('dev/site/parciais/rodape.html');
  const destinos = [...rodape.matchAll(/href="\/projetos-sob-medida\/#([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(destinos, ['atendimento', 'agentes', 'dashboards', 'crms', 'saas']);
  const nomes = [...rodape.matchAll(/href="\/projetos-sob-medida\/#[a-z]+">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(nomes, ['Automação de atendimento', 'Agentes de IA', 'Painéis de gestão', 'CRMs sob medida', 'Apps e sistemas']);
});

test('as perguntas do HTML e do JSON-LD batem, com a do freelancer por último', () => {
  const html = ler('projetos-sob-medida/index.html');
  const inicio = html.indexOf('id="perguntas"');
  assert.ok(inicio > 0, 'seção #perguntas não encontrada');
  const secao = html.slice(inicio, html.indexOf('</section>', inicio));
  const texto = (trecho) => trecho.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const resumos = [...secao.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => texto(m[1]));
  const respostas = [...secao.matchAll(/<p class="wo-sobmedida-faq__resposta">([\s\S]*?)<\/p>/g)].map((m) => texto(m[1]));
  const json = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  const faq = json['@graph'].find((item) => item['@type'] === 'FAQPage').mainEntity;
  assert.equal(faq.length, 7, 'o FAQPage tem 7 perguntas');
  assert.deepEqual(resumos, faq.map((q) => q.name), 'perguntas do HTML e do JSON-LD, na mesma ordem');
  assert.deepEqual(respostas, faq.map((q) => q.acceptedAnswer.text), 'respostas do HTML e do JSON-LD, na mesma ordem');
  const ultima = faq[faq.length - 1];
  assert.equal(ultima.name, 'Qual a diferença para contratar um freelancer?');
  assert.equal(
    ultima.acceptedAnswer.text,
    'Você contrata uma empresa, com CNPJ, proposta por escrito e contrato. O escopo é aprovado por você antes de começar, e cada entrega é documentada. Com serviços gerenciados, a WaveOps continua cuidando do que está no ar: operação, monitoramento e evolução.',
  );
});

test('a descrição de Projetos sob medida é a de 8.3 na meta, no og e no twitter', () => {
  const html = ler('projetos-sob-medida/index.html');
  const esperada = 'Automação de atendimento, agentes de IA com revisão humana, painéis de gestão, CRMs sob medida e apps. Escopo escrito antes de começar.';
  for (const chave of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
    const meta = new RegExp(`<meta ${chave} content="([^"]*)"`).exec(html);
    assert.ok(meta, `meta ${chave} não encontrada`);
    assert.equal(meta[1], esperada, `meta ${chave}`);
  }
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

// A página sem o miolo dos parciais carimbados.
const semParciais = (html) => html.replace(/<!--\s*parcial:([a-z0-9-]+)[^>]*-->[\s\S]*?<!--\s*\/parcial:\1\s*-->/g, '');
// A tag de abertura de cada <section> que a página escreve, pela ordem.
const secoes = (html) => [...semParciais(html).matchAll(/<section\b[^>]*>/g)].map((m) => m[0]);

test('toda página tem o fundo vivo como primeiro filho do <main> (spec 15.1)', () => {
  for (const p of paginas) {
    assert.match(ler(p.arquivo), /<main\b[^>]*>\s*<!-- parcial:fundo -->\s*<div class="wo-fundo" aria-hidden="true">/, `${p.arquivo}: o <main> não começa pelo parcial do fundo`);
  }
});

test('o parcial do fundo traz o pôster e o vídeo de 6.3, escondidos do leitor de tela', () => {
  const parcial = ler('dev/site/parciais/fundo.html');
  assert.match(parcial, /^<div class="wo-fundo" aria-hidden="true">/);
  const imagem = /<img\b[^>]*>/.exec(parcial)?.[0] ?? '';
  assert.match(imagem, /class="wo-fundo__poster"/);
  assert.match(imagem, /\salt=""/);
  assert.match(imagem, /\sfetchpriority="high"/);
  const video = /<video\b[^>]*>/.exec(parcial)?.[0] ?? '';
  for (const atributo of ['muted', 'playsinline', 'loop', 'preload="none"', 'data-fundo-video']) {
    assert.ok(video.includes(` ${atributo}`), `o <video> do fundo sem ${atributo}`);
  }
  assert.doesNotMatch(video, /\s(src|autoplay)\b/, 'o vídeo nasce sem fonte e sem autoplay: a fonte só entra depois do load');
});

test('o botão de pausa do fundo mora no topo, com nome fixo, aria-pressed e hidden', () => {
  const topo = ler('dev/site/parciais/topo.html');
  const botao = /<button\b[^>]*data-fundo-pausa[^>]*>/.exec(topo)?.[0] ?? '';
  assert.ok(botao, 'o topo não tem o botão de pausa do fundo');
  assert.match(botao, /\stype="button"/);
  assert.match(botao, /\saria-label="Pausar animação do fundo"/);
  assert.match(botao, /\saria-pressed="false"/);
  assert.match(botao, /\shidden(?=[\s>])/, 'o botão nasce escondido: só aparece quando o vídeo pode tocar');
  for (const p of paginas) assert.doesNotMatch(semParciais(ler(p.arquivo)), /data-video-pausa|data-fundo-pausa/, `${p.arquivo}: pausa fora do topo`);
});

test('o topo fica sempre escuro: a troca por data-faixa-escura saiu (spec 15.2)', () => {
  for (const nome of ['topo', 'cta-final', 'rodape']) assert.doesNotMatch(ler(`dev/site/parciais/${nome}.html`), /data-faixa-escura|data-estado=/, `parcial ${nome}`);
  for (const p of paginas) assert.doesNotMatch(ler(p.arquivo), /data-faixa-escura/, p.arquivo);
});

test('a chamada final e o rodapé ficam sob o véu forte, sobre o fundo vivo', () => {
  for (const [nome, tag] of [['cta-final', 'section'], ['rodape', 'footer']]) {
    const abertura = new RegExp(`^<${tag}\\b[^>]*>`).exec(ler(`dev/site/parciais/${nome}.html`))?.[0] ?? '';
    assert.match(abertura, /\bwo-veu-forte\b/, `${nome}: "Noite" vira o véu forte`);
    assert.doesNotMatch(abertura, /\bwo-noite\b/, `${nome}: o fundo opaco cobriria a onda`);
  }
});

test('a folha creme saiu e o escuro não depende de classe (spec 15.2 e 15.4)', () => {
  for (const p of paginas) {
    const classes = [...ler(p.arquivo).matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
    assert.deepEqual(classes.filter((c) => ['wo-folha', 'wo-home-folha', 'wo-noite'].includes(c)), [], p.arquivo);
  }
});

// Mapa da spec 15.2 sobre as tabelas de 7.1 e 7.3: hero transparente; "Papel" vira o véu e
// "Papel 2" o véu forte. Na Plataforma (7.4) as seis seções depois da abertura alternam papel e
// papel 2, começando pelo papel.
const VEUS = {
  'index.html': [null, null, 'wo-veu', 'wo-veu-forte', 'wo-veu', 'wo-veu-forte'],
  'projetos-sob-medida/index.html': [null, 'wo-veu-forte', 'wo-veu', 'wo-veu-forte', 'wo-veu'],
  'plataforma/index.html': [null, 'wo-veu', 'wo-veu-forte', 'wo-veu', 'wo-veu-forte', 'wo-veu', 'wo-veu-forte'],
};
for (const [arquivo, esperados] of Object.entries(VEUS)) {
  test(`${arquivo}: o hero é transparente e as seções seguem o mapa de véus`, () => {
    const lidas = secoes(ler(arquivo)).map((tag) => /\bwo-veu-forte\b/.test(tag) ? 'wo-veu-forte' : /\bwo-veu\b/.test(tag) ? 'wo-veu' : null);
    assert.deepEqual(lidas, esperados);
  });
}

// A ordem da cascata é a da lista de 15.3 (etiquetas, selo, título, frase, botões, nota e cartão),
// não a do HTML: na Home a frase fica no alto à direita e entra depois do título.
test('toda página entra em cascata: os blocos do hero numerados de 0 em diante, sem buraco', () => {
  for (const p of paginas) {
    const html = semParciais(ler(p.arquivo));
    const inicioHero = html.search(/<section\b/);
    const fimHero = html.indexOf('</section>', inicioHero);
    const numeros = [...html.matchAll(/\sdata-entrada="(\d+)"/g)].map((m) => ({ n: Number(m[1]), i: m.index ?? 0 }));
    assert.ok(numeros.length >= 3, `${p.arquivo}: ${numeros.length} blocos com data-entrada`);
    assert.ok(numeros.every(({ i }) => i > inicioHero && i < fimHero), `${p.arquivo}: data-entrada fora do hero`);
    assert.deepEqual(numeros.map(({ n }) => n).sort((a, b) => a - b), numeros.map((_, k) => k), `${p.arquivo}: numeração repetida ou com buraco`);
  }
});

test('na Home a cascata segue a lista de 15.3', () => {
  const html = ler('index.html');
  // O primeiro elemento da página com cada atributo: todos estão no hero.
  const ordem = [
    ['class="wo-home-hero__etiquetas', 0], ['class="wo-etiqueta-hero"', 1], ['id="home-titulo"', 2], ['class="wo-home-hero__frase"', 3],
    ['class="wo-acoes"', 4], ['class="wo-nota-mono', 5], ['class="wo-home-hero__visual"', 6],
  ];
  for (const [gancho, n] of ordem) {
    const tag = new RegExp(`<[a-z0-9]+\\s[^>]*${gancho}[^>]*>`).exec(html)?.[0] ?? '';
    assert.match(tag, new RegExp(`\\sdata-entrada="${n}"`), `${gancho} entra na posição ${n}`);
  }
});

// Na Plataforma o formulário de interesse é o cartão do hero (7.4): entra como cartão, depois do
// título e da frase, e o workspace de exemplo entra por último.
test('na Plataforma a cascata segue a lista de 15.3, com o formulário como cartão', () => {
  const html = semParciais(ler('plataforma/index.html'));
  const ordem = [
    ['class="wo-etiqueta-hero"', 0], ['class="wo-plataforma-abertura__situacao"', 1], ['id="plataforma-titulo"', 2],
    ['class="wo-abertura__lead"', 3], ['class="wo-cartao-noite wo-plataforma-interesse"', 4], ['class="wo-plataforma-abertura__workspace"', 5],
  ];
  for (const [gancho, n] of ordem) {
    const tag = new RegExp(`<[a-z0-9]+\\s[^>]*${gancho}[^>]*>`).exec(html)?.[0] ?? '';
    assert.match(tag, new RegExp(`\\sdata-entrada="${n}"`), `${gancho} entra na posição ${n}`);
  }
  // O parcial do formulário fica dentro do cartão que entra em cascata.
  const pagina = ler('plataforma/index.html');
  const cartao = pagina.indexOf('class="wo-cartao-noite wo-plataforma-interesse"');
  assert.ok(cartao > 0 && cartao < pagina.indexOf('<!-- parcial:form-interesse -->'), 'o formulário fica dentro do cartão noite');
  assert.ok(pagina.indexOf('<!-- /parcial:form-interesse -->') < pagina.indexOf('class="wo-plataforma-abertura__workspace"'), 'o cartão fecha antes do workspace');
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

test('a chamada final mostra quem responde, sem repetir a promessa do prazo', () => {
  const parcial = ler('dev/site/parciais/cta-final.html');
  for (const texto of ['Vitor Duraes', 'Fundador da WaveOps', 'Primeira conversa sem custo e sem compromisso.', 'Resposta em até 1 dia útil']) {
    assert.ok(parcial.includes(texto), `cta-final sem "${texto}"`);
  }
  // Cada promessa aparece uma vez: o prazo nas garantias da esquerda e a primeira conversa no cartão.
  const cartao = parcial.slice(parcial.indexOf('wo-cartao-noite'));
  assert.equal(parcial.split('Resposta em até 1 dia útil').length - 1, 1, 'o prazo aparece uma vez só');
  assert.ok(!cartao.includes('Resposta em até 1 dia útil'), 'o cartão de quem responde não repete o prazo');
  assert.ok(cartao.includes('Primeira conversa sem custo e sem compromisso.'), 'o cartão traz a primeira conversa');
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

test('Soluções indica as cinco frentes em Como contratar (spec 8.5)', () => {
  const html = ler('solucoes/index.html');
  const esperado = {
    vender: [['atendimento', 'Automação de atendimento'], ['crms', 'CRMs sob medida'], ['dashboards', 'Painéis de gestão']],
    atender: [['atendimento', 'Automação de atendimento'], ['agentes', 'Agentes de IA']],
    operar: [['crms', 'CRMs sob medida'], ['saas', 'Apps e sistemas'], ['agentes', 'Agentes de IA']],
    decidir: [['dashboards', 'Painéis de gestão'], ['crms', 'CRMs sob medida']],
    crescer: [['saas', 'Apps e sistemas'], ['dashboards', 'Painéis de gestão']],
  };
  for (const [id, frentes] of Object.entries(esperado)) {
    const bloco = new RegExp(`<dd\\b[^>]*id="${id}-contratar"[^>]*>([\\s\\S]*?)</dd>`).exec(html)?.[1];
    assert.ok(bloco, `dd#${id}-contratar não encontrado`);
    const links = [...bloco.matchAll(/href="\/projetos-sob-medida\/#(atendimento|agentes|dashboards|crms|saas)"[^>]*>([^<]+)</g)];
    assert.deepEqual(links.map((m) => [m[1], m[2]]), frentes, id);
  }
});

test('o rodapé traz a cidade', () => {
  assert.ok(ler('dev/site/parciais/rodape.html').includes('Uberlândia, MG'));
});
