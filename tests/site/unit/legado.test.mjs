// Âncoras da página única antiga: o servidor não vê o #, então a Home redireciona no navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { destinoLegado } from '../../../assets/site/lib/legado.js';

// Chaves lidas do próprio mapa: âncora nova no legado.js entra na conferência de destino.
const ANTIGAS = [...readFileSync(new URL('../../../assets/site/lib/legado.js', import.meta.url), 'utf8').matchAll(/'(#[a-z-]+)':/g)].map((m) => m[1]);

test('âncoras antigas apontam para o destino novo', () => {
  assert.equal(destinoLegado('#contato'), '/contato/');
  assert.equal(destinoLegado('#pacotes'), '/projetos-sob-medida/#modelos');
  assert.equal(destinoLegado('#servicos'), '/solucoes/');
  assert.equal(destinoLegado('#casos'), '/demonstracoes-tecnicas/');
  assert.equal(destinoLegado('#como'), '/projetos-sob-medida/#como-trabalhamos');
  assert.equal(destinoLegado('#faq'), '/projetos-sob-medida/#perguntas');
  assert.equal(destinoLegado('#publicos'), '/solucoes/#publicos');
  assert.equal(destinoLegado('#operacao'), '/plataforma/');
});

test('cada destino existe, com o id da âncora na página', () => {
  // O portal aponta para /#contato e /#pacotes enquanto o site novo não está no ar
  // (portal/tests/unit/links-site.test.ts). Sem o id, o visitante cai no topo da página.
  assert.ok(ANTIGAS.includes('#contato') && ANTIGAS.includes('#pacotes'), `chaves lidas do legado.js: ${ANTIGAS.join(', ')}`);
  for (const antiga of ANTIGAS) {
    const destino = destinoLegado(antiga);
    assert.ok(destino, `${antiga} sem destino`);
    const [caminho, id] = destino.split('#');
    const html = readFileSync(new URL(`../../..${caminho}index.html`, import.meta.url), 'utf8');
    if (id) assert.match(html, new RegExp(`\\sid="${id}"`), `${antiga} leva a ${destino}, mas a página não tem id="${id}"`);
  }
});

test('âncora que existe na Home nova, vazia ou desconhecida não redireciona', () => {
  assert.equal(destinoLegado('#solucoes'), null);
  assert.equal(destinoLegado(''), null);
  assert.equal(destinoLegado('#'), null);
  assert.equal(destinoLegado('#qualquer'), null);
  assert.equal(destinoLegado('#prova'), null);
});
