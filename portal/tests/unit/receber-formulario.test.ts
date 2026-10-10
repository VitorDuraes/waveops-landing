import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { receberFormulario, respostaDoPreflight, type Dependencias } from "../../src/lib/receber-formulario";
import type { LeadValidado, ResultadoDeValidacao } from "../../src/lib/leads";

// Decisões da recepção dos formulários do site que parecem detalhe e não são: CORS em
// toda resposta de origem permitida, ordem das checagens, nunca 2xx em erro, robô antes
// da validação, aviso só quando grava. A rota (src/server/formulario-site.ts) só liga
// estas decisões ao Next; aqui elas rodam sem servidor.

const SITE = "https://waveops.com.br";
const LEAD = { tipo: "contato", idEnvio: "3f9c2a1e-7b4d-4e8a-9c1f-2d6e8b0a4c5f" } as LeadValidado;
const CORPO_OK = JSON.stringify({ idEnvio: LEAD.idEnvio, website: "", preenchidoEmMs: 5000 });

type Chamadas = { leu: number; validou: number; gravou: number; avisou: number; logs: string[] };

function deps(extra: Partial<Dependencias> = {}): { d: Dependencias; c: Chamadas } {
  const c: Chamadas = { leu: 0, validou: 0, gravou: 0, avisou: 0, logs: [] };
  const d: Dependencias = {
    origin: SITE,
    ip: "203.0.113.7",
    lerCorpo: async () => {
      c.leu++;
      return CORPO_OK;
    },
    validar: (): ResultadoDeValidacao => {
      c.validou++;
      return { ok: true, dados: LEAD };
    },
    permitir: () => true,
    gravar: async () => {
      c.gravou++;
      return "gravado";
    },
    aoGravar: () => {
      c.avisou++;
    },
    registrar: (_nivel, evento) => {
      c.logs.push(evento);
    },
    emProducao: true,
    ...extra,
  };
  return { d, c };
}

function cors(r: { cabecalhos: Record<string, string> }): string | undefined {
  return r.cabecalhos["Access-Control-Allow-Origin"];
}

describe("receberFormulario", () => {
  test("gravado: 200 com protocolo, CORS, no-store, e um aviso", async () => {
    const { d, c } = deps();
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { ok: true, protocolo: LEAD.idEnvio });
    assert.equal(cors(r), SITE);
    assert.equal(r.cabecalhos["Cache-Control"], "no-store");
    assert.equal(r.cabecalhos["Vary"], "Origin");
    assert.equal(c.avisou, 1);
  });

  test("repetição do mesmo idEnvio: o mesmo 200, sem aviso", async () => {
    const { d, c } = deps({ gravar: async () => "repetido" });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 200);
    assert.equal(c.avisou, 0);
  });

  test("origem ausente ou estranha: 403 sem CORS, sem ler o corpo", async () => {
    for (const origin of [null, "https://golpe.com", "null", "https://waveops.com.br.golpe.com"]) {
      const { d, c } = deps({ origin });
      const r = await receberFormulario("contato", d);
      assert.equal(r.status, 403, String(origin));
      assert.equal(cors(r), undefined);
      assert.equal(r.cabecalhos["Vary"], "Origin");
      assert.equal(c.leu, 0);
    }
  });

  test("volume bruto por IP estourado: 429 antes de ler o corpo", async () => {
    const { d, c } = deps({ permitir: (chave) => !chave.includes(":bruto:") });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 429);
    assert.equal(cors(r), SITE);
    assert.equal(c.leu, 0);
  });

  test("corpo acima do teto: 413 com CORS", async () => {
    const { d } = deps({ lerCorpo: async () => null });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 413);
    assert.equal(cors(r), SITE);
  });

  test("corpo que não é JSON: 422 com o campo 'corpo'", async () => {
    const { d } = deps({ lerCorpo: async () => "{não é json" });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 422);
    assert.deepEqual(r.corpo, { ok: false, erro: "validacao", campos: ["corpo"] });
    assert.equal(cors(r), SITE);
  });

  test("robô: 200 antes da validação, sem gravar e sem aviso", async () => {
    const { d, c } = deps({ lerCorpo: async () => JSON.stringify({ idEnvio: LEAD.idEnvio, website: "spam", nome: "" }) });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { ok: true, protocolo: LEAD.idEnvio });
    assert.equal(cors(r), SITE);
    assert.equal(c.validou, 0);
    assert.equal(c.gravou, 0);
    assert.equal(c.avisou, 0);
  });

  test("campo inválido: 422 com os campos e CORS", async () => {
    const { d, c } = deps({ validar: () => ({ ok: false, campos: ["nome", "telefone"] }) });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 422);
    assert.deepEqual(r.corpo, { ok: false, erro: "validacao", campos: ["nome", "telefone"] });
    assert.equal(cors(r), SITE);
    assert.equal(c.gravou, 0);
  });

  test("limite por IP (minuto ou hora) estourado: 429 com Retry-After e CORS, sem gravar", async () => {
    for (const janela of [":min:", ":hora:"]) {
      const { d, c } = deps({ permitir: (chave) => !chave.includes(janela) });
      const r = await receberFormulario("contato", d);
      assert.equal(r.status, 429, janela);
      assert.equal(r.cabecalhos["Retry-After"], "60");
      assert.equal(cors(r), SITE);
      assert.equal(c.gravou, 0);
    }
  });

  test("as chaves de limite separam contato e lista", async () => {
    const chaves: string[] = [];
    const { d } = deps({ permitir: (chave) => (chaves.push(chave), true) });
    await receberFormulario("interesse", d);
    assert.ok(chaves.length >= 3 && chaves.every((k) => k.includes(":interesse:") && k.includes("203.0.113.7")), chaves.join(" "));
  });

  test("falha de banco: 503 com CORS, nunca 2xx", async () => {
    const { d, c } = deps({ gravar: async () => {
      throw new Error("Can't reach database server");
    } });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 503);
    assert.deepEqual(r.corpo, { ok: false, erro: "indisponivel" });
    assert.equal(cors(r), SITE);
    assert.equal(c.avisou, 0);
  });

  test("sem banco: 503 em produção (lead não pode sumir com 200); 200 em dev", async () => {
    const prod = deps({ gravar: async () => "sem-banco" });
    assert.equal((await receberFormulario("contato", prod.d)).status, 503);
    const dev = deps({ gravar: async () => "sem-banco", emProducao: false });
    assert.equal((await receberFormulario("contato", dev.d)).status, 200);
  });

  test("exceção inesperada em qualquer etapa: 503 com CORS", async () => {
    const quebras: Partial<Dependencias>[] = [
      { lerCorpo: async () => { throw new Error("stream"); } },
      { validar: () => { throw new Error("bug"); } },
      { permitir: () => { throw new Error("bug"); } },
    ];
    for (const quebra of quebras) {
      const { d } = deps(quebra);
      const r = await receberFormulario("contato", d);
      assert.equal(r.status, 503, Object.keys(quebra).join());
      assert.equal(cors(r), SITE);
    }
  });
});

describe("aviso ao time", () => {
  test("falha ao agendar o aviso não muda o 200: o lead já está gravado", async () => {
    const { d, c } = deps({ aoGravar: () => {
      throw new Error("after indisponível");
    } });
    const r = await receberFormulario("contato", d);
    assert.equal(r.status, 200);
    assert.ok(c.logs.includes("lead.aviso_falhou"));
  });
});

describe("respostaDoPreflight", () => {
  test("origem do site: 204 com os cabeçalhos do preflight", () => {
    const r = respostaDoPreflight("https://www.waveops.com.br");
    assert.equal(r.status, 204);
    assert.equal(r.cabecalhos["Access-Control-Allow-Origin"], "https://www.waveops.com.br");
    assert.equal(r.cabecalhos["Access-Control-Allow-Methods"], "POST, OPTIONS");
    assert.equal(r.cabecalhos["Access-Control-Allow-Headers"], "content-type");
    assert.equal(r.cabecalhos["Vary"], "Origin");
  });

  test("origem estranha: 204 sem CORS (o navegador bloqueia)", () => {
    const r = respostaDoPreflight("https://golpe.com");
    assert.equal(r.status, 204);
    assert.equal(r.cabecalhos["Access-Control-Allow-Origin"], undefined);
    assert.equal(r.cabecalhos["Vary"], "Origin");
  });
});
