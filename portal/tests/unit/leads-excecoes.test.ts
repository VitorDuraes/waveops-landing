import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  executarAlteracaoRetencao, executarConsultaRetencao, lerConsultaRetencao,
  lerPedidoRetencao, montarConsultaRetencao, prepararAlteracaoRetencao,
  type RegistroRetencao,
} from "../../src/lib/leads-excecoes";

const AGORA = new Date("2026-10-11T04:17:52.123Z");
const TEXTO = "Negociação em andamento, proposta em revisão.";
const PEDIDO = { acao: "registrar", versao: 0, justificativa: TEXTO, dias: 30 } as const;
const REGISTRO: RegistroRetencao = {
  versao: 1, justificativa: TEXTO, registradaEm: AGORA,
  revisarEm: new Date("2026-11-10T04:17:52.123Z"), por: "admin@example.test",
};
const CONSULTA = {
  calculadaEm: "2026-10-11T04:17:52.123Z", versao: 1,
  excecao: {
    justificativa: TEXTO, registradaEm: "2026-10-11T04:17:52.123Z",
    revisarEm: "2026-11-10T04:17:52.123Z", por: "admin@example.test", estado: "vigente",
  },
};

describe("pedido de exceção: validade e campos controlados pelo servidor", () => {
  test("aceita registro de 30 dias e ignora responsável e datas enviados pelo navegador", () => {
    assert.deepEqual(lerPedidoRetencao({ ...PEDIDO, por: "outro", registradaEm: "1900-01-01", revisarEm: "2099-01-01" }), { ok: true, pedido: PEDIDO });
  });
  test("normaliza espaços externos, quebra de linha e acentos antes de contar caracteres", () => {
    assert.deepEqual(lerPedidoRetencao({ ...PEDIDO, justificativa: "  Negociac\u0327a\u0303o em andamento.\r\nRevisar proposta.  " }), {
      ok: true, pedido: { ...PEDIDO, justificativa: "Negociação em andamento.\nRevisar proposta." },
    });
  });
  test("conta caracteres Unicode, sem recusar 500 caracteres de dois code units", () => {
    assert.equal(lerPedidoRetencao({ ...PEDIDO, justificativa: "𐐀".repeat(500) }).ok, true);
    assert.equal(lerPedidoRetencao({ ...PEDIDO, justificativa: "𐐀".repeat(501) }).ok, false);
  });
  for (const dias of [0, -1, 31, 1.5, "30", null, Infinity]) {
    test(`recusa prazo inválido: ${dias}`, () => assert.equal(lerPedidoRetencao({ ...PEDIDO, dias }).ok, false));
  }
  for (const justificativa of ["curta", "a".repeat(501), TEXTO + "\0", TEXTO + "\u001b", TEXTO + "\ud800", null]) {
    test(`recusa justificativa inválida: ${JSON.stringify(justificativa)}`, () => assert.equal(lerPedidoRetencao({ ...PEDIDO, justificativa }).ok, false));
  }
  for (const versao of [-1, 0.5, "0", null, 2_147_483_647]) {
    test(`recusa versão que não pode ser incrementada: ${versao}`, () => assert.equal(lerPedidoRetencao({ ...PEDIDO, versao }).ok, false));
  }
  test("encerrar exige versão e não reaproveita campos de registro", () => {
    assert.deepEqual(lerPedidoRetencao({ ...PEDIDO, acao: "encerrar", versao: 7 }), { ok: true, pedido: { acao: "encerrar", versao: 7 } });
    assert.equal(lerPedidoRetencao({ acao: "encerrar" }).ok, false);
    assert.equal(lerPedidoRetencao({ ...PEDIDO, acao: "apagar" }).ok, false);
    assert.equal(lerPedidoRetencao(null).ok, false);
  });
});

describe("datas e leitura de uma exceção", () => {
  test("30 dias de 24 horas preservam hora e milissegundos do servidor", () => {
    assert.deepEqual(prepararAlteracaoRetencao(PEDIDO, AGORA), {
      acao: "registrar", versao: 0, justificativa: TEXTO,
      registradaEm: new Date("2026-10-11T04:17:52.123Z"), revisarEm: new Date("2026-11-10T04:17:52.123Z"),
    });
    assert.equal(AGORA.toISOString(), "2026-10-11T04:17:52.123Z");
  });
  test("relógio inválido ou soma além das datas representáveis não gera uma revisão", () => {
    assert.throws(() => prepararAlteracaoRetencao(PEDIDO, new Date(NaN)), RangeError);
    assert.throws(() => prepararAlteracaoRetencao(PEDIDO, new Date("+275760-09-13T00:00:00.000Z")), RangeError);
  });
  test("sem exceção retorna versão zero; encerramento mantém a versão", () => {
    assert.deepEqual(montarConsultaRetencao(null, AGORA), { calculadaEm: "2026-10-11T04:17:52.123Z", versao: 0, excecao: null });
    assert.deepEqual(montarConsultaRetencao({ versao: 6, justificativa: null, registradaEm: null, revisarEm: null, por: null }, AGORA), {
      calculadaEm: "2026-10-11T04:17:52.123Z", versao: 6, excecao: null,
    });
  });
  test("revisão é vigente antes do limite e vencida no instante exato", () => {
    assert.deepEqual(montarConsultaRetencao(REGISTRO, AGORA), CONSULTA);
    assert.equal(montarConsultaRetencao(REGISTRO, new Date("2026-11-10T04:17:52.122Z")).excecao?.estado, "vigente");
    assert.equal(montarConsultaRetencao(REGISTRO, new Date("2026-11-10T04:17:52.123Z")).excecao?.estado, "vencida");
  });
  test("erro de armazenamento nunca parece ausência de exceção", () => {
    for (const mudanca of [
      { por: null }, { versao: 0 }, { justificativa: "curta" },
      { revisarEm: AGORA }, { revisarEm: new Date("2026-11-11T04:17:52.123Z") },
    ]) assert.throws(() => montarConsultaRetencao({ ...REGISTRO, ...mudanca }, AGORA), RangeError);
  });
  test("o painel aceita o contrato e descarta campos extras", () => {
    assert.deepEqual(lerConsultaRetencao({ ...CONSULTA, emailDoLead: "fixture@example.test", excecao: { ...CONSULTA.excecao, segredo: "fixture" } }), CONSULTA);
    assert.deepEqual(lerConsultaRetencao({ calculadaEm: "2026-10-11T04:17:52.123Z", versao: 8, excecao: null }), {
      calculadaEm: "2026-10-11T04:17:52.123Z", versao: 8, excecao: null,
    });
  });
  test("o painel recusa resposta parcial, estado incorreto e datas não canônicas", () => {
    for (const valor of [null, {}, { ...CONSULTA, versao: -1 }, { ...CONSULTA, calculadaEm: "2026-10-11" },
      { ...CONSULTA, excecao: { ...CONSULTA.excecao, estado: "vencida" } },
      { ...CONSULTA, excecao: { ...CONSULTA.excecao, por: undefined } },
      { ...CONSULTA, excecao: { ...CONSULTA.excecao, revisarEm: "2026-11-11T04:17:52.123Z" } },
    ]) assert.equal(lerConsultaRetencao(valor), null);
  });
});

describe("execução: papel, falhas e um único relógio", () => {
  for (const papel of [null, "customer", "outro"]) {
    test(`nega ${papel} sem acessar porta ou relógio`, async () => {
      const agora = () => { throw new Error("relógio proibido"); };
      const consultar = async () => { throw new Error("banco proibido"); };
      const alterar = async () => { throw new Error("escrita proibida"); };
      assert.deepEqual(await executarConsultaRetencao({ papel, agora, consultar }, "lead_fixture"), { ok: false, motivo: "sem_permissao" });
      assert.deepEqual(await executarAlteracaoRetencao({ papel, por: "admin@example.test", agora, alterar }, "lead_fixture", PEDIDO), { ok: false, motivo: "sem_permissao" });
    });
  }
  test("banco ausente é indisponibilidade para leitura e escrita", async () => {
    assert.deepEqual(await executarConsultaRetencao({ papel: "admin", agora: () => AGORA, consultar: null }, "fixture"), { ok: false, motivo: "sem_banco" });
    assert.deepEqual(await executarAlteracaoRetencao({ papel: "admin", por: "admin@example.test", agora: () => AGORA, alterar: null }, "fixture", PEDIDO), { ok: false, motivo: "sem_banco" });
  });
  test("ID inválido e corpo inválido são recusados antes da porta", async () => {
    const consultar = async () => { throw new Error("leitura proibida"); };
    const alterar = async () => { throw new Error("escrita proibida"); };
    assert.equal((await executarConsultaRetencao({ papel: "admin", agora: () => AGORA, consultar }, "../fixture")).ok, false);
    const res = await executarAlteracaoRetencao({ papel: "admin", por: "admin@example.test", agora: () => AGORA, alterar }, "fixture", { ...PEDIDO, dias: 31 });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.motivo, "entrada_invalida");
  });
  test("admin sem identificação não registra exceção", async () => {
    const res = await executarAlteracaoRetencao({ papel: "admin", por: null, agora: () => AGORA, alterar: async () => { throw new Error("escrita proibida"); } }, "fixture", PEDIDO);
    assert.deepEqual(res, { ok: false, motivo: "sem_permissao" });
  });
  test("lead ausente é diferente de lead sem exceção", async () => {
    assert.deepEqual(await executarConsultaRetencao({ papel: "admin", agora: () => AGORA, consultar: async () => null }, "fixture"), { ok: false, motivo: "nao_encontrado" });
    assert.deepEqual(await executarConsultaRetencao({ papel: "admin", agora: () => AGORA, consultar: async () => ({ registro: null }) }, "fixture"), {
      ok: true, consulta: { calculadaEm: "2026-10-11T04:17:52.123Z", versao: 0, excecao: null },
    });
  });
  test("a porta recebe datas do servidor e responsável da sessão, não do corpo", async () => {
    let instantes = 0;
    const res = await executarAlteracaoRetencao({
      papel: "admin", por: "admin@example.test", agora: () => { instantes++; return AGORA; },
      alterar: async (id, comando, por) => {
        assert.equal(id, "fixture");
        assert.equal(por, "admin@example.test");
        assert.deepEqual(comando, { acao: "registrar", versao: 0, justificativa: TEXTO, registradaEm: AGORA, revisarEm: new Date("2026-11-10T04:17:52.123Z") });
        return { ok: true, registro: REGISTRO, mudou: true };
      },
    }, "fixture", { ...PEDIDO, por: "fraude", revisarEm: "2099-01-01" });
    assert.deepEqual(res, { ok: true, consulta: CONSULTA, mudou: true });
    assert.equal(instantes, 1);
  });
  test("conflito e exclusão simultânea são propagados sem sucesso falso", async () => {
    for (const motivo of ["conflito", "nao_encontrado"] as const) {
      assert.deepEqual(await executarAlteracaoRetencao({ papel: "admin", por: "admin@example.test", agora: () => AGORA, alterar: async () => ({ ok: false, motivo }) }, "fixture", PEDIDO), { ok: false, motivo });
    }
  });
  test("falhas de banco não viram ausência de exceção nem sucesso", async () => {
    await assert.rejects(executarConsultaRetencao({ papel: "admin", agora: () => AGORA, consultar: async () => { throw new Error("falha local"); } }, "fixture"), /falha local/);
    await assert.rejects(executarAlteracaoRetencao({ papel: "admin", por: "admin@example.test", agora: () => AGORA, alterar: async () => { throw new Error("falha local"); } }, "fixture", PEDIDO), /falha local/);
  });
});
