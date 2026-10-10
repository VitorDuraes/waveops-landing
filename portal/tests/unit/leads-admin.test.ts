import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TAMANHO_MAXIMO_BUSCA,
  assuntosDoLead,
  avisoTitularApagado,
  confirmacaoDoTitular,
  ehJson,
  ehStatusLead,
  filtrarLeads,
  formatarDataHora,
  formatarTelefone,
  interpretarBusca,
  lerAlvoDoTitular,
  lerFiltroDaBusca,
  linkWhatsapp,
  linkWhatsappDoLead,
  montarUrlDeLeads,
  resumoDaLista,
  resumoUtm,
  rotuloCanal,
  rotuloFinalidade,
  rotuloTipo,
  statusDoCorpo,
  type FiltroLeads,
  type LeadDto,
} from "../../src/lib/leads-admin";
import { statusMeta } from "../../src/lib/format";
import { ADMIN_NAV, PAGE_META } from "../../src/lib/nav";

// Testes das funções puras da tela de leads do admin. Rodam sem banco e sem servidor:
// `npm run test:unit`. As rotas e o acesso ao Prisma (src/server/leads-admin.ts) não
// entram aqui porque o `server-only` não resolve fora do Next.

function lead(parcial: Partial<LeadDto> = {}): LeadDto {
  return {
    id: "l1",
    tipo: "contato",
    status: "novo",
    nome: "João da Silva",
    empresa: "Silva Consultoria",
    email: "joao@silva.com.br",
    telefone: "11912345678",
    canalRetorno: "whatsapp",
    melhorHorario: null,
    procura: "Automação de processos",
    dor: "Follow-up manual",
    mensagem: null,
    finalidade: null,
    politicaVersao: "2026-10",
    cienciaTextoVersao: "ciencia-v1",
    marketingAceito: false,
    marketingTextoVersao: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    referrer: null,
    landingUrl: null,
    primeiraFonte: null,
    pagina: "/contato/",
    createdAt: "2026-10-10T17:32:00.000Z",
    atendidoEm: null,
    ...parcial,
  };
}

describe("formatarTelefone: máscara brasileira", () => {
  test("deve formatar celular de 11 dígitos quando o número vem só com dígitos", () => {
    assert.equal(formatarTelefone("11912345678"), "(11) 91234-5678");
  });

  test("deve formatar fixo de 10 dígitos quando o número não tem o nono dígito", () => {
    assert.equal(formatarTelefone("1123456789"), "(11) 2345-6789");
  });

  test("deve tirar o 55 quando o número chega com o código do país", () => {
    assert.equal(formatarTelefone("5511912345678"), "(11) 91234-5678");
  });

  test("deve tirar o 55 de um fixo quando o número chega com 12 dígitos", () => {
    assert.equal(formatarTelefone("551123456789"), "(11) 2345-6789");
  });

  test("deve manter o DDD 55 quando o número tem 11 dígitos", () => {
    assert.equal(formatarTelefone("55991234567"), "(55) 99123-4567");
  });

  test("deve devolver só os dígitos quando o número de 12 dígitos não começa com 55", () => {
    assert.equal(formatarTelefone("111234567890"), "111234567890");
    assert.equal(linkWhatsapp("111234567890"), null);
  });

  test("deve ignorar a máscara quando o número já vem formatado", () => {
    assert.equal(formatarTelefone("(11) 91234-5678"), "(11) 91234-5678");
  });

  test("deve devolver só os dígitos quando o tamanho foge do padrão", () => {
    assert.equal(formatarTelefone("12345"), "12345");
  });

  test("deve devolver vazio quando não há telefone", () => {
    assert.equal(formatarTelefone(null), "");
    assert.equal(formatarTelefone(undefined), "");
    assert.equal(formatarTelefone(""), "");
  });
});

describe("linkWhatsapp: link de conversa", () => {
  test("deve montar o link com 55 na frente quando o telefone tem 11 dígitos", () => {
    assert.equal(linkWhatsapp("11912345678"), "https://wa.me/5511912345678");
  });

  test("deve montar o link quando o telefone tem 10 dígitos", () => {
    assert.equal(linkWhatsapp("1123456789"), "https://wa.me/551123456789");
  });

  test("deve manter um 55 só quando o telefone já chega com o código do país", () => {
    assert.equal(linkWhatsapp("5511912345678"), "https://wa.me/5511912345678");
  });

  test("deve tratar 55 como DDD quando o número tem 11 dígitos", () => {
    assert.equal(linkWhatsapp("55991234567"), "https://wa.me/5555991234567");
  });

  test("deve devolver null quando o telefone não serve para conversa", () => {
    assert.equal(linkWhatsapp("123"), null);
    assert.equal(linkWhatsapp(""), null);
    assert.equal(linkWhatsapp(null), null);
    assert.equal(linkWhatsapp(undefined), null);
  });
});

describe("formatarDataHora: hora de Brasília", () => {
  test("deve converter de UTC para Brasília quando recebe uma data ISO", () => {
    assert.equal(formatarDataHora("2026-10-10T17:32:00.000Z"), "10/10/2026 14:32");
  });

  test("deve mostrar 00:00 e não 24:00 quando é meia-noite em Brasília", () => {
    assert.equal(formatarDataHora("2026-10-10T03:00:00.000Z"), "10/10/2026 00:00");
  });

  test("deve manter o dia de Brasília quando o UTC já virou o dia", () => {
    assert.equal(formatarDataHora("2026-10-11T02:59:00.000Z"), "10/10/2026 23:59");
  });

  test("deve devolver vazio quando a data é inválida ou ausente", () => {
    assert.equal(formatarDataHora("lixo"), "");
    assert.equal(formatarDataHora(""), "");
    assert.equal(formatarDataHora(null), "");
    assert.equal(formatarDataHora(undefined), "");
  });
});

describe("rótulos", () => {
  test("deve chamar de Lista o lead do tipo interesse", () => {
    assert.equal(rotuloTipo("contato"), "Contato");
    assert.equal(rotuloTipo("interesse"), "Lista");
  });

  test("deve traduzir os três canais de retorno do site", () => {
    assert.equal(rotuloCanal("whatsapp"), "WhatsApp");
    assert.equal(rotuloCanal("email"), "E-mail");
    assert.equal(rotuloCanal("ligacao"), "Ligação");
  });

  test("deve devolver o valor cru quando o canal é desconhecido, sem herdar do objeto", () => {
    assert.equal(rotuloCanal("carta"), "carta");
    assert.equal(rotuloCanal("constructor"), "constructor");
    assert.equal(rotuloCanal("__proto__"), "__proto__");
  });

  test("deve devolver vazio quando não há canal", () => {
    assert.equal(rotuloCanal(null), "");
    assert.equal(rotuloCanal(undefined), "");
  });

  test("deve traduzir a finalidade da lista e manter a desconhecida", () => {
    assert.equal(rotuloFinalidade("aviso_abertura_plataforma"), "Aviso de abertura da Plataforma");
    assert.equal(rotuloFinalidade("outra_coisa"), "outra_coisa");
    assert.equal(rotuloFinalidade(null), "");
  });
});

describe("assuntosDoLead: o que aparece na coluna Assunto", () => {
  test("deve listar o que procura e depois o que mais pesa quando o contato traz os dois", () => {
    assert.deepEqual(assuntosDoLead(lead()), ["Automação de processos", "Follow-up manual"]);
  });

  test("deve listar só o que existe quando falta um dos dois", () => {
    assert.deepEqual(assuntosDoLead(lead({ procura: null })), ["Follow-up manual"]);
    assert.deepEqual(assuntosDoLead(lead({ dor: "   " })), ["Automação de processos"]);
  });

  test("deve usar a finalidade quando é inscrição da lista, que não tem assunto", () => {
    const inscricao = lead({ tipo: "interesse", procura: null, dor: null, finalidade: "aviso_abertura_plataforma" });
    assert.deepEqual(assuntosDoLead(inscricao), ["Aviso de abertura da Plataforma"]);
  });

  test("deve devolver lista vazia quando não há assunto nem finalidade", () => {
    assert.deepEqual(assuntosDoLead(lead({ procura: null, dor: null, finalidade: null })), []);
  });
});

describe("resumoUtm: detalhe da origem", () => {
  test("deve listar uma linha por UTM preenchida", () => {
    const r = resumoUtm(lead({ utmSource: "google", utmMedium: "cpc", utmTerm: "automacao" }));
    assert.equal(r, "source: google\nmedium: cpc\nterm: automacao");
  });

  test("deve ignorar UTM vazia ou só com espaço", () => {
    assert.equal(resumoUtm(lead({ utmSource: "  ", utmCampaign: "", utmContent: "anuncio-1" })), "content: anuncio-1");
  });

  test("deve devolver vazio quando a pessoa chegou sem campanha", () => {
    assert.equal(resumoUtm(lead()), "");
  });
});

describe("resumoDaLista: linha de contagem do topo", () => {
  test("deve contar leads e novos quando não há filtro", () => {
    assert.equal(resumoDaLista(12, 12, 3), "12 leads · 3 novos");
  });

  test("deve usar o singular quando há um lead e um novo", () => {
    assert.equal(resumoDaLista(1, 1, 1), "1 lead · 1 novo");
  });

  test("deve mostrar zeros quando a lista está vazia", () => {
    assert.equal(resumoDaLista(0, 0, 0), "0 leads · 0 novos");
  });

  test("deve mostrar quantos aparecem do total quando há filtro ou busca", () => {
    assert.equal(resumoDaLista(12, 5, 3), "5 de 12 leads");
    assert.equal(resumoDaLista(1, 0, 1), "0 de 1 lead");
  });
});

describe("status do lead e corpo da rota", () => {
  test("deve aceitar só novo e atendido como status", () => {
    assert.equal(ehStatusLead("novo"), true);
    assert.equal(ehStatusLead("atendido"), true);
    assert.equal(ehStatusLead("NOVO"), false);
    assert.equal(ehStatusLead("apagado"), false);
    assert.equal(ehStatusLead(""), false);
    assert.equal(ehStatusLead(1), false);
    assert.equal(ehStatusLead(null), false);
    assert.equal(ehStatusLead(undefined), false);
  });

  test("deve ler o status quando o corpo é um objeto com status válido", () => {
    assert.equal(statusDoCorpo({ status: "atendido" }), "atendido");
    assert.equal(statusDoCorpo({ status: "novo", extra: true }), "novo");
  });

  test("deve devolver null quando o corpo não tem um status válido", () => {
    assert.equal(statusDoCorpo({}), null);
    assert.equal(statusDoCorpo({ status: "fechado" }), null);
    assert.equal(statusDoCorpo({ status: ["novo"] }), null);
    assert.equal(statusDoCorpo(null), null);
    assert.equal(statusDoCorpo(undefined), null);
    assert.equal(statusDoCorpo("atendido"), null);
    assert.equal(statusDoCorpo([{ status: "novo" }]), null);
  });
});

describe("filtrarLeads: tipo, status e busca", () => {
  const joao = lead({ id: "a" });
  const maria = lead({
    id: "b",
    nome: "Maria Souza",
    empresa: null,
    email: "maria@souza.com",
    telefone: "21987654321",
    status: "atendido",
  });
  const inscrito = lead({
    id: "c",
    tipo: "interesse",
    nome: null,
    empresa: null,
    email: "ana@exemplo.com.br",
    telefone: null,
    canalRetorno: null,
    procura: null,
    dor: null,
    finalidade: "aviso_abertura_plataforma",
  });
  const todos = [joao, maria, inscrito];
  const ids = (leads: LeadDto[]) => leads.map((l) => l.id);
  const sem = { tipo: "todos", status: "todos", busca: "" } as const;

  test("deve devolver todos os leads quando não há filtro nem busca", () => {
    assert.deepEqual(ids(filtrarLeads(todos, sem)), ["a", "b", "c"]);
  });

  test("deve filtrar por tipo quando o tipo é contato ou interesse", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, tipo: "contato" })), ["a", "b"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, tipo: "interesse" })), ["c"]);
  });

  test("deve filtrar por status quando o status é novo ou atendido", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, status: "novo" })), ["a", "c"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, status: "atendido" })), ["b"]);
  });

  test("deve combinar tipo, status e busca quando os três estão ativos", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { tipo: "contato", status: "novo", busca: "silva" })), ["a"]);
    assert.deepEqual(ids(filtrarLeads(todos, { tipo: "interesse", status: "atendido", busca: "" })), []);
  });

  test("deve achar o nome sem diferenciar acento nem caixa", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "joao" })), ["a"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "JOÃO DA" })), ["a"]);
  });

  test("deve achar pelo e-mail e pela empresa quando a busca é parte deles", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "souza.com" })), ["b"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "exemplo" })), ["c"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "consultoria" })), ["a"]);
  });

  test("deve achar pelo telefone quando a busca vem com máscara", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "(11) 91234" })), ["a"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "98765-4321" })), ["b"]);
  });

  test("deve achar pelo telefone quando a busca vem com o 55 na frente", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "+55 21 98765-4321" })), ["b"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "5511912345678" })), ["a"]);
  });

  test("deve ler como texto, e não como telefone, a busca que mistura letra e número", () => {
    // O telefone do João tem "2", mas "joao2" não é número de telefone.
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "joao2" })), []);
  });

  test("deve ignorar espaços nas pontas quando a busca é só espaço", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "   " })), ["a", "b", "c"]);
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "  maria  " })), ["b"]);
  });

  test("deve seguir sem erro quando o lead não tem telefone nem nome", () => {
    assert.deepEqual(ids(filtrarLeads(todos, { ...sem, busca: "11" })), ["a"]);
  });

  test("deve devolver lista vazia quando nada combina", () => {
    assert.deepEqual(filtrarLeads(todos, { ...sem, busca: "zzz" }), []);
  });

  test("deve devolver uma lista nova e deixar a original intacta", () => {
    const original = [joao, maria, inscrito];
    const r = filtrarLeads(original, { ...sem, tipo: "contato" });
    assert.notEqual(r, original);
    assert.equal(original.length, 3);
  });
});

describe("linkWhatsappDoLead: só no canal que a pessoa escolheu", () => {
  test("deve montar o link quando o canal é WhatsApp e o telefone é válido", () => {
    assert.equal(linkWhatsappDoLead(lead()), "https://wa.me/5511912345678");
  });

  test("deve devolver null quando o canal é ligação, mesmo com telefone válido", () => {
    assert.equal(linkWhatsappDoLead(lead({ canalRetorno: "ligacao" })), null);
  });

  test("deve devolver null quando o canal é e-mail", () => {
    assert.equal(linkWhatsappDoLead(lead({ canalRetorno: "email" })), null);
  });

  test("deve devolver null quando não há canal, como na lista de interesse", () => {
    assert.equal(linkWhatsappDoLead(lead({ canalRetorno: null, telefone: null })), null);
  });

  test("deve devolver null quando o canal é WhatsApp mas o telefone não serve", () => {
    assert.equal(linkWhatsappDoLead(lead({ telefone: null })), null);
    assert.equal(linkWhatsappDoLead(lead({ telefone: "123" })), null);
  });
});

describe("ehJson: Content-Type das rotas de escrita", () => {
  test("deve aceitar application/json com ou sem charset e em qualquer caixa", () => {
    assert.equal(ehJson("application/json"), true);
    assert.equal(ehJson("application/json; charset=utf-8"), true);
    assert.equal(ehJson("Application/JSON"), true);
    assert.equal(ehJson("  application/json ;charset=UTF-8"), true);
  });

  test("deve recusar os tipos que uma página de outra origem manda sem preflight", () => {
    assert.equal(ehJson("text/plain"), false);
    assert.equal(ehJson("text/plain;charset=UTF-8"), false);
    assert.equal(ehJson("application/x-www-form-urlencoded"), false);
    assert.equal(ehJson("multipart/form-data; boundary=----x"), false);
  });

  test("deve recusar quando falta o cabeçalho", () => {
    assert.equal(ehJson(null), false);
    assert.equal(ehJson(undefined), false);
    assert.equal(ehJson(""), false);
  });

  test("deve recusar tipos parecidos que não são application/json", () => {
    assert.equal(ehJson("application/jsonp"), false);
    assert.equal(ehJson("application/json5"), false);
    assert.equal(ehJson("application/vnd.api+json"), false);
    assert.equal(ehJson("text/json"), false);
  });
});

describe("interpretarBusca: o que o servidor procura", () => {
  test("deve tratar como e-mail exato, em minúsculas, o que tem arroba", () => {
    assert.deepEqual(interpretarBusca("JOAO@Silva.com.br"), { tipo: "email", valor: "joao@silva.com.br" });
    assert.deepEqual(interpretarBusca("  joao@silva.com.br  "), { tipo: "email", valor: "joao@silva.com.br" });
  });

  test("deve tratar como e-mail mesmo o que ainda está incompleto, sem virar busca por nome", () => {
    assert.deepEqual(interpretarBusca("joao@"), { tipo: "email", valor: "joao@" });
  });

  test("deve normalizar o telefone quando a busca tem máscara, espaço ou o 55", () => {
    assert.deepEqual(interpretarBusca("(11) 91234-5678"), { tipo: "telefone", valor: "11912345678" });
    assert.deepEqual(interpretarBusca("+55 11 91234-5678"), { tipo: "telefone", valor: "11912345678" });
    assert.deepEqual(interpretarBusca("11912345678"), { tipo: "telefone", valor: "11912345678" });
    assert.deepEqual(interpretarBusca("5511912345678"), { tipo: "telefone", valor: "11912345678" });
    assert.deepEqual(interpretarBusca("(21) 3333-4444"), { tipo: "telefone", valor: "2133334444" });
  });

  test("deve tratar como texto o número que não tem o tamanho de um telefone", () => {
    assert.deepEqual(interpretarBusca("1234"), { tipo: "texto", valor: "1234" });
    assert.deepEqual(interpretarBusca("123456789"), { tipo: "texto", valor: "123456789" });
    assert.deepEqual(interpretarBusca("12345678901234"), { tipo: "texto", valor: "12345678901234" });
  });

  test("deve tratar como texto o que mistura letra e número", () => {
    assert.deepEqual(interpretarBusca("joao2"), { tipo: "texto", valor: "joao2" });
    assert.deepEqual(interpretarBusca("Loja 24h"), { tipo: "texto", valor: "Loja 24h" });
  });

  test("deve manter a caixa do texto, porque quem ignora a caixa é o banco", () => {
    assert.deepEqual(interpretarBusca("  Silva & Filhos "), { tipo: "texto", valor: "Silva & Filhos" });
  });

  test("deve devolver null quando a busca está vazia", () => {
    assert.equal(interpretarBusca(""), null);
    assert.equal(interpretarBusca("   "), null);
  });

  test("deve cortar a busca no tamanho máximo", () => {
    const r = interpretarBusca("a".repeat(TAMANHO_MAXIMO_BUSCA + 50));
    assert.equal(r?.tipo, "texto");
    assert.equal(r?.valor.length, TAMANHO_MAXIMO_BUSCA);
  });
});

describe("lerFiltroDaBusca: parâmetros de GET /api/leads", () => {
  const ler = (consulta: string) => lerFiltroDaBusca(new URLSearchParams(consulta));

  test("deve devolver tudo como todos quando não há parâmetro", () => {
    assert.deepEqual(ler(""), { ok: true, filtro: { tipo: "todos", status: "todos", busca: "" } });
  });

  test("deve ler tipo, status e busca quando os valores são válidos", () => {
    assert.deepEqual(ler("tipo=contato&status=novo&busca=maria"), {
      ok: true,
      filtro: { tipo: "contato", status: "novo", busca: "maria" },
    });
    assert.deepEqual(ler("tipo=interesse&status=atendido"), {
      ok: true,
      filtro: { tipo: "interesse", status: "atendido", busca: "" },
    });
  });

  test("deve tratar vazio e todos como sem filtro", () => {
    assert.deepEqual(ler("tipo=&status=todos"), { ok: true, filtro: { tipo: "todos", status: "todos", busca: "" } });
  });

  test("deve recusar tipo e status fora da lista, para um typo não virar sem filtro", () => {
    assert.deepEqual(ler("tipo=lista"), { ok: false, erro: "Tipo inválido. Use: contato ou interesse." });
    assert.deepEqual(ler("status=NOVO"), { ok: false, erro: "Status inválido. Use: novo ou atendido." });
  });

  test("deve tirar os espaços da busca e cortar no tamanho máximo", () => {
    assert.deepEqual(ler("busca=%20%20joao%20%20"), { ok: true, filtro: { tipo: "todos", status: "todos", busca: "joao" } });
    const longa = ler("busca=" + "a".repeat(TAMANHO_MAXIMO_BUSCA + 10));
    assert.ok(longa.ok && longa.filtro.busca.length === TAMANHO_MAXIMO_BUSCA);
  });
});

describe("montarUrlDeLeads: URL que a tela chama", () => {
  const sem: FiltroLeads = { tipo: "todos", status: "todos", busca: "" };

  test("deve devolver a rota pura quando nada filtra", () => {
    assert.equal(montarUrlDeLeads(sem), "/api/leads");
    assert.equal(montarUrlDeLeads({ ...sem, busca: "   " }), "/api/leads");
  });

  test("deve incluir só o que filtra", () => {
    assert.equal(montarUrlDeLeads({ ...sem, tipo: "contato" }), "/api/leads?tipo=contato");
    assert.equal(montarUrlDeLeads({ ...sem, status: "novo", busca: "maria" }), "/api/leads?status=novo&busca=maria");
  });

  test("deve codificar a busca quando tem arroba, espaço, e comercial ou acento", () => {
    assert.equal(montarUrlDeLeads({ ...sem, busca: "joao@silva.com.br" }), "/api/leads?busca=joao%40silva.com.br");
    assert.equal(montarUrlDeLeads({ ...sem, busca: "Silva & Filhos" }), "/api/leads?busca=Silva+%26+Filhos");
  });

  test("deve voltar igual depois de lida pela rota", () => {
    const filtros: FiltroLeads[] = [
      sem,
      { tipo: "contato", status: "atendido", busca: "João D'Ávila & Cia" },
      { tipo: "interesse", status: "todos", busca: "joao@silva.com.br" },
      { tipo: "todos", status: "novo", busca: "+55 (11) 91234-5678" },
      { tipo: "todos", status: "todos", busca: "100% 50_50 a+b=c?" },
    ];
    for (const filtro of filtros) {
      const url = new URL(montarUrlDeLeads(filtro), "http://localhost");
      assert.deepEqual(lerFiltroDaBusca(url.searchParams), { ok: true, filtro });
    }
  });
});

describe("lerAlvoDoTitular: corpo de POST /api/leads/apagar-titular", () => {
  test("deve normalizar o e-mail quando só ele vem", () => {
    assert.deepEqual(lerAlvoDoTitular({ email: "  JOAO@Silva.com.br " }), { ok: true, alvo: { email: "joao@silva.com.br" } });
  });

  test("deve normalizar o telefone, sem máscara e sem o 55, quando só ele vem", () => {
    assert.deepEqual(lerAlvoDoTitular({ telefone: "(11) 91234-5678" }), { ok: true, alvo: { telefone: "11912345678" } });
    assert.deepEqual(lerAlvoDoTitular({ telefone: "+55 11 91234-5678" }), { ok: true, alvo: { telefone: "11912345678" } });
  });

  test("deve aceitar os dois campos juntos", () => {
    assert.deepEqual(lerAlvoDoTitular({ email: "a@b.com", telefone: "11912345678" }), {
      ok: true,
      alvo: { email: "a@b.com", telefone: "11912345678" },
    });
  });

  test("deve tratar nulo, vazio e só espaço como campo ausente", () => {
    assert.deepEqual(lerAlvoDoTitular({ email: null, telefone: "11912345678" }), { ok: true, alvo: { telefone: "11912345678" } });
    assert.deepEqual(lerAlvoDoTitular({ email: "a@b.com", telefone: "  " }), { ok: true, alvo: { email: "a@b.com" } });
  });

  test("deve exigir pelo menos um dos dois campos", () => {
    const erro = { ok: false, erro: "Informe o e-mail ou o telefone do titular." };
    assert.deepEqual(lerAlvoDoTitular({}), erro);
    assert.deepEqual(lerAlvoDoTitular({ email: "", telefone: "  " }), erro);
    assert.deepEqual(lerAlvoDoTitular({ email: null, telefone: null }), erro);
    assert.deepEqual(lerAlvoDoTitular({ nome: "João" }), erro);
  });

  test("deve recusar corpo que não é objeto", () => {
    for (const corpo of [null, undefined, "a@b.com", 42, ["a@b.com"], true]) {
      const r = lerAlvoDoTitular(corpo);
      assert.equal(r.ok, false, JSON.stringify(corpo));
    }
  });

  test("deve recusar e-mail inválido, ou que não é texto, mesmo com telefone válido", () => {
    assert.deepEqual(lerAlvoDoTitular({ email: "sem-arroba" }), { ok: false, erro: "E-mail inválido." });
    assert.deepEqual(lerAlvoDoTitular({ email: 123 }), { ok: false, erro: "E-mail inválido." });
    assert.deepEqual(lerAlvoDoTitular({ email: "a b@c.com", telefone: "11912345678" }), { ok: false, erro: "E-mail inválido." });
  });

  test("deve recusar telefone inválido, ou que não é texto, mesmo com e-mail válido", () => {
    assert.deepEqual(lerAlvoDoTitular({ telefone: "123" }), { ok: false, erro: "Telefone inválido." });
    assert.deepEqual(lerAlvoDoTitular({ telefone: 11912345678 }), { ok: false, erro: "Telefone inválido." });
    assert.deepEqual(lerAlvoDoTitular({ email: "a@b.com", telefone: "abc" }), { ok: false, erro: "Telefone inválido." });
  });
});

describe("textos de apagar o titular", () => {
  test("deve dizer quantos leads saem e de qual e-mail", () => {
    assert.equal(
      confirmacaoDoTitular("email", "joao@silva.com.br", 3),
      "Apagar 3 leads do e-mail joao@silva.com.br a pedido do titular? Não dá para desfazer."
    );
  });

  test("deve usar o singular e formatar o telefone quando é um lead de um telefone", () => {
    assert.equal(
      confirmacaoDoTitular("telefone", "11912345678", 1),
      "Apagar 1 lead do telefone (11) 91234-5678 a pedido do titular? Não dá para desfazer."
    );
  });

  test("deve avisar com o número apagado, no singular e no plural", () => {
    assert.equal(avisoTitularApagado(1), "1 lead apagado");
    assert.equal(avisoTitularApagado(4), "4 leads apagados");
  });
});

describe("pontos de ligação com o resto do portal", () => {
  test("deve ter selos para novo e atendido quando o StatusBadge pede o rótulo", () => {
    assert.deepEqual(statusMeta("novo"), ["accent", "Novo"]);
    assert.deepEqual(statusMeta("atendido"), ["ok", "Atendido"]);
  });

  test("deve listar Leads logo depois de Clientes no menu do admin", () => {
    const hrefs = ADMIN_NAV.flatMap((e) => ("href" in e ? [e.href] : []));
    const i = hrefs.indexOf("/admin/clientes");
    assert.ok(i >= 0);
    assert.equal(hrefs[i + 1], "/admin/leads");
    const item = ADMIN_NAV.find((e) => "href" in e && e.href === "/admin/leads");
    assert.ok(item && "icon" in item);
    assert.equal(item.icon, "inbox");
    assert.equal(item.label, "Leads");
  });

  test("deve ter título de página para /admin/leads", () => {
    assert.equal(PAGE_META["/admin/leads"]?.title, "Leads");
  });
});
