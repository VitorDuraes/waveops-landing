import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calcularId, diaUtc } from "../../src/lib/funil";
import { normalizarEvento, normalizarFonte, ETAPAS, EVENTOS, EVENTOS_DA_LANDING } from "../../src/lib/funil";
import { ehRobo } from "../../src/lib/robo";

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

describe("normalizarFonte: entrada de borda", () => {
  test("UTM composta passa em minuscula", () => {
    assert.equal(normalizarFonte("Instagram/CPC"), "instagram/cpc");
  });

  test("host de referrer passa", () => {
    assert.equal(normalizarFonte("www.google.com"), "www.google.com");
  });

  test("caractere fora do conjunto e removido, nao escapado", () => {
    // A fonte vai para uma coluna que o admin agrupa e exibe. Injecao de marcacao
    // ou de aspas nao pode chegar la, e cortar e mais simples do que escapar.
    // A barra sobrevive porque e separador legitimo de "origem/meio". O que morre e
    // tudo que da poder a string: sinal de marcacao, aspas, ponto e virgula, espaco.
    assert.equal(normalizarFonte('insta<script>alert(1)</script>'), "instascriptalert1/script");
    assert.equal(normalizarFonte("a'b\"c;d"), "abcd");
  });

  test("corta em 64 caracteres", () => {
    assert.equal(normalizarFonte("x".repeat(200))?.length, 64);
  });

  test("vazio, espaco e tipo errado viram null", () => {
    assert.equal(normalizarFonte(""), null);
    assert.equal(normalizarFonte("   "), null);
    assert.equal(normalizarFonte("!!!"), null);
    assert.equal(normalizarFonte(42), null);
    assert.equal(normalizarFonte(undefined), null);
  });

  test("o evento carrega a fonte normalizada", () => {
    const ev = normalizarEvento({ n: "visita", f: "Google.com" });
    assert.equal(ev?.fonte, "google.com");
    assert.equal(normalizarEvento({ n: "visita" })?.fonte, null);
  });
});

describe("ehRobo: quem nao entra na conta", () => {
  test("navegador de verdade passa", () => {
    assert.equal(
      ehRobo("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"),
      false
    );
    assert.equal(ehRobo("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), false);
  });

  test("robo de busca e de IA e barrado", () => {
    // Googlebot executa JavaScript: sem esta barreira ele entra no topo do funil
    // como pessoa, e a taxa de conversao desaba sem ninguem ter desistido de nada.
    assert.equal(ehRobo("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
    assert.equal(ehRobo("Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)"), true);
    assert.equal(ehRobo("Mozilla/5.0 (compatible; AhrefsBot/7.0)"), true);
  });

  test("previa de link de mensageiro e barrada", () => {
    // Um link colado no WhatsApp gera uma busca de previa. Sem filtro, cada link
    // compartilhado viraria uma visita que nunca existiu.
    assert.equal(ehRobo("WhatsApp/2.23.20.0"), true);
    assert.equal(ehRobo("facebookexternalhit/1.1"), true);
  });

  test("ferramenta de linha de comando e barrada", () => {
    assert.equal(ehRobo("curl/8.4.0"), true);
    assert.equal(ehRobo("python-requests/2.31.0"), true);
  });

  test("sem user-agent e tratado como robo", () => {
    // Navegador de verdade sempre manda user-agent. Ausencia e script.
    assert.equal(ehRobo(null), true);
    assert.equal(ehRobo(""), true);
  });
});

describe("eventos da landing", () => {
  test("a lista so tem evento que existe", () => {
    for (const e of EVENTOS_DA_LANDING) assert.ok(EVENTOS.includes(e), `${e} fora da lista fechada`);
  });

  test("etapa que nasce no portal nao esta na lista", () => {
    for (const e of ["checkout_aberto", "checkout_enviado", "pagamento_confirmado", "ativacao"] as const) {
      assert.ok(!EVENTOS_DA_LANDING.includes(e), `${e} nao nasce na landing`);
    }
  });
});
