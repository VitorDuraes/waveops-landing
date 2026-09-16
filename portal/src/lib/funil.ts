import { createHash } from "node:crypto";

// Nucleo puro da medicao de funil (SPEC-18): sem banco, sem env, sem header.
// Fica em lib/ de proposito, e nao em server/, porque nao toca segredo nem efeito
// colateral. E o que permite testar a regra inteira sem subir Postgres.
// Quem tem efeito colateral e src/server/evento.ts.

// Lista FECHADA. Nome fora daqui e descartado em silencio, e e isso que impede um
// terceiro de encher a tabela com evento inventado. Para medir algo novo, a mudanca
// e aqui e em quem dispara, junto.
export const EVENTOS = [
  "visita",
  "seccao_precos",
  "lead_enviado",
  "whatsapp_click",
  "checkout_aberto",
  "checkout_enviado",
  "pagamento_confirmado",
  "ativacao",
] as const;

export type NomeEvento = (typeof EVENTOS)[number];

// As etapas do funil principal, em ordem. whatsapp_click e seccao_precos ficam de
// fora porque sao sinais laterais, nao degraus: quem clica no WhatsApp nao "avancou"
// para o checkout, pegou outro caminho.
export const ETAPAS: NomeEvento[] = [
  "visita",
  "lead_enviado",
  "checkout_aberto",
  "checkout_enviado",
  "pagamento_confirmado",
  "ativacao",
];

export const ROTULO_ETAPA: Record<NomeEvento, string> = {
  visita: "Visita",
  seccao_precos: "Viu os preços",
  lead_enviado: "Lead enviado",
  whatsapp_click: "Clique no WhatsApp",
  checkout_aberto: "Checkout aberto",
  checkout_enviado: "Checkout enviado",
  pagamento_confirmado: "Pagamento confirmado",
  ativacao: "Conta ativada",
};

export const LIMITES = {
  corpoBytes: 2048,
  props: 5,
  valor: 64,
  path: 128,
  referrer: 64,
};

export interface EventoNormalizado {
  nome: NomeEvento;
  path: string | null;
  referrerHost: string | null;
  props: Record<string, string> | null;
}

function ehNomeValido(v: unknown): v is NomeEvento {
  return typeof v === "string" && (EVENTOS as readonly string[]).includes(v);
}

// So o host do referrer, nunca a URL inteira: a URL pode carregar termo de busca,
// token de campanha e, em caso ruim, dado pessoal na querystring.
function apenasHost(bruto: unknown): string | null {
  if (typeof bruto !== "string" || !bruto) return null;
  const semEsquema = bruto.replace(/^[a-z]+:\/\//i, "");
  const host = semEsquema.split("/")[0].split("?")[0].toLowerCase();
  if (!host || !/^[a-z0-9.:-]+$/.test(host)) return null;
  return host.slice(0, LIMITES.referrer);
}

// Caminho sem host e sem querystring, pelo mesmo motivo do referrer.
function apenasPath(bruto: unknown): string | null {
  if (typeof bruto !== "string" || !bruto) return null;
  const semQuery = bruto.split("?")[0].split("#")[0];
  if (!semQuery.startsWith("/")) return null;
  return semQuery.slice(0, LIMITES.path);
}

// Objeto raso de strings curtas. Numero e booleano viram string; objeto, array e
// null sao descartados. Chave a mais e cortada pela ordem de chegada.
function normalizarProps(bruto: unknown): Record<string, string> | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const saida: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    if (n >= LIMITES.props) break;
    if (!/^[a-z0-9_]{1,32}$/i.test(k)) continue;
    if (v === null || typeof v === "object") continue;
    saida[k] = String(v).slice(0, LIMITES.valor);
    n++;
  }
  return n ? saida : null;
}

export function normalizarEvento(bruto: unknown): EventoNormalizado | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const b = bruto as Record<string, unknown>;
  if (!ehNomeValido(b.n)) return null;
  return {
    nome: b.n,
    path: apenasPath(b.u),
    referrerHost: apenasHost(b.r),
    props: normalizarProps(b.p),
  };
}

// --- Id do visitante ---------------------------------------------------------
//
// Hash diario de IP + user-agent, salgado. Nada e gravado no dispositivo, entao
// nao ha cookie, nao ha localStorage e nao ha banner de consentimento. Duas
// consequencias que importam:
//
// 1. A MESMA pessoa gera o MESMO id em waveops.com.br e em portal.waveops.com.br
//    no mesmo dia. E isso, e so isso, que faz o funil atravessar os dois dominios
//    sem passar id por querystring e sem ferramenta de terceiro.
// 2. O id NAO persiste entre dias: o componente "dia" troca a meia-noite. Visitante
//    recorrente conta como novo no dia seguinte. E o preco de nao rastrear pessoa,
//    e e um preco aceito: a pergunta do funil e sobre a jornada de um dia.
//
// O vinculo que precisa durar (visita -> fatura paga) NAO depende deste hash: ele
// e gravado em Customer.visitorId no checkout e vive no banco.

export function diaUtc(agora: Date = new Date()): string {
  return agora.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function calcularId(dia: string, ip: string, userAgent: string, sal: string): string {
  return createHash("sha256").update(`${dia}|${sal}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}
