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
  "interesse_plataforma",
  "checkout_aberto",
  "checkout_enviado",
  "pagamento_confirmado",
  "ativacao",
] as const;

export type NomeEvento = (typeof EVENTOS)[number];

// As etapas do funil principal, em ordem. whatsapp_click, seccao_precos e
// interesse_plataforma ficam de fora porque são sinais laterais, não degraus: quem
// clica no WhatsApp ou entra na lista de interesse não "avançou" para o checkout,
// pegou outro caminho.
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
  interesse_plataforma: "Lista de interesse da Plataforma",
  checkout_aberto: "Checkout aberto",
  checkout_enviado: "Checkout enviado",
  pagamento_confirmado: "Pagamento confirmado",
  ativacao: "Conta ativada",
};

// Eventos que NASCEM na landing. So contam quando chegam com origem "landing".
//
// Motivo concreto: o portal serve uma copia da landing na propria raiz (ver
// portal/scripts/sync-landing.mjs), entao abrir portal.waveops.com.br para conferir
// qualquer coisa dispara uma "visita" identica a de um visitante real. Sem esta
// regra, o topo do funil mistura trafego de verdade com a gente navegando no painel.
export const EVENTOS_DA_LANDING: NomeEvento[] = [
  "visita",
  "seccao_precos",
  "lead_enviado",
  "whatsapp_click",
  "interesse_plataforma",
];

// Origens do site que podem mandar evento (CORS da rota /api/e).
export const ORIGENS_DA_LANDING = ["https://waveops.com.br", "https://www.waveops.com.br"];

// Quem mandou o evento, pelo cabeçalho Origin. O navegador põe Origin em todo POST,
// inclusive de mesma origem (sendBeacon e fetch), então "sem Origin" não identifica
// as telas do portal: sem esta regra, o checkout_aberto do próprio portal era
// descartado. Mesma origem vale pelo Sec-Fetch-Site, que página nenhuma consegue
// forjar, ou pelo Origin igual ao APP_URL (navegador que não manda Sec-Fetch-Site).
// Sem Origin continua valendo como portal: quem forja fora do navegador já podia
// omitir o cabeçalho. null = descartar.
export function origemDoEvento(
  origin: string | null,
  secFetchSite: string | null,
  appUrl: string
): "landing" | "portal" | null {
  if (!origin) return "portal";
  if (ORIGENS_DA_LANDING.includes(origin)) return "landing";
  if (secFetchSite === "same-origin" || origin === origemDaUrl(appUrl)) return "portal";
  return null;
}

// A mesma regra, lida dos cabeçalhos da requisição: o nome dos cabeçalhos também fica testado.
export function origemDaRequisicao(headers: Headers, appUrl: string): "landing" | "portal" | null {
  return origemDoEvento(headers.get("origin"), headers.get("sec-fetch-site"), appUrl);
}

// Origem de uma URL, ou null quando ela não tem origem utilizável (inválida ou opaca).
function origemDaUrl(url: string): string | null {
  try {
    const origem = new URL(url).origin;
    return origem === "null" ? null : origem;
  } catch {
    return null;
  }
}

export const LIMITES = {
  corpoBytes: 2048,
  props: 5,
  valor: 64,
  path: 128,
  referrer: 64,
  fonte: 64,
};

export interface EventoNormalizado {
  nome: NomeEvento;
  path: string | null;
  referrerHost: string | null;
  fonte: string | null;
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

// A fonte vem do navegador, entao e entrada de borda: minuscula, conjunto restrito
// de caracteres e tamanho fixo. Sem isso, um terceiro escreve o que quiser numa
// coluna que a gente agrupa e mostra na tela do admin.
export function normalizarFonte(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]/g, "")
    .slice(0, LIMITES.fonte);
  return limpo || null;
}

// O site (waveops.com.br, www) e o portal. Porta e ponto final de FQDN não mudam o host.
function ehDominioProprio(host: string): boolean {
  return /(^|\.)waveops\.com\.br$/.test(host.replace(/:\d*$/, "").replace(/\.$/, ""));
}

export function normalizarEvento(bruto: unknown): EventoNormalizado | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const b = bruto as Record<string, unknown>;
  if (!ehNomeValido(b.n)) return null;
  const referrerHost = apenasHost(b.r);
  const fonte = normalizarFonte(b.f);
  // Visita que chega de dentro (o próprio site ou o portal) não é entrada nova: a
  // pessoa já foi contada quando chegou de fora. O funil do site novo nem manda esse
  // evento (assets/funil.js, interno()); o do site antigo manda, com o portal como
  // origem, quando alguém clica num link do portal para o site. Campanha na URL
  // vence o referrer interno, como no funil novo: com fonte de fora, a visita conta.
  const fonteDeDentro = !fonte || ehDominioProprio(fonte.split("/")[0]);
  if (b.n === "visita" && referrerHost && ehDominioProprio(referrerHost) && fonteDeDentro) return null;
  return {
    nome: b.n,
    path: apenasPath(b.u),
    referrerHost,
    fonte,
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
