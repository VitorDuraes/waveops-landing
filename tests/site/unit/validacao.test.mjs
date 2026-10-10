// Regras de validação dos formulários de contato e de lista de interesse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  soDigitos,
  validarTelefone,
  validarEmail,
  normalizarEmail,
  validarContato,
  validarInteresse,
  resumoErros,
  MENSAGENS_CONTATO,
} from '../../../assets/site/lib/validacao.js';

/** @returns {import('../../../assets/site/lib/validacao.js').DadosContato} */
const contato = (extra = {}) => ({
  nome: 'Ana Souza',
  empresa: '',
  canalRetorno: 'whatsapp',
  telefone: '(34) 99177-5784',
  email: '',
  mensagem: '',
  politicaCiente: true,
  marketingAceito: false,
  website: '',
  ...extra,
});

test('telefone colado com +55, espaço e traço vale; 9 dígitos não vale', () => {
  assert.equal(soDigitos('+55 (34) 99177-5784'), '5534991775784');
  assert.equal(validarTelefone('+55 (34) 99177-5784'), true);
  assert.equal(validarTelefone('34 3333-4444'), true);
  assert.equal(validarTelefone('99177-578'), false);
  assert.equal(validarTelefone('12345678901234'), false);
});

test('e-mail com maiúscula e espaço nas pontas normaliza e vale', () => {
  assert.equal(normalizarEmail('  Ana@Empresa.com.BR '), 'ana@empresa.com.br');
  assert.equal(validarEmail('  Ana@Empresa.com.BR '), true);
  assert.equal(validarEmail('ana@empresa'), false);
  assert.equal(validarEmail('ana empresa@x.com'), false);
  assert.equal(validarEmail('@x.com'), false);
  assert.equal(validarEmail('ana@@x.com'), false);
});

test('contato válido pelo WhatsApp passa sem e-mail', () => {
  assert.deepEqual(validarContato(contato()), { valido: true, erros: {} });
});

test('canal E-mail exige e-mail e dispensa telefone', () => {
  const r = validarContato(contato({ canalRetorno: 'email', telefone: '' }));
  assert.equal(r.valido, false);
  assert.deepEqual(Object.keys(r.erros), ['email']);
  assert.equal(validarContato(contato({ canalRetorno: 'email', telefone: '', email: 'ana@x.com' })).valido, true);
});

test('canal Ligação exige telefone', () => {
  const r = validarContato(contato({ canalRetorno: 'ligacao', telefone: '' }));
  assert.deepEqual(r.erros, { telefone: MENSAGENS_CONTATO.telefone });
});

test('contato opcional preenchido errado também acusa', () => {
  assert.deepEqual(Object.keys(validarContato(contato({ email: 'ana@' })).erros), ['email']);
  assert.deepEqual(Object.keys(validarContato(contato({ canalRetorno: 'email', email: 'a@b.co', telefone: '123' })).erros), ['telefone']);
});

test('formulário vazio acusa nome, telefone e ciência da política', () => {
  const r = validarContato(contato({ nome: ' ', telefone: '', politicaCiente: false }));
  assert.deepEqual(Object.keys(r.erros).sort(), ['nome', 'politicaCiente', 'telefone']);
  assert.equal(resumoErros(Object.keys(r.erros).length), 'Faltam 3 campos para enviar.');
  assert.equal(resumoErros(1), 'Falta 1 campo para enviar.');
});

test('lista de interesse pede e-mail válido e ciência; marketing é opcional', () => {
  assert.equal(validarInteresse({ email: 'ana@x.com', politicaCiente: true, marketingAceito: false, website: '' }).valido, true);
  const r = validarInteresse({ email: 'ana', politicaCiente: false, marketingAceito: true, website: '' });
  assert.deepEqual(Object.keys(r.erros).sort(), ['email', 'politicaCiente']);
});
