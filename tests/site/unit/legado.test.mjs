// Âncoras da página única antiga: o servidor não vê o #, então a Home redireciona no navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoLegado } from '../../../assets/site/lib/legado.js';

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

test('âncora que existe na Home nova, vazia ou desconhecida não redireciona', () => {
  assert.equal(destinoLegado('#solucoes'), null);
  assert.equal(destinoLegado(''), null);
  assert.equal(destinoLegado('#'), null);
  assert.equal(destinoLegado('#qualquer'), null);
  assert.equal(destinoLegado('#prova'), null);
});
