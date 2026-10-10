// Tipos e funções puras da tela de leads do admin (/admin/leads). Sem banco e sem
// framework: roda na rota, no navegador e nos testes (tests/unit/leads-admin.test.ts).

export type LeadTipo = "contato" | "interesse";
export type LeadStatus = "novo" | "atendido";

// Quantos leads a lista traz, do mais recente para o mais antigo. A busca e os filtros
// da tela olham só para esses: acima disso a tela avisa em vez de esconder o corte.
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

/* ---------------- telefone ---------------- */

function soDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

// Número nacional: DDD mais 8 ou 9 dígitos. O site já tira o 55, mas quem chama a API
// direto pode mandar com ele, então 12 ou 13 dígitos começando em 55 também valem.
// Qualquer outro tamanho devolve vazio.
function telefoneNacional(valor: string | null | undefined): string {
  const d = soDigitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d.slice(2);
  return d.length === 10 || d.length === 11 ? d : "";
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

// "12 leads · 3 novos" na lista inteira, "5 de 12 leads" quando há filtro ou busca.
export function resumoDaLista(total: number, visiveis: number, novos: number): string {
  const leads = (n: number) => `${n} ${n === 1 ? "lead" : "leads"}`;
  if (visiveis !== total) return `${visiveis} de ${leads(total)}`;
  return `${leads(total)} · ${novos} ${novos === 1 ? "novo" : "novos"}`;
}

/* ---------------- filtro da lista ---------------- */

export type FiltroTipo = "todos" | LeadTipo;
export type FiltroStatus = "todos" | LeadStatus;

export interface FiltroLeads {
  tipo: FiltroTipo;
  status: FiltroStatus;
  busca: string;
}

// Sem acento e sem caixa: quem busca "joao" acha "João".
function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Busca que só tem dígito e pontuação de telefone também é lida como telefone.
const PARECE_TELEFONE = /^[\d\s().+-]+$/;

// Filtra por tipo, status e busca (nome, empresa, e-mail ou telefone). A busca por
// telefone ignora máscara e aceita o 55 na frente, e só vale para texto que parece
// telefone: "joao2" não pode achar todo número que tem um 2.
export function filtrarLeads(leads: readonly LeadDto[], filtro: FiltroLeads): LeadDto[] {
  const termo = normalizar(filtro.busca);
  const digitos = PARECE_TELEFONE.test(filtro.busca.trim()) ? soDigitos(filtro.busca) : "";
  const numero = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;

  return leads.filter((lead) => {
    if (filtro.tipo !== "todos" && lead.tipo !== filtro.tipo) return false;
    if (filtro.status !== "todos" && lead.status !== filtro.status) return false;
    if (!termo) return true;
    if ([lead.nome, lead.empresa, lead.email].some((v) => normalizar(v).includes(termo))) return true;
    return numero !== "" && soDigitos(lead.telefone).includes(numero);
  });
}
