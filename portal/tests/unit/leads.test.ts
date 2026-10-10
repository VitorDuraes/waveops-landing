import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ehRoboDeFormulario,
  protocoloDe,
  validarContato,
  validarInteresse,
  validarEmail,
  normalizarTelefone,
  TEMPO_MINIMO_MS,
} from "../../src/lib/leads";

// Contrato dos formulários do site novo (guia docs/integrations/n8n-site-v2.md, seção 3,
// e plano docs/plans/2026-10-10-leads-no-portal.plan.md). O servidor aceita o que o site
// manda e nunca é mais rígido que ele: os corpos aqui são montados pelo próprio
// assets/site/lib/payload.js, e a paridade das regras é conferida contra validacao.js.

const RAIZ = resolve(__dirname, "../../..");

// Import por caminho calculado: um import literal de ../assets entraria no typecheck do
// next build, e o Railway builda só a pasta portal/, sem a raiz do repo.
async function doSite<T>(arquivo: string): Promise<T> {
  return (await import(pathToFileURL(resolve(RAIZ, "assets/site/lib", arquivo)).href)) as T;
}

type Corpo = Record<string, unknown>;
type Payload = {
  montarLead(dados: Corpo, rotulos: Record<string, string>, ctx: Corpo): Corpo;
  montarInteresse(dados: Corpo, ctx: Corpo): Corpo;
};
type ValidacaoDoSite = { validarEmail(v: unknown): boolean; normalizarTelefone(v: unknown): string };

const ATRIBUICAO = {
  utm: { source: "instagram", medium: "cpc", campaign: "lancamento", content: "", term: "" },
  referrer: "",
  landingUrl: "https://waveops.com.br/?utm_source=instagram&utm_medium=cpc",
  fonte: "instagram/cpc",
};

function contexto(extra: Corpo = {}): Corpo {
  return {
    idEnvio: "3f9c2a1e-7b4d-4e8a-9c1f-2d6e8b0a4c5f",
    agora: new Date("2026-10-10T12:15:00.000Z"),
    preenchidoEmMs: 8000,
    atribuicao: ATRIBUICAO,
    pagina: "/contato/",
    politicaVersao: "rascunho-2026-08-10",
    cienciaTextoVersao: "contato-ciencia-v1",
    marketingTextoVersao: "contato-marketing-v1",
    ...extra,
  };
}

const DADOS_CONTATO: Corpo = {
  nome: "Ana Souza",
  empresa: "Loja da Ana",
  canalRetorno: "whatsapp",
  telefone: "+55 (34) 99177-5784",
  email: "",
  mensagem: "Quero automatizar o atendimento.",
  politicaCiente: true,
  marketingAceito: false,
  website: "",
};
const ROTULOS = { dor: "Ferramentas que não conversam", procura: "Projeto sob medida", melhorHorario: "Manhã" };

async function leadDoSite(dados: Corpo = {}, ctx: Corpo = {}): Promise<Corpo> {
  const { montarLead } = await doSite<Payload>("payload.js");
  return montarLead({ ...DADOS_CONTATO, ...dados }, ROTULOS, contexto(ctx));
}

async function interesseDoSite(dados: Corpo = {}, ctx: Corpo = {}): Promise<Corpo> {
  const { montarInteresse } = await doSite<Payload>("payload.js");
  return montarInteresse(
    { email: "Ana@Empresa.com.br ", politicaCiente: true, marketingAceito: true, website: "", ...dados },
    contexto({ pagina: "/plataforma/", cienciaTextoVersao: "interesse-ciencia-v1", marketingTextoVersao: "interesse-marketing-v1", ...ctx })
  );
}

function camposDe(r: ReturnType<typeof validarContato>): string[] {
  return r.ok ? [] : r.campos;
}

describe("contato: o que o site manda hoje passa", () => {
  test("canal WhatsApp: telefone normalizado, e-mail vazio vira nulo, atribuição guardada", async () => {
    const r = validarContato(await leadDoSite());
    assert.ok(r.ok, `recusou: ${camposDe(r).join(", ")}`);
    const d = r.dados;
    assert.equal(d.tipo, "contato");
    assert.equal(d.idEnvio, "3f9c2a1e-7b4d-4e8a-9c1f-2d6e8b0a4c5f");
    assert.equal(d.nome, "Ana Souza");
    assert.equal(d.empresa, "Loja da Ana");
    assert.equal(d.telefone, "34991775784");
    assert.equal(d.email, null);
    assert.equal(d.canalRetorno, "whatsapp");
    assert.equal(d.melhorHorario, null);
    assert.equal(d.dor, "Ferramentas que não conversam");
    assert.equal(d.procura, "Projeto sob medida");
    assert.equal(d.mensagem, "Quero automatizar o atendimento.");
    assert.equal(d.politicaVersao, "rascunho-2026-08-10");
    assert.equal(d.cienciaTextoVersao, "contato-ciencia-v1");
    assert.equal(d.marketingAceito, false);
    assert.equal(d.marketingTextoVersao, "contato-marketing-v1", "a versão do texto vai mesmo sem aceite: prova o que a pessoa viu");
    assert.equal(d.utmSource, "instagram");
    assert.equal(d.utmMedium, "cpc");
    assert.equal(d.utmContent, null);
    assert.equal(d.primeiraFonte, "instagram/cpc");
    assert.equal(d.pagina, "/contato/");
    assert.equal(d.preenchidoEmMs, 8000);
    assert.equal(d.enviadoEm?.toISOString(), "2026-10-10T12:15:00.000Z");
    assert.equal(d.finalidade, null);
  });

  test("canal E-mail: telefone opcional e e-mail em minúsculas", async () => {
    const r = validarContato(await leadDoSite({ canalRetorno: "email", telefone: "", email: " Ana@Empresa.com.BR " }));
    assert.ok(r.ok, `recusou: ${camposDe(r).join(", ")}`);
    assert.equal(r.dados.email, "ana@empresa.com.br");
    assert.equal(r.dados.telefone, null);
  });

  test("canal Ligação: melhor horário guardado", async () => {
    const r = validarContato(await leadDoSite({ canalRetorno: "ligacao" }));
    assert.ok(r.ok, `recusou: ${camposDe(r).join(", ")}`);
    assert.equal(r.dados.melhorHorario, "Manhã");
  });

  test("marketing aceito fica true", async () => {
    const r = validarContato(await leadDoSite({ marketingAceito: true }));
    assert.ok(r.ok);
    assert.equal(r.dados.marketingAceito, true);
  });
});

describe("contato: campo inválido devolve o nome que a tela conhece", () => {
  test("cada regra do site, um campo por vez", async () => {
    assert.deepEqual(camposDe(validarContato(await leadDoSite({ nome: "A" }))), ["nome"]);
    assert.deepEqual(camposDe(validarContato(await leadDoSite({ telefone: "" }))), ["telefone"]);
    assert.deepEqual(camposDe(validarContato(await leadDoSite({ canalRetorno: "ligacao", telefone: "123" }))), ["telefone"]);
    assert.deepEqual(camposDe(validarContato(await leadDoSite({ canalRetorno: "email", telefone: "", email: "ana@x" }))), ["email"]);
    assert.deepEqual(camposDe(validarContato(await leadDoSite({ email: "ana@x" }))), ["email"], "e-mail opcional, se vier, tem de ser válido");
    assert.deepEqual(camposDe(validarContato(await leadDoSite({ canalRetorno: "email", telefone: "123", email: "a@b.co" }))), ["telefone"]);
    assert.deepEqual(camposDe(validarContato({ ...(await leadDoSite()), politicaCiente: false })), ["politicaCiente"]);
  });

  test("vários campos saem na ordem da tela: nome, telefone, e-mail, ciência", async () => {
    const corpo = { ...(await leadDoSite({ nome: " ", telefone: "", email: "x" })), politicaCiente: false };
    assert.deepEqual(camposDe(validarContato(corpo)), ["nome", "telefone", "email", "politicaCiente"]);
  });

  test("campo de contrato quebrado também volta, depois dos campos da tela", async () => {
    const base = await leadDoSite();
    const casos: [Corpo, string][] = [
      [{ versaoContrato: 1 }, "versaoContrato"],
      [{ origem: "plataforma" }, "origem"],
      [{ idEnvio: "curto" }, "idEnvio"],
      [{ idEnvio: 123 }, "idEnvio"],
      [{ canalRetorno: "sms" }, "canalRetorno"],
      [{ politicaCienteEm: "ontem" }, "politicaCienteEm"],
      [{ preenchidoEmMs: "8000" }, "preenchidoEmMs"],
      [{ marketingAceito: "sim" }, "marketingAceito"],
      [{ marketingAceito: true, marketingTextoVersao: "" }, "marketingTextoVersao"],
      [{ politicaVersao: "  " }, "politicaVersao"],
    ];
    for (const [troca, campo] of casos) {
      assert.deepEqual(camposDe(validarContato({ ...base, ...troca })), [campo], JSON.stringify(troca));
    }
    assert.deepEqual(camposDe(validarContato({ ...base, nome: "A", versaoContrato: 9 })), ["nome", "versaoContrato"]);
  });

  test("corpo que não é objeto", () => {
    for (const corpo of [null, undefined, [], "texto", 42]) {
      assert.deepEqual(camposDe(validarContato(corpo)), ["corpo"], String(corpo));
    }
  });
});

describe("robô: isca e tempo, antes da validação", () => {
  test("isca preenchida ou tempo abaixo de 1200 é robô", async () => {
    const base = await leadDoSite();
    assert.equal(TEMPO_MINIMO_MS, 1200);
    assert.equal(ehRoboDeFormulario({ ...base, website: "https://spam.example" }), true);
    assert.equal(ehRoboDeFormulario({ ...base, website: 0 }), true, "qualquer valor não vazio conta");
    assert.equal(ehRoboDeFormulario({ ...base, preenchidoEmMs: 1199 }), true);
    assert.equal(ehRoboDeFormulario({ ...base, preenchidoEmMs: 0 }), true);
  });

  test("isca vazia, tempo de 1200 ou mais, ou tempo ausente não é robô", async () => {
    const base = await leadDoSite();
    assert.equal(ehRoboDeFormulario(base), false);
    assert.equal(ehRoboDeFormulario({ ...base, website: "   " }), false);
    assert.equal(ehRoboDeFormulario({ ...base, website: null }), false);
    assert.equal(ehRoboDeFormulario({ ...base, preenchidoEmMs: 1200 }), false);
    assert.equal(ehRoboDeFormulario({ ...base, preenchidoEmMs: "rápido" }), false, "tipo errado vai para a validação");
    assert.equal(ehRoboDeFormulario(null), false);
  });

  test("protocolo do robô: o idEnvio se for válido, senão 'descartado'", () => {
    assert.equal(protocoloDe({ idEnvio: "3f9c2a1e-7b4d-4e8a-9c1f-2d6e8b0a4c5f" }), "3f9c2a1e-7b4d-4e8a-9c1f-2d6e8b0a4c5f");
    assert.equal(protocoloDe({ idEnvio: "<script>" }), "descartado");
    assert.equal(protocoloDe(null), "descartado");
  });
});

describe("corte e limpeza: nunca 422", () => {
  test("textos longos são cortados no limite de cada coluna", async () => {
    const r = validarContato(
      await leadDoSite({ empresa: "e".repeat(300), mensagem: "linha\r\n".repeat(600) }, { atribuicao: { ...ATRIBUICAO, utm: { ...ATRIBUICAO.utm, source: "s".repeat(500) } } })
    );
    assert.ok(r.ok, `recusou: ${camposDe(r).join(", ")}`);
    assert.equal(r.dados.empresa?.length, 120);
    assert.equal(r.dados.mensagem?.length, 2000);
    assert.ok(!r.dados.mensagem?.includes("\r"), "CRLF vira LF");
    assert.ok(r.dados.mensagem?.includes("\n"), "quebra de linha preservada");
    assert.equal(r.dados.utmSource?.length, 200);
  });

  test("NUL e controle saem; quebra de linha em campo de uma linha vira espaço", async () => {
    const r = validarContato(await leadDoSite({ nome: "Ana\u0000 Souza", empresa: "Loja\nda Ana" }));
    assert.ok(r.ok);
    assert.equal(r.dados.nome, "Ana Souza");
    assert.equal(r.dados.empresa, "Loja da Ana");
  });

  test("corte não deixa emoji pela metade", async () => {
    const r = validarContato(await leadDoSite({ empresa: "a".repeat(119) + "😀" }));
    assert.ok(r.ok);
    assert.equal(r.dados.empresa, "a".repeat(119));
  });

  test("chave desconhecida é ignorada; texto com tipo errado vira nulo", async () => {
    const r = validarContato({ ...(await leadDoSite()), extra: "x", dor: 42, procura: { a: 1 } });
    assert.ok(r.ok, `recusou: ${camposDe(r).join(", ")}`);
    assert.equal(r.dados.dor, null);
    assert.equal(r.dados.procura, null);
  });

  test("versão de política comprida é cortada, não recusada", async () => {
    const r = validarContato({ ...(await leadDoSite()), politicaVersao: "v".repeat(80) });
    assert.ok(r.ok);
    assert.equal(r.dados.politicaVersao.length, 60);
  });

  test("tempo enorme é limitado ao inteiro de 32 bits; data inválida de envio vira nula", async () => {
    const r = validarContato({ ...(await leadDoSite()), preenchidoEmMs: 9_999_999_999.7, enviadoEm: "quando" });
    assert.ok(r.ok);
    assert.equal(r.dados.preenchidoEmMs, 2_147_483_647);
    assert.equal(r.dados.enviadoEm, null);
  });

  test("o campo whatsapp do corpo é ignorado: o telefone vale", async () => {
    const r = validarContato({ ...(await leadDoSite()), whatsapp: "11999999999" });
    assert.ok(r.ok);
    assert.equal(r.dados.telefone, "34991775784");
  });
});

describe("lista de interesse", () => {
  test("o que o site manda hoje passa", async () => {
    const r = validarInteresse(await interesseDoSite());
    assert.ok(r.ok, `recusou: ${camposDe(r).join(", ")}`);
    const d = r.dados;
    assert.equal(d.tipo, "interesse");
    assert.equal(d.email, "ana@empresa.com.br");
    assert.equal(d.finalidade, "aviso_abertura_plataforma");
    assert.equal(d.marketingAceito, true);
    assert.equal(d.marketingTextoVersao, "interesse-marketing-v1");
    assert.equal(d.cienciaTextoVersao, "interesse-ciencia-v1");
    assert.equal(d.pagina, "/plataforma/");
    assert.equal(d.nome, null);
    assert.equal(d.telefone, null);
    assert.equal(d.canalRetorno, null);
  });

  test("campos da tela e de contrato", async () => {
    assert.deepEqual(camposDe(validarInteresse(await interesseDoSite({ email: "ana@" }))), ["email"]);
    assert.deepEqual(camposDe(validarInteresse({ ...(await interesseDoSite()), politicaCiente: false })), ["politicaCiente"]);
    assert.deepEqual(camposDe(validarInteresse({ ...(await interesseDoSite()), email: `${"a".repeat(160)}@b.co` })), ["email"], "e-mail acima de 160");
    assert.deepEqual(camposDe(validarInteresse({ ...(await interesseDoSite()), email: "a\u0001b@c.co" })), ["email"], "caractere de controle");
    assert.deepEqual(camposDe(validarInteresse({ ...(await interesseDoSite()), versaoContrato: 2 })), ["versaoContrato"]);
    assert.deepEqual(camposDe(validarInteresse({ ...(await interesseDoSite()), finalidade: "outra" })), ["finalidade"]);
    assert.deepEqual(camposDe(validarInteresse({ ...(await interesseDoSite()), origem: "contato" })), ["origem"]);
  });

  test("um corpo de contato não passa pela lista, nem o contrário", async () => {
    assert.ok(!validarInteresse(await leadDoSite()).ok);
    assert.ok(!validarContato(await interesseDoSite()).ok);
  });
});

// Gerador com semente fixa (mulberry32): o mesmo conjunto de casos em toda execução.
function gerador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function textoAleatorio(aleatorio: () => number, alfabeto: string, max: number): string {
  const tamanho = Math.floor(aleatorio() * (max + 1));
  let s = "";
  for (let i = 0; i < tamanho; i++) s += alfabeto[Math.floor(aleatorio() * alfabeto.length)];
  return s;
}

describe("paridade com o site: o servidor nunca é mais rígido", () => {
  test("validarEmail igual ao do site em 2500 casos", async () => {
    const site = await doSite<ValidacaoDoSite>("validacao.js");
    const aleatorio = gerador(20261010);
    for (let i = 0; i < 2500; i++) {
      const email = textoAleatorio(aleatorio, "ab@.-_+ çã\t1", 14);
      assert.equal(validarEmail(email), site.validarEmail(email), JSON.stringify(email));
    }
  });

  test("normalizarTelefone igual ao do site em 2500 casos", async () => {
    const site = await doSite<ValidacaoDoSite>("validacao.js");
    const aleatorio = gerador(55);
    for (let i = 0; i < 2500; i++) {
      const telefone = textoAleatorio(aleatorio, "0123456789555 ()-+", 18);
      assert.equal(normalizarTelefone(telefone), site.normalizarTelefone(telefone), JSON.stringify(telefone));
    }
  });
});
