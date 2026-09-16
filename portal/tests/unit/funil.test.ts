import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calcularId, diaUtc } from "../../src/lib/funil";
import { normalizarEvento, ETAPAS, EVENTOS } from "../../src/lib/funil";

// Testes das funcoes puras da medicao de funil (SPEC-18). Rodam sem banco e sem
// servidor: `npm run test:unit`. O que depende de Postgres e coberto pelos
// criterios de aceite da spec, nao aqui.

describe("idDoVisitante: hash diario", () => {
  const SAL = "sal-de-teste-com-tamanho-suficiente-aqui";

  test("mesma pessoa, mesmo dia, mesmo id", () => {
    const a = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    const b = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    assert.equal(a, b);
  });

  test("mesma pessoa em dominios diferentes cai no mesmo id (o sal e o mesmo)", () => {
    // O id nao depende do host: e o que faz o funil atravessar a landing e o portal.
    const landing = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    const portal = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    assert.equal(landing, portal);
  });

  test("o id muda quando o dia vira", () => {
    const hoje = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    const amanha = calcularId("2026-09-17", "203.0.113.7", "Mozilla/5.0", SAL);
    assert.notEqual(hoje, amanha);
  });

  test("user-agent diferente gera id diferente", () => {
    const a = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    const b = calcularId("2026-09-16", "203.0.113.7", "Safari/17", SAL);
    assert.notEqual(a, b);
  });

  test("ip diferente gera id diferente", () => {
    const a = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    const b = calcularId("2026-09-16", "198.51.100.2", "Mozilla/5.0", SAL);
    assert.notEqual(a, b);
  });

  test("o id tem 32 hex e nao carrega o ip em texto", () => {
    const id = calcularId("2026-09-16", "203.0.113.7", "Mozilla/5.0", SAL);
    assert.match(id, /^[0-9a-f]{32}$/);
    assert.ok(!id.includes("203"));
  });

  test("diaUtc devolve YYYY-MM-DD", () => {
    assert.equal(diaUtc(new Date("2026-09-16T23:59:59Z")), "2026-09-16");
    assert.equal(diaUtc(new Date("2026-09-17T00:00:01Z")), "2026-09-17");
  });
});

describe("normalizarEvento: o que entra na tabela", () => {
  test("evento minimo valido passa", () => {
    const ev = normalizarEvento({ n: "visita", u: "/" });
    assert.equal(ev?.nome, "visita");
    assert.equal(ev?.path, "/");
    assert.equal(ev?.props, null);
  });

  test("nome fora da lista fechada e recusado", () => {
    assert.equal(normalizarEvento({ n: "evento_inventado" }), null);
    assert.equal(normalizarEvento({ n: "" }), null);
    assert.equal(normalizarEvento({}), null);
    assert.equal(normalizarEvento(null), null);
    assert.equal(normalizarEvento("visita"), null);
    assert.equal(normalizarEvento([{ n: "visita" }]), null);
  });

  test("querystring some do path (pode carregar dado pessoal)", () => {
    const ev = normalizarEvento({ n: "visita", u: "/contato?email=joao@empresa.com.br" });
    assert.equal(ev?.path, "/contato");
  });

  test("path que nao comeca com barra e descartado, o evento sobrevive", () => {
    const ev = normalizarEvento({ n: "visita", u: "https://outro.site/x" });
    assert.equal(ev?.nome, "visita");
    assert.equal(ev?.path, null);
  });

  test("do referrer sobra so o host", () => {
    assert.equal(normalizarEvento({ n: "visita", r: "https://www.google.com/search?q=waveops" })?.referrerHost, "www.google.com");
    assert.equal(normalizarEvento({ n: "visita", r: "lixo com espaco" })?.referrerHost, null);
  });

  test("props: no maximo 5 chaves", () => {
    const ev = normalizarEvento({ n: "visita", p: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 } });
    assert.equal(Object.keys(ev?.props || {}).length, 5);
  });

  test("props: valor longo e cortado em 64", () => {
    const ev = normalizarEvento({ n: "lead_enviado", p: { dor: "x".repeat(500) } });
    assert.equal(ev?.props?.dor.length, 64);
  });

  test("props: chave fora do padrao e valor aninhado sao descartados", () => {
    const ev = normalizarEvento({ n: "visita", p: { "chave invalida": "a", ok: "b", aninhado: { x: 1 }, nulo: null } });
    assert.deepEqual(ev?.props, { ok: "b" });
  });

  test("props: numero e booleano viram string", () => {
    const ev = normalizarEvento({ n: "visita", p: { qtd: 3, ativo: true } });
    assert.deepEqual(ev?.props, { qtd: "3", ativo: "true" });
  });
});

describe("etapas do funil", () => {
  test("toda etapa e um evento conhecido", () => {
    for (const etapa of ETAPAS) assert.ok(EVENTOS.includes(etapa), `${etapa} fora da lista`);
  });

  test("a ordem comeca em visita e termina em ativacao", () => {
    assert.equal(ETAPAS[0], "visita");
    assert.equal(ETAPAS[ETAPAS.length - 1], "ativacao");
  });
});
