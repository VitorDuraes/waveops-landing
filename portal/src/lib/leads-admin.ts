// Tipos e funções puras da tela de leads do admin (/admin/leads). Sem banco e sem
// framework: roda na rota, no navegador e nos testes (tests/unit/leads-admin.test.ts).

// As regras de telefone e de e-mail (normalização e validade) são as de quem grava o
// lead, em lib/leads.ts: o que a busca e a exclusão procuram é o que foi gravado.
import { normalizarEmail, normalizarTelefone, soDigitos, validarEmail, validarTelefone } from "./leads";

export type LeadTipo = "contato" | "interesse";
export type LeadStatus = "novo" | "atendido";

// Teto de leads por resposta de POST /api/leads/consulta, do mais recente para o mais antigo. O
// servidor aplica os filtros e a busca antes do corte, e o total do que combina volta
// junto: um lead antigo se acha pela busca, e a tela avisa quando algo ficou de fora.
export const LIMITE_LEADS = 500;

// Lead como a tela do admin enxerga: plano e serializável (datas em ISO). Não leva
// idEnvio, visitorId nem os tempos do navegador: não servem à operação e só aumentariam
// o dado pessoal que sai do servidor.
export interface LeadDto {
  id: string;
  tipo: LeadTipo;
  status: LeadStatus;
  nome: string | null;
  empresa: string | null;
  email: string | null;
  // Só dígitos, sem o 55.
  telefone: string | null;
  canalRetorno: string | null;
  melhorHorario: string | null;
  procura: string | null;
  dor: string | null;
  mensagem: string | null;
  finalidade: string | null;
  politicaVersao: string;
  cienciaTextoVersao: string | null;
  marketingAceito: boolean;
  marketingTextoVersao: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  landingUrl: string | null;
  primeiraFonte: string | null;
  pagina: string | null;
  // Hora do servidor em que o lead chegou.
  createdAt: string;
  atendidoEm: string | null;
}

// Resposta de POST /api/leads/consulta. `leads` vem limitado a LIMITE_LEADS; `total` e `novos`
// contam tudo o que combina com os filtros, inclusive o que passou do teto.
export interface ListaLeads {
  leads: LeadDto[];
  total: number;
  novos: number;
}

/* ---------------- status ---------------- */

const STATUS_VALIDOS: readonly string[] = ["novo", "atendido"];

export function ehStatusLead(valor: unknown): valor is LeadStatus {
  return typeof valor === "string" && STATUS_VALIDOS.includes(valor);
}

// Lê o status do corpo JSON da rota. Corpo que não é objeto ou status fora da lista
// devolve null, e a rota responde 400.
export function statusDoCorpo(corpo: unknown): LeadStatus | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const status = (corpo as { status?: unknown }).status;
  return ehStatusLead(status) ? status : null;
}

export const ERRO_SEM_JSON = "Envie o corpo como application/json.";

// As rotas de escrita do admin só aceitam application/json (com ou sem charset). O cookie
// de sessão é SameSite=Lax e o site e o portal são o mesmo site para o navegador, então
// um formulário de fora poderia mandar um POST com o cookie. Formulário HTML e text/plain
// são os únicos tipos que uma página de outra origem manda sem preflight; JSON obrigatório
// força o preflight, que essas rotas não respondem.
export function ehJson(contentType: string | null | undefined): boolean {
  return (contentType ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

/* ---------------- telefone ---------------- */

// Número nacional: DDD mais 8 ou 9 dígitos, já sem o 55. Qualquer outro tamanho devolve
// vazio, e a tela mostra o que foi gravado sem máscara e sem link.
function telefoneNacional(valor: string | null | undefined): string {
  const n = normalizarTelefone(valor);
  return n.length === 10 || n.length === 11 ? n : "";
}

// "11912345678" vira "(11) 91234-5678". Tamanho fora do padrão volta como veio, só
// com os dígitos, para o admin ainda ver o que foi digitado.
export function formatarTelefone(valor: string | null | undefined): string {
  const n = telefoneNacional(valor);
  if (!n) return soDigitos(valor);
  const resto = n.slice(2);
  const corte = resto.length - 4;
  return `(${n.slice(0, 2)}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// Link de conversa no WhatsApp, ou null quando o telefone não serve para isso.
export function linkWhatsapp(valor: string | null | undefined): string | null {
  const n = telefoneNacional(valor);
  return n ? `https://wa.me/55${n}` : null;
}

// O botão de WhatsApp respeita o canal que a pessoa escolheu: quem pediu retorno por
// ligação ou por e-mail não é chamada no WhatsApp. O telefone segue visível nos outros
// canais, só o link some.
export function linkWhatsappDoLead(lead: Pick<LeadDto, "canalRetorno" | "telefone">): string | null {
  return lead.canalRetorno === "whatsapp" ? linkWhatsapp(lead.telefone) : null;
}

/* ---------------- rótulos e datas ---------------- */

const ROTULO_TIPO: Record<LeadTipo, string> = { contato: "Contato", interesse: "Lista" };

export function rotuloTipo(tipo: LeadTipo): string {
  return ROTULO_TIPO[tipo];
}

// Map, e não objeto: um valor como "constructor" não pode achar propriedade herdada.
const ROTULO_CANAL = new Map([
  ["whatsapp", "WhatsApp"],
  ["email", "E-mail"],
  ["ligacao", "Ligação"],
]);

export function rotuloCanal(canal: string | null | undefined): string {
  if (!canal) return "";
  return ROTULO_CANAL.get(canal) ?? canal;
}

const ROTULO_FINALIDADE = new Map([["aviso_abertura_plataforma", "Aviso de abertura da Plataforma"]]);

export function rotuloFinalidade(finalidade: string | null | undefined): string {
  if (!finalidade) return "";
  return ROTULO_FINALIDADE.get(finalidade) ?? finalidade;
}

// Criado na primeira chamada, e não ao importar o módulo: a rota de leads importa este
// arquivo só pelo limite da lista e não pode depender do Intl para subir.
let formatoDataHora: Intl.DateTimeFormat | null = null;

// O portal atende o Brasil, então a hora sai sempre em Brasília, de onde quer que o
// admin abra a tela. Montada por partes: o separador entre data e hora muda de uma
// versão do ICU para outra ("10/10/2026 14:32" ou "10/10/2026, 14:32").
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  if (!formatoDataHora) {
    formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }
  const p: Record<string, string> = {};
  for (const parte of formatoDataHora.formatToParts(data)) p[parte.type] = parte.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/* ---------------- conteúdo da linha e do detalhe ---------------- */

// Assunto da linha: o que a pessoa procura e o que mais pesa, nessa ordem. Na lista de
// interesse não há nenhum dos dois, então vale a finalidade da inscrição.
export function assuntosDoLead(lead: Pick<LeadDto, "procura" | "dor" | "finalidade">): string[] {
  const itens = [lead.procura, lead.dor].map((v) => (v ?? "").trim()).filter(Boolean);
  if (itens.length) return itens;
  const finalidade = rotuloFinalidade(lead.finalidade);
  return finalidade ? [finalidade] : [];
}

// Uma linha por UTM preenchida, para o detalhe. Vazio quando a pessoa chegou sem campanha.
export function resumoUtm(
  lead: Pick<LeadDto, "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "utmTerm">
): string {
  const pares: [string, string | null][] = [
    ["source", lead.utmSource],
    ["medium", lead.utmMedium],
    ["campaign", lead.utmCampaign],
    ["content", lead.utmContent],
    ["term", lead.utmTerm],
  ];
  return pares.flatMap(([chave, valor]) => (valor && valor.trim() ? [`${chave}: ${valor.trim()}`] : [])).join("\n");
}

// Contagem do topo da tela: "12 leads · 3 novos" sem filtro, "5 leads encontrados · 2
// novos" com filtro ou busca. Os números são os do servidor, não os da página de 500.
export function resumoDaLista(total: number, novos: number, filtrando: boolean): string {
  const numero = (n: number) => n.toLocaleString("pt-BR");
  const leads = `${numero(total)} ${total === 1 ? "lead" : "leads"}`;
  const achados = filtrando ? (total === 1 ? " encontrado" : " encontrados") : "";
  return `${leads}${achados} · ${numero(novos)} ${novos === 1 ? "novo" : "novos"}`;
}

/* ---------------- filtros e busca no servidor ---------------- */

export type FiltroTipo = "todos" | LeadTipo;
export type FiltroStatus = "todos" | LeadStatus;

// Os filtros da tela, que viajam no corpo de POST /api/leads/consulta. "todos" e busca vazia
// não filtram.
export interface FiltroLeads {
  tipo: FiltroTipo;
  status: FiltroStatus;
  busca: string;
}

// Só dígitos e pontuação de telefone: parênteses, espaço, ponto, mais e hífen.
const PARECE_TELEFONE = /^[\d\s().+-]+$/;

// Teto do texto da busca. O maior campo pesquisável é o e-mail, de até 160 caracteres.
export const TAMANHO_MAXIMO_BUSCA = 200;

export type BuscaInterpretada =
  | { tipo: "email"; valor: string }
  | { tipo: "telefone"; valor: string }
  | { tipo: "texto"; valor: string };

// O que o servidor procura, conforme o formato do que foi digitado:
// - com @: e-mail inteiro, em minúsculas, como é gravado;
// - só dígitos e pontuação de telefone, com 10 a 13 dígitos: telefone normalizado, sem
//   máscara e sem o 55;
// - qualquer outra coisa: parte do nome ou da empresa. Número curto cai aqui, porque
//   pode ser parte do nome de uma empresa.
// E-mail e telefone são buscas exatas: usam os índices dessas colunas e acham todas as
// linhas de um titular, por mais antigas que sejam.
export function interpretarBusca(bruta: string): BuscaInterpretada | null {
  const termo = bruta.trim().slice(0, TAMANHO_MAXIMO_BUSCA).trim();
  if (!termo) return null;
  if (termo.includes("@")) return { tipo: "email", valor: normalizarEmail(termo) };
  if (PARECE_TELEFONE.test(termo) && validarTelefone(termo)) {
    return { tipo: "telefone", valor: normalizarTelefone(termo) };
  }
  return { tipo: "texto", valor: termo };
}

// O Prisma monta o contains como ILIKE '%termo%' sem escapar nada: o % e o _ viram
// curinga e a barra invertida escapa o caractere seguinte. Escapados aqui, eles voltam
// a ser o texto digitado, e buscar "100%" não acha todo mundo que tem 100 no nome.
export function escaparCuringasLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

export type LeituraDoFiltro = { ok: true; filtro: FiltroLeads } | { ok: false; erro: string };

function ehFiltroTipo(valor: unknown): valor is FiltroTipo {
  return valor === "todos" || valor === "contato" || valor === "interesse";
}

function ehFiltroStatus(valor: unknown): valor is FiltroStatus {
  return valor === "todos" || ehStatusLead(valor);
}

// Texto aparado. Nulo, indefinido e texto vazio viram undefined, que é "sem valor".
function valorOuNada(valor: unknown): unknown {
  const v = typeof valor === "string" ? valor.trim() : valor;
  return v === null || v === "" ? undefined : v;
}

// Lê o corpo de POST /api/leads/consulta: { busca?, tipo?, status? }. A busca vai no corpo
// e nunca na URL, porque pode ser o e-mail ou o telefone de um titular, e a URL fica em log
// de acesso do proxy e no histórico do navegador. Ausente, nulo, vazio ou "todos" não
// filtra. Valor fora da lista, ou busca que não é texto, é erro (400): um typo não pode
// passar por "sem filtro".
export function lerConsulta(corpo: unknown): LeituraDoFiltro {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return { ok: false, erro: "Corpo inválido. Envie um objeto JSON com busca, tipo e status." };
  }
  const bruto = corpo as { busca?: unknown; tipo?: unknown; status?: unknown };
  const tipo = valorOuNada(bruto.tipo) ?? "todos";
  const status = valorOuNada(bruto.status) ?? "todos";
  if (!ehFiltroTipo(tipo)) return { ok: false, erro: "Tipo inválido. Use: contato ou interesse." };
  if (!ehFiltroStatus(status)) return { ok: false, erro: "Status inválido. Use: novo ou atendido." };
  const buscaBruta = valorOuNada(bruto.busca) ?? "";
  if (typeof buscaBruta !== "string") return { ok: false, erro: "Busca inválida. Envie texto." };
  return { ok: true, filtro: { tipo, status, busca: buscaBruta.slice(0, TAMANHO_MAXIMO_BUSCA).trim() } };
}

/* ---------------- apagar tudo de um titular ---------------- */

export interface AlvoDoTitular {
  email?: string;
  telefone?: string;
}

export type LeituraDoAlvo = { ok: true; alvo: AlvoDoTitular } | { ok: false; erro: string };

function ausente(valor: unknown): boolean {
  return valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");
}

// Lê o corpo de POST /api/leads/apagar-titular. Pede pelo menos um dos dois campos. O
// e-mail sai em minúsculas e o telefone sem máscara e sem o 55, como foram gravados.
// Campo enviado e inválido é erro: não vale apagar só pelo outro e calar sobre este.
export function lerAlvoDoTitular(corpo: unknown): LeituraDoAlvo {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return { ok: false, erro: "Corpo inválido. Envie o e-mail ou o telefone do titular." };
  }
  const { email, telefone } = corpo as { email?: unknown; telefone?: unknown };
  const alvo: AlvoDoTitular = {};
  if (!ausente(email)) {
    if (typeof email !== "string" || !validarEmail(email)) return { ok: false, erro: "E-mail inválido." };
    alvo.email = normalizarEmail(email);
  }
  if (!ausente(telefone)) {
    if (typeof telefone !== "string" || !validarTelefone(telefone)) return { ok: false, erro: "Telefone inválido." };
    alvo.telefone = normalizarTelefone(telefone);
  }
  if (!alvo.email && !alvo.telefone) return { ok: false, erro: "Informe o e-mail ou o telefone do titular." };
  return { ok: true, alvo };
}

export type CampoDoTitular = "email" | "telefone";

// Texto do confirm antes de apagar. Diz quantos leads saem e de qual dado.
export function confirmacaoDoTitular(campo: CampoDoTitular, valor: string, quantidade: number): string {
  const leads = quantidade === 1 ? "1 lead" : `${quantidade} leads`;
  const dado = campo === "email" ? `do e-mail ${valor}` : `do telefone ${formatarTelefone(valor)}`;
  return `Apagar ${leads} ${dado} a pedido do titular? Não dá para desfazer.`;
}

// Aviso depois de apagar, com o número que o servidor realmente apagou.
export function avisoTitularApagado(quantidade: number): string {
  return quantidade === 1 ? "1 lead apagado" : `${quantidade} leads apagados`;
}
