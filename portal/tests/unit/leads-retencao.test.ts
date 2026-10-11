import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  executarPreviaRetencaoLeads,
  lerPreviaRetencaoLeads,
  limitesRetencaoLeads,
  montarPreviaRetencaoLeads,
  type ContagensRetencaoLeads,
  type PreviaRetencaoLeads,
} from "../../src/lib/leads-retencao";

const AGORA = "2026-10-11T04:17:52.123Z";
const CONTAGENS: ContagensRetencaoLeads = {
  contato: { total: 1200, prazoAtingido: 700, revisaoVigente: 200, revisaoVencida: 100 },
  interesse: { total: 850, prazoAtingido: 700, revisaoVigente: 300, revisaoVencida: 200 },
};

function previa(): PreviaRetencaoLeads {
  return {
    calculadaEm: AGORA,
    tipos: [
      { tipo: "contato", dias: 180, criadosAte: "2026-04-14T04:17:52.123Z", total: 1200, noPrazo: 500, prazoAtingido: 700, revisaoVigente: 200, revisaoVencida: 100, semExcecao: 400 },
      { tipo: "interesse", dias: 365, criadosAte: "2025-10-11T04:17:52.123Z", total: 850, noPrazo: 150, prazoAtingido: 700, revisaoVigente: 300, revisaoVencida: 200, semExcecao: 200 },
    ],
  };
}

describe("limites de retenção: dias de 24 horas desde createdAt", () => {
  test("contato inclui o limite exato de 180 dias, sem cortar a hora nem os milissegundos", () => {
    const limites = limitesRetencaoLeads(new Date(AGORA));
    assert.deepEqual(limites.contato.where, {
      tipo: "contato",
      createdAt: { lte: new Date("2026-04-14T04:17:52.123Z") },
    });
  });

  test("interesse inclui o limite exato de 365 dias, sem aplicar o prazo de contato", () => {
    const limites = limitesRetencaoLeads(new Date(AGORA));
    assert.deepEqual(limites.interesse.where, {
      tipo: "interesse",
      createdAt: { lte: new Date("2025-10-11T04:17:52.123Z") },
    });
  });

  test("365 dias atravessando fevereiro bissexto não são um ano de calendário", () => {
    const limites = limitesRetencaoLeads(new Date("2024-03-01T12:00:00Z"));
    assert.equal(limites.interesse.where.createdAt.lte.toISOString(), "2023-03-02T12:00:00.000Z");
  });

  test("a hora equivalente em Brasília produz os mesmos limites UTC", () => {
    const limites = limitesRetencaoLeads(new Date("2026-10-11T01:17:52.123-03:00"));
    assert.equal(limites.calculadaEm, AGORA);
    assert.equal(limites.contato.where.createdAt.lte.toISOString(), "2026-04-14T04:17:52.123Z");
    assert.equal(limites.interesse.where.createdAt.lte.toISOString(), "2025-10-11T04:17:52.123Z");
  });

  test("a regra mantém o mesmo intervalo ao atravessar a mudança de horário de verão", () => {
    const limites = limitesRetencaoLeads(new Date("2026-03-08T03:30:00-04:00"));
    assert.equal(limites.contato.where.createdAt.lte.toISOString(), "2025-09-09T07:30:00.000Z");
  });

  test("não modifica o instante recebido do servidor", () => {
    const agora = new Date(AGORA);
    limitesRetencaoLeads(agora);
    assert.equal(agora.toISOString(), AGORA);
  });

  test("recusa relógio inválido em vez de produzir limites incorretos", () => {
    assert.throws(() => limitesRetencaoLeads(new Date("inválida")), RangeError);
  });

  test("recusa um instante cujo limite ficaria fora das datas representáveis", () => {
    assert.throws(() => limitesRetencaoLeads(new Date("-271821-04-20T00:00:00.000Z")), RangeError);
  });
});

describe("montagem da prévia: agregado de toda a tabela", () => {
  test("preserva contagens além de 500 e separa quem atingiu o prazo", () => {
    assert.deepEqual(montarPreviaRetencaoLeads(limitesRetencaoLeads(new Date(AGORA)), CONTAGENS), previa());
  });

  test("zero só aparece quando a consulta devolve zero", () => {
    const res = montarPreviaRetencaoLeads(limitesRetencaoLeads(new Date(AGORA)), {
      contato: { total: 0, prazoAtingido: 0, revisaoVigente: 0, revisaoVencida: 0 },
      interesse: { total: 0, prazoAtingido: 0, revisaoVigente: 0, revisaoVencida: 0 },
    });
    assert.deepEqual(res.tipos.map((t) => [t.total, t.noPrazo, t.prazoAtingido]), [[0, 0, 0], [0, 0, 0]]);
  });

  test("não copia campos extras ou identificadores para a resposta", () => {
    const contagens = {
      ...CONTAGENS,
      email: "exemplo@example.com",
      contato: { ...CONTAGENS.contato, id: "fixture", visitorId: "fixture" },
    };
    assert.deepEqual(montarPreviaRetencaoLeads(limitesRetencaoLeads(new Date(AGORA)), contagens), previa());
  });

  for (const [nome, total, prazoAtingido] of [
    ["total negativo", -1, 0],
    ["subconjunto negativo", 3, -1],
    ["total fracionado", 1.5, 1],
    ["subconjunto fracionado", 3, 1.5],
    ["subconjunto maior que o total", 3, 4],
    ["total infinito", Infinity, 0],
    ["total NaN", NaN, 0],
    ["total sem precisão inteira", Number.MAX_SAFE_INTEGER + 1, 0],
  ] as const) {
    test(`recusa ${nome} para não apresentar uma prévia falsa`, () => {
      assert.throws(() => montarPreviaRetencaoLeads(limitesRetencaoLeads(new Date(AGORA)), {
        ...CONTAGENS,
        contato: { total, prazoAtingido, revisaoVigente: 0, revisaoVencida: 0 },
      }), RangeError);
    });
  }
});

describe("leitura da resposta pelo painel", () => {
  test("aceita uma prévia coerente produzida pelo contrato", () => {
    assert.deepEqual(lerPreviaRetencaoLeads(previa()), previa());
  });

  test("descarta campos extras em vez de devolvê-los ao painel", () => {
    const valor = { ...previa(), email: "exemplo@example.com" };
    assert.deepEqual(lerPreviaRetencaoLeads(valor), previa());
  });

  for (const valor of [null, undefined, 1, [], "erro", {}, { calculadaEm: AGORA, tipos: [] }]) {
    test(`recusa corpo sem a estrutura da prévia: ${JSON.stringify(valor)}`, () => {
      assert.equal(lerPreviaRetencaoLeads(valor), null);
    });
  }

  test("recusa tipo repetido ou ausente", () => {
    const valor = previa();
    valor.tipos[1].tipo = "contato";
    assert.equal(lerPreviaRetencaoLeads(valor), null);
    assert.equal(lerPreviaRetencaoLeads({ ...previa(), tipos: previa().tipos.slice(0, 1) }), null);
  });

  test("recusa prazo alterado e limite temporal incoerente", () => {
    const valor = previa();
    valor.tipos[0].dias = 179;
    assert.equal(lerPreviaRetencaoLeads(valor), null);
    const outro = previa();
    outro.tipos[0].criadosAte = "2026-04-14T04:17:52.122Z";
    assert.equal(lerPreviaRetencaoLeads(outro), null);
  });

  test("recusa hora inválida e datas sem o formato ISO do contrato", () => {
    assert.equal(lerPreviaRetencaoLeads({ ...previa(), calculadaEm: "inválida" }), null);
    assert.equal(lerPreviaRetencaoLeads({ ...previa(), calculadaEm: "2026-10-11" }), null);
  });

  test("resposta com instante extremo é recusada sem lançar erro para o painel", () => {
    assert.equal(lerPreviaRetencaoLeads({ ...previa(), calculadaEm: "-271821-04-20T00:00:00.000Z" }), null);
  });

  test("recusa contagem inconsistente ou de tipo incorreto", () => {
    for (const mudanca of [{ noPrazo: 499 }, { total: "1200" }, { prazoAtingido: -1 }, { prazoAtingido: 1201 }]) {
      const valor = previa();
      assert.equal(lerPreviaRetencaoLeads({ ...valor, tipos: [{ ...valor.tipos[0], ...mudanca }, valor.tipos[1]] }), null);
    }
  });
});

describe("revisões entre os cadastros com prazo atingido", () => {
  test("vigentes, vencidas e sem exceção somam o prazo atingido, não o total", () => {
    const resultado = montarPreviaRetencaoLeads(limitesRetencaoLeads(new Date(AGORA)), CONTAGENS);
    assert.deepEqual(resultado.tipos.map((t) => [t.revisaoVigente, t.revisaoVencida, t.semExcecao]), [[200, 100, 400], [300, 200, 200]]);
  });
  for (const [nome, revisaoVigente, revisaoVencida] of [
    ["vigente negativa", -1, 0], ["vencida negativa", 0, -1],
    ["vigente fracionada", 0.5, 0], ["vencida fracionada", 0, 0.5],
    ["soma acima do prazo", 400, 301], ["vigente infinita", Infinity, 0],
    ["vencida NaN", 0, NaN], ["vigente ausente", undefined, 0],
  ] as const) {
    test(`recusa ${nome} em vez de apresentar um subconjunto falso`, () => {
      assert.throws(() => montarPreviaRetencaoLeads(limitesRetencaoLeads(new Date(AGORA)), {
        ...CONTAGENS, contato: { total: 1200, prazoAtingido: 700, revisaoVigente, revisaoVencida } as ContagensRetencaoLeads["contato"],
      }), RangeError);
    });
  }
  test("resposta antiga sem as revisões não equivale a revisões zero", () => {
    const valor = previa();
    const { revisaoVigente, revisaoVencida, semExcecao, ...antiga } = valor.tipos[0];
    void revisaoVigente; void revisaoVencida; void semExcecao;
    assert.equal(lerPreviaRetencaoLeads({ ...valor, tipos: [antiga, valor.tipos[1]] }), null);
  });
  test("painel recusa contagem restante incoerente e subcontagem acima do prazo", () => {
    for (const mudanca of [{ semExcecao: 401 }, { revisaoVigente: 701 }, { revisaoVencida: "100" }]) {
      const valor = previa();
      assert.equal(lerPreviaRetencaoLeads({ ...valor, tipos: [{ ...valor.tipos[0], ...mudanca }, valor.tipos[1]] }), null);
    }
  });
});

describe("execução da prévia: autorização e falhas", () => {
  for (const papel of [null, "customer", "outro"]) {
    test(`nega ${papel} antes de consultar o banco ou o relógio`, async () => {
      const res = await executarPreviaRetencaoLeads({
        papel,
        agora: () => { throw new Error("não deve consultar o relógio"); },
        contar: async () => { throw new Error("não deve consultar o banco"); },
      });
      assert.deepEqual(res, { ok: false, motivo: "sem_permissao" });
    });
  }

  test("sem banco devolve indisponibilidade, não sucesso com zeros", async () => {
    const res = await executarPreviaRetencaoLeads({ papel: "admin", agora: () => new Date(AGORA), contar: null });
    assert.deepEqual(res, { ok: false, motivo: "sem_banco" });
  });

  test("administrador obtém os dois tipos com um único instante de referência", async () => {
    let relogio = 0;
    const res = await executarPreviaRetencaoLeads({
      papel: "admin",
      agora: () => new Date(relogio++ === 0 ? AGORA : "2026-10-12T04:17:52.123Z"),
      contar: async (limites) => {
        assert.deepEqual(limites.contato.where, { tipo: "contato", createdAt: { lte: new Date("2026-04-14T04:17:52.123Z") } });
        assert.deepEqual(limites.interesse.where, { tipo: "interesse", createdAt: { lte: new Date("2025-10-11T04:17:52.123Z") } });
        return CONTAGENS;
      },
    });
    assert.deepEqual(res, { ok: true, previa: previa() });
  });

  test("falha de banco é propagada e nunca se transforma numa contagem vazia", async () => {
    await assert.rejects(executarPreviaRetencaoLeads({
      papel: "admin",
      agora: () => new Date(AGORA),
      contar: async () => { throw new Error("banco de teste indisponível"); },
    }), /banco de teste indisponível/);
  });
});
