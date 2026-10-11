import { after, afterEach, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire, registerHooks } from "node:module";
import { PrismaClient, type LeadTipo } from "@prisma/client";

// Gate obrigatório antes de importar a DAL. Nunca usa DATABASE_URL herdada ou um banco remoto.
const alvo = new URL(process.env.LEADS_TEST_DATABASE_URL || "http://nao-configurado.invalid");
assert.equal(alvo.protocol, "postgresql:");
assert.equal(alvo.hostname, "127.0.0.1");
assert.equal(alvo.port, "56421");
assert.equal(alvo.pathname, "/waveops_leads_test");
assert.equal(alvo.username, "postgres");
assert.equal(alvo.password, "");
Object.assign(process.env, { DATABASE_URL: alvo.href, DIRECT_URL: alvo.href, NODE_ENV: "test" });
// Next resolve este marcador para o módulo vazio no servidor. Reproduzir só essa
// resolução no runner Node, preservando a DAL, o Prisma e a transação reais.
const require = createRequire(import.meta.url);
const marcador = require.resolve("next/dist/compiled/server-only/empty.js");
const resolucao = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "server-only" ? marcador : specifier, context);
} });

const db = new PrismaClient();
const ADMIN = { sub: "fixture-admin", role: "admin", email: "admin@example.test" } as const;
const TEXTO = "Negociação fictícia em revisão, aguardar proposta.";
const ids: string[] = [];
let alterar: typeof import("../../src/server/leads-excecoes").alterarRetencaoLead;
let consultar: typeof import("../../src/server/leads-excecoes").consultarRetencaoLead;
let previa: typeof import("../../src/server/leads-retencao").consultarPreviaRetencaoLeads;

async function fixture(tipo: LeadTipo = "contato") {
  const id = `teste_${randomUUID()}`;
  ids.push(id);
  return db.lead.create({ data: { id, idEnvio: id, tipo, politicaVersao: "fixture-local", email: "fixture@example.test", createdAt: new Date("2020-01-01T00:00:00Z") } });
}
const registrar = (id: string, versao = 0, dias = 30) => alterar(ADMIN, id, { acao: "registrar", versao, justificativa: TEXTO, dias });

before(async () => {
  await db.$connect();
  assert.equal(await db.lead.count(), 0, "Use um PostgreSQL isolado e vazio, com as migrations aplicadas.");
  const dal = await import("../../src/server/leads-excecoes");
  alterar = dal.alterarRetencaoLead;
  consultar = dal.consultarRetencaoLead;
  previa = (await import("../../src/server/leads-retencao")).consultarPreviaRetencaoLeads;
});
afterEach(async () => {
  if (ids.length) await db.lead.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
after(async () => {
  await db.$disconnect();
  const { getPrisma } = await import("../../src/server/db");
  await getPrisma().$disconnect();
  resolucao.deregister();
});

describe("exceções no PostgreSQL real", () => {
  test("cliente não grava; encerrar ausência não cria linha ou auditoria", async () => {
    const lead = await fixture();
    assert.deepEqual(await alterar({ ...ADMIN, role: "customer" }, lead.id, { acao: "encerrar", versao: 0 }), { ok: false, motivo: "sem_permissao" });
    const r = await alterar(ADMIN, lead.id, { acao: "encerrar", versao: 0 });
    assert.equal(r.ok, true);
    if (r.ok) { assert.equal(r.mudou, false); assert.equal(r.consulta.versao, 0); }
    assert.equal(await db.leadRetencao.count({ where: { leadId: lead.id } }), 0);
    assert.equal(await db.auditoria.count({ where: { alvoId: lead.id } }), 0);
  });

  test("registro preserva o lead original e grava somente metadados na auditoria", async () => {
    const lead = await fixture("interesse");
    const r = await registrar(lead.id);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.consulta.versao, 1);
      assert.equal(r.consulta.excecao?.por, ADMIN.email);
      assert.equal(new Date(r.consulta.excecao!.revisarEm).getTime() - new Date(r.consulta.excecao!.registradaEm).getTime(), 2_592_000_000);
    }
    assert.deepEqual(await db.lead.findUnique({ where: { id: lead.id } }), lead);
    const auditorias = await db.auditoria.findMany({ where: { alvoId: lead.id } });
    assert.equal(auditorias.length, 1);
    assert.equal(auditorias[0].acao, "lead.excecao_registrada");
    assert.equal(auditorias[0].por, ADMIN.email);
    assert.deepEqual(Object.keys(auditorias[0].detalhe as object).sort(), ["registradaEm", "revisarEm", "tipo", "versao"]);
    assert.equal(JSON.stringify(auditorias).includes(TEXTO), false);
    assert.equal(JSON.stringify(auditorias).includes(lead.email!), false);
  });

  test("duas primeiras gravações concorrentes geram uma decisão e um conflito", async () => {
    const lead = await fixture();
    const resultados = await Promise.all([registrar(lead.id, 0, 7), registrar(lead.id, 0, 30)]);
    assert.equal(resultados.filter((r) => r.ok).length, 1);
    assert.deepEqual(resultados.filter((r) => !r.ok), [{ ok: false, motivo: "conflito" }]);
    assert.equal((await db.leadRetencao.findUniqueOrThrow({ where: { leadId: lead.id } })).versao, 1);
    assert.equal(await db.auditoria.count({ where: { alvoId: lead.id } }), 1);
  });

  test("atualizar e encerrar na mesma versão também disputam uma única decisão", async () => {
    const lead = await fixture();
    assert.equal((await registrar(lead.id)).ok, true);
    const resultados = await Promise.all([registrar(lead.id, 1, 7), alterar(ADMIN, lead.id, { acao: "encerrar", versao: 1 })]);
    assert.equal(resultados.filter((r) => r.ok).length, 1);
    assert.deepEqual(resultados.filter((r) => !r.ok), [{ ok: false, motivo: "conflito" }]);
    assert.equal((await db.leadRetencao.findUniqueOrThrow({ where: { leadId: lead.id } })).versao, 2);
    assert.equal(await db.auditoria.count({ where: { alvoId: lead.id } }), 2);
  });

  test("encerrar preserva a versão; um pedido antigo não passa pelo estado vazio", async () => {
    const lead = await fixture();
    await registrar(lead.id);
    await alterar(ADMIN, lead.id, { acao: "encerrar", versao: 1 });
    const leitura = await consultar(ADMIN, lead.id);
    assert.equal(leitura.ok, true);
    if (leitura.ok) { assert.equal(leitura.consulta.versao, 2); assert.equal(leitura.consulta.excecao, null); }
    assert.deepEqual(await registrar(lead.id, 0), { ok: false, motivo: "conflito" });
    assert.deepEqual(await registrar(lead.id, 1), { ok: false, motivo: "conflito" });
    assert.equal((await registrar(lead.id, 2)).ok, true);
    assert.equal((await db.leadRetencao.findUniqueOrThrow({ where: { leadId: lead.id } })).versao, 3);
    assert.equal(await db.auditoria.count({ where: { alvoId: lead.id } }), 3);
  });

  test("falha de auditoria reverte a revisão e a versão na mesma transação", async () => {
    const lead = await fixture();
    await registrar(lead.id);
    const antes = await db.leadRetencao.findUniqueOrThrow({ where: { leadId: lead.id } });
    await db.$executeRaw`CREATE FUNCTION teste_falha_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha ficticia de auditoria'; END; $$`;
    await db.$executeRaw`CREATE TRIGGER teste_falha_auditoria BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION teste_falha_auditoria()`;
    try {
      await assert.rejects(registrar(lead.id, 1, 7));
      assert.deepEqual(await db.leadRetencao.findUniqueOrThrow({ where: { leadId: lead.id } }), antes);
      assert.equal(await db.auditoria.count({ where: { alvoId: lead.id } }), 1);
    } finally {
      await db.$executeRaw`DROP TRIGGER teste_falha_auditoria ON auditoria`;
      await db.$executeRaw`DROP FUNCTION teste_falha_auditoria()`;
    }
  });

  test("restrições do banco recusam metadados incompletos e janela acima de 30 dias", async () => {
    const lead = await fixture();
    await assert.rejects(db.leadRetencao.create({ data: { leadId: lead.id, versao: 1, justificativa: TEXTO } }));
    await assert.rejects(db.leadRetencao.create({ data: { leadId: lead.id, versao: 1, justificativa: TEXTO, por: ADMIN.email, registradaEm: new Date("2026-10-11T04:17:52.123Z"), revisarEm: new Date("2026-11-11T04:17:52.123Z") } }));
    assert.equal(await db.leadRetencao.count({ where: { leadId: lead.id } }), 0);
  });

  test("exclusão do lead remove a exceção em cascata e preserva a auditoria", async () => {
    const lead = await fixture();
    await registrar(lead.id);
    await db.lead.delete({ where: { id: lead.id } });
    assert.equal(await db.leadRetencao.count({ where: { leadId: lead.id } }), 0);
    assert.equal(await db.auditoria.count({ where: { alvoId: lead.id } }), 1);
    assert.deepEqual(await consultar(ADMIN, lead.id), { ok: false, motivo: "nao_encontrado" });
  });

  test("prévia inclui mais de 500 leads e ignora exceções de cadastros ainda no prazo", async () => {
    const agora = Date.now();
    const prefixo = `teste_${randomUUID()}`;
    const linhas = (Object.entries({ contato: 180, interesse: 365 }) as [LeadTipo, number][]).flatMap(([tipo, dias]) =>
      Array.from({ length: 604 }, (_, i) => ({ id: `${prefixo}_${tipo}_${i}`, idEnvio: `${prefixo}_${tipo}_${i}`, tipo,
        status: i % 2 ? "novo" as const : "atendido" as const, politicaVersao: "fixture-local", marketingAceito: i % 2 === 0,
        createdAt: new Date(agora - (i < 603 ? dias + 1 : dias - 1) * 86_400_000) })));
    ids.push(...linhas.map((l) => l.id));
    await db.lead.createMany({ data: linhas });
    for (const tipo of ["contato", "interesse"] as const) {
      await db.leadRetencao.createMany({ data: [0, 1, 603].map((i) => ({ leadId: `${prefixo}_${tipo}_${i}`, versao: 1, justificativa: TEXTO, por: ADMIN.email,
        registradaEm: new Date(agora - (i === 1 ? 2 : 0) * 86_400_000), revisarEm: new Date(agora + (i === 1 ? -1 : 1) * 86_400_000) })) });
    }
    const r = await previa(ADMIN);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.previa.tipos.map((f) => [f.total, f.noPrazo, f.prazoAtingido, f.revisaoVigente, f.revisaoVencida, f.semExcecao]), [[604, 1, 603, 1, 1, 601], [604, 1, 603, 1, 1, 601]]);
  });
});
