import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TAMANHO_MAXIMO_BUSCA,
  assuntosDoLead,
  avisoTitularApagado,
  confirmacaoDoTitular,
  ehJson,
  ehStatusLead,
  escaparCuringasLike,
  formatarDataHora,
  formatarTelefone,
  interpretarBusca,
  lerAlvoDoTitular,
  lerConsulta,
  linkWhatsapp,
  linkWhatsappDoLead,
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
    assert.equal(resumoDaLista(12, 3, false), "12 leads · 3 novos");
  });

  test("deve usar o singular quando há um lead e um novo", () => {
    assert.equal(resumoDaLista(1, 1, false), "1 lead · 1 novo");
  });

  test("deve mostrar zeros quando a lista está vazia", () => {
    assert.equal(resumoDaLista(0, 0, false), "0 leads · 0 novos");
  });

  test("deve dizer encontrados quando há filtro ou busca", () => {
    assert.equal(resumoDaLista(5, 2, true), "5 leads encontrados · 2 novos");
    assert.equal(resumoDaLista(1, 0, true), "1 lead encontrado · 0 novos");
    assert.equal(resumoDaLista(0, 0, true), "0 leads encontrados · 0 novos");
  });

  test("deve separar os milhares quando o total passa de mil", () => {
    assert.equal(resumoDaLista(1234, 1000, false), "1.234 leads · 1.000 novos");
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

describe("escaparCuringasLike: o texto digitado vira texto no ILIKE", () => {
  test("deve escapar o percentual, o sublinhado e a barra invertida", () => {
    assert.equal(escaparCuringasLike("100%"), "100\\%");
    assert.equal(escaparCuringasLike("loja_24"), "loja\\_24");
    assert.equal(escaparCuringasLike("a\\b"), "a\\\\b");
    assert.equal(escaparCuringasLike("x\\%y"), "x\\\\\\%y");
    assert.equal(escaparCuringasLike("%_%"), "\\%\\_\\%");
  });

  test("deve deixar como está o texto sem curinga", () => {
    assert.equal(escaparCuringasLike("Silva & Filhos"), "Silva & Filhos");
    assert.equal(escaparCuringasLike("João D'Ávila"), "João D'Ávila");
    assert.equal(escaparCuringasLike(""), "");
  });
});

describe("lerConsulta: corpo de POST /api/leads/consulta", () => {
  test("deve devolver tudo como todos quando o corpo não tem campo", () => {
    assert.deepEqual(lerConsulta({}), { ok: true, filtro: { tipo: "todos", status: "todos", busca: "" } });
  });

  test("deve ler tipo, status e busca quando os valores são válidos", () => {
    assert.deepEqual(lerConsulta({ tipo: "contato", status: "novo", busca: "maria" }), {
      ok: true,
      filtro: { tipo: "contato", status: "novo", busca: "maria" },
    });
    assert.deepEqual(lerConsulta({ tipo: "interesse", status: "atendido" }), {
      ok: true,
      filtro: { tipo: "interesse", status: "atendido", busca: "" },
    });
  });

  test("deve tratar nulo, vazio, só espaço e todos como sem filtro", () => {
    const sem = { ok: true, filtro: { tipo: "todos", status: "todos", busca: "" } };
    assert.deepEqual(lerConsulta({ tipo: null, status: null, busca: null }), sem);
    assert.deepEqual(lerConsulta({ tipo: "", status: "  ", busca: "   " }), sem);
    assert.deepEqual(lerConsulta({ tipo: "todos", status: "todos", busca: "" }), sem);
  });

  test("deve tirar os espaços de tipo, status e busca", () => {
    assert.deepEqual(lerConsulta({ tipo: " contato ", status: " novo", busca: "  joao  " }), {
      ok: true,
      filtro: { tipo: "contato", status: "novo", busca: "joao" },
    });
  });

  test("deve recusar tipo e status fora da lista, para um typo não virar sem filtro", () => {
    assert.deepEqual(lerConsulta({ tipo: "lista" }), { ok: false, erro: "Tipo inválido. Use: contato ou interesse." });
    assert.deepEqual(lerConsulta({ status: "NOVO" }), { ok: false, erro: "Status inválido. Use: novo ou atendido." });
  });

  test("deve recusar tipo e status que não são texto", () => {
    assert.equal(lerConsulta({ tipo: 1 }).ok, false);
    assert.equal(lerConsulta({ tipo: ["contato"] }).ok, false);
    assert.equal(lerConsulta({ status: false }).ok, false);
    assert.equal(lerConsulta({ status: {} }).ok, false);
  });

  test("deve recusar busca que não é texto", () => {
    const erro = { ok: false, erro: "Busca inválida. Envie texto." };
    assert.deepEqual(lerConsulta({ busca: 123 }), erro);
    assert.deepEqual(lerConsulta({ busca: ["a@b.com"] }), erro);
    assert.deepEqual(lerConsulta({ busca: { email: "a@b.com" } }), erro);
    assert.deepEqual(lerConsulta({ busca: false }), erro);
  });

  test("deve cortar a busca no tamanho máximo", () => {
    const r = lerConsulta({ busca: "a".repeat(TAMANHO_MAXIMO_BUSCA + 10) });
    assert.ok(r.ok && r.filtro.busca.length === TAMANHO_MAXIMO_BUSCA);
  });

  test("deve recusar corpo que não é objeto", () => {
    for (const corpo of [null, undefined, "maria", 42, ["maria"], true]) {
      assert.equal(lerConsulta(corpo).ok, false, JSON.stringify(corpo));
    }
  });

  test("deve ler igual o que a tela manda, depois de passar por JSON", () => {
    const filtros: FiltroLeads[] = [
      { tipo: "todos", status: "todos", busca: "" },
      { tipo: "contato", status: "atendido", busca: "João D'Ávila & Cia" },
      { tipo: "interesse", status: "todos", busca: "joao@silva.com.br" },
      { tipo: "todos", status: "novo", busca: "+55 (11) 91234-5678" },
      { tipo: "todos", status: "todos", busca: "100% 50_50 a+b=c?" },
    ];
    for (const filtro of filtros) {
      assert.deepEqual(lerConsulta(JSON.parse(JSON.stringify(filtro))), { ok: true, filtro });
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
