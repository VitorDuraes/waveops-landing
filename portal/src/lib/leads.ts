// Regra pura dos leads que chegam pelos formulários do site novo (contato e lista de
// interesse da Plataforma): sem banco, sem env, sem header, testada com tsx em
// tests/unit/leads.test.ts. Quem grava é src/server/leads.ts; quem recebe é
// src/app/api/site/*.
//
// O contrato é o que o site já manda (assets/site/lib/payload.js) e lê
// (assets/site/lib/enviar.js). Duas regras guiam tudo aqui:
// 1. O servidor nunca é mais rígido que o site. Os predicados de nome, telefone, e-mail
//    e ciência são os de assets/site/lib/validacao.js, portados e presos por teste de
//    paridade. O resto é cortar ou ignorar, nunca recusar.
// 2. 422 só com nome de campo que a tela sabe marcar (nome, telefone, email,
//    politicaCiente), na ordem da tela. Campo de contrato quebrado também volta, depois
//    deles: a tela trata como falha e oferece o WhatsApp.

export const TEMPO_MINIMO_MS = 1200;
export const CANAIS_DE_RETORNO = ["whatsapp", "email", "ligacao"] as const;
export type CanalDeRetorno = (typeof CANAIS_DE_RETORNO)[number];

const ID_ENVIO = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
const MAIOR_INT32 = 2_147_483_647;

const LIMITE = {
  nome: 120,
  empresa: 120,
  rotulo: 120,
  mensagem: 2000,
  email: 160,
  versao: 60,
  utm: 200,
  url: 500,
  curto: 100,
} as const;

export interface LeadValidado {
  tipo: "contato" | "interesse";
  idEnvio: string;
  nome: string | null;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  canalRetorno: CanalDeRetorno | null;
  melhorHorario: string | null;
  dor: string | null;
  procura: string | null;
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
  enviadoEm: Date | null;
  preenchidoEmMs: number | null;
}

export type ResultadoDeValidacao = { ok: true; dados: LeadValidado } | { ok: false; campos: string[] };

type Corpo = Record<string, unknown>;

function ehCorpo(v: unknown): v is Corpo {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// --- Regras portadas do site (assets/site/lib/validacao.js), letra por letra ----------

export function soDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

export function validarTelefone(valor: unknown): boolean {
  const digitos = soDigitos(valor);
  return digitos.length >= 10 && digitos.length <= 13;
}

export function normalizarTelefone(valor: unknown): string {
  const digitos = soDigitos(valor);
  return (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

export function normalizarEmail(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

export function validarEmail(valor: unknown): boolean {
  const email = String(valor ?? "").trim();
  const arroba = email.indexOf("@");
  const ponto = email.lastIndexOf(".");
  return arroba > 0 && ponto > arroba + 1 && email.length > ponto + 1 && !/\s/.test(email) && email.indexOf("@", arroba + 1) === -1;
}

// --- Limpeza -------------------------------------------------------------------------

// Substituto solto (metade de um emoji) não é UTF-8 válido, e o Postgres recusa: a rota
// respondia 503 a todo envio da sessão. O próprio site gera isso, porque atribuicao.js
// corta a UTM com slice. Vira U+FFFD, como faria String.prototype.toWellFormed.
const SUBSTITUTO_SOLTO = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
function bemFormado(texto: string): string {
  return texto.replace(SUBSTITUTO_SOLTO, "�");
}

// Corta sem deixar metade de um par substituto (emoji) no fim.
function cortar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite);
  const ultimo = corte.charCodeAt(corte.length - 1);
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? corte.slice(0, -1) : corte;
}

// Campo de uma linha: só string conta (outro tipo vira nulo). Caractere de controle sai,
// quebra e tabulação viram espaço, espaços repetidos viram um. Vazio vira nulo.
function umaLinha(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = bemFormado(valor)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const cortado = cortar(limpo, limite).trim();
  return cortado || null;
}

// Texto livre (mensagem): preserva quebra de linha, normaliza CRLF para LF e tira o
// resto do controle, inclusive o NUL que o Postgres recusa em coluna de texto.
function textoLivre(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = bemFormado(valor)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  const cortado = cortar(limpo, limite).trim();
  return cortado || null;
}

function dataIso(valor: unknown): Date | null {
  if (typeof valor !== "string" || !DATA_ISO.test(valor)) return null;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data : null;
}

// Relógio do navegador, só referência: fora de 2000 a 2100 é lixo, e um ano com 5 dígitos
// derrubava a gravação.
function dataDeEnvio(valor: unknown): Date | null {
  const data = dataIso(valor);
  if (!data) return null;
  const ano = data.getUTCFullYear();
  return ano >= 2000 && ano <= 2100 ? data : null;
}

// URL de entrada e referrer ficam só com origem e caminho. A query pode trazer e-mail,
// telefone ou token (o funil guarda só host e caminho pelo mesmo motivo), e a UTM já vem
// separada nos campos utm_*. Só http e https.
function urlSemConsulta(valor: unknown): string | null {
  const texto = umaLinha(valor, LIMITE.url);
  if (!texto) return null;
  try {
    const url = new URL(texto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return cortar(`${url.origin}${url.pathname}`, LIMITE.url);
  } catch {
    return null;
  }
}

function emailComRegrasDoServidor(valor: unknown): { email: string; valido: boolean } {
  const email = bemFormado(normalizarEmail(valor));
  const valido = validarEmail(email) && email.length <= LIMITE.email && !/[\u0000-\u001f\u007f]/.test(email);
  return { email, valido };
}

// --- Robô ----------------------------------------------------------------------------

// Isca preenchida ou envio rápido demais. O site já não envia nesses casos, então quem
// cai aqui chamou a rota direto. A rota responde 200 sem gravar, ANTES de validar, para
// o robô não aprender as regras. Tempo ausente ou de tipo errado não é robô: vai para a
// validação e volta 422.
export function ehRoboDeFormulario(corpo: unknown): boolean {
  if (!ehCorpo(corpo)) return false;
  // Sem String(isca): um objeto com toString inválido lançava erro e a rota caía com 500
  // sem CORS. Texto conta se não for só espaço; qualquer outro valor presente conta.
  const isca = corpo.website;
  if (typeof isca === "string" ? isca.trim() !== "" : isca !== undefined && isca !== null) return true;
  const tempo = corpo.preenchidoEmMs;
  return typeof tempo === "number" && Number.isFinite(tempo) && tempo < TEMPO_MINIMO_MS;
}

export function protocoloDe(corpo: unknown): string {
  const id = ehCorpo(corpo) ? corpo.idEnvio : undefined;
  return typeof id === "string" && ID_ENVIO.test(id) ? id : "descartado";
}

// --- Partes comuns aos dois formulários ------------------------------------------------

interface Comum {
  idEnvio: string;
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
  enviadoEm: Date | null;
  preenchidoEmMs: number | null;
}

// Valida os campos de contrato e monta o que os dois formulários têm em comum. Os nomes
// de campo recusados entram em `contrato`, que vai para o fim da lista do 422.
function comum(corpo: Corpo, versaoContrato: number, origem: string, contrato: string[]): Comum {
  if (corpo.versaoContrato !== versaoContrato) contrato.push("versaoContrato");
  if (corpo.origem !== origem) contrato.push("origem");
  const idEnvio = typeof corpo.idEnvio === "string" && ID_ENVIO.test(corpo.idEnvio) ? corpo.idEnvio : "";
  if (!idEnvio) contrato.push("idEnvio");
  const politicaVersao = umaLinha(corpo.politicaVersao, LIMITE.versao);
  if (!politicaVersao) contrato.push("politicaVersao");
  if (!dataIso(corpo.politicaCienteEm)) contrato.push("politicaCienteEm");
  const tempo = corpo.preenchidoEmMs;
  const tempoValido = typeof tempo === "number" && Number.isFinite(tempo);
  if (!tempoValido) contrato.push("preenchidoEmMs");
  // Ausente vale false: consentimento nunca é presumido.
  let marketingAceito = false;
  if (corpo.marketingAceito !== undefined) {
    if (typeof corpo.marketingAceito === "boolean") marketingAceito = corpo.marketingAceito;
    else contrato.push("marketingAceito");
  }
  // A versão do texto de marketing vem sempre, também sem aceite: prova o que a pessoa
  // viu. Com aceite, ela é obrigatória.
  const marketingTextoVersao = umaLinha(corpo.marketingTextoVersao, LIMITE.versao);
  if (marketingAceito && !marketingTextoVersao) contrato.push("marketingTextoVersao");

  return {
    idEnvio,
    politicaVersao: politicaVersao ?? "",
    cienciaTextoVersao: umaLinha(corpo.cienciaTextoVersao, LIMITE.versao),
    marketingAceito,
    marketingTextoVersao,
    utmSource: umaLinha(corpo.utm_source, LIMITE.utm),
    utmMedium: umaLinha(corpo.utm_medium, LIMITE.utm),
    utmCampaign: umaLinha(corpo.utm_campaign, LIMITE.utm),
    utmContent: umaLinha(corpo.utm_content, LIMITE.utm),
    utmTerm: umaLinha(corpo.utm_term, LIMITE.utm),
    referrer: urlSemConsulta(corpo.referrer),
    landingUrl: urlSemConsulta(corpo.landingUrl),
    primeiraFonte: umaLinha(corpo.primeiraFonte, LIMITE.curto),
    pagina: umaLinha(corpo.pagina, LIMITE.curto),
    enviadoEm: dataDeEnvio(corpo.enviadoEm),
    preenchidoEmMs: tempoValido ? Math.min(Math.max(Math.round(tempo), 0), MAIOR_INT32) : null,
  };
}

// --- Formulários ---------------------------------------------------------------------

// Formulário de contato (versaoContrato 2). O canal decide o que é obrigatório:
// WhatsApp e Ligação pedem telefone; E-mail pede e-mail. O contato opcional, se vier,
// também tem de ser válido. Igual a validarContato do site.
export function validarContato(corpo: unknown): ResultadoDeValidacao {
  if (!ehCorpo(corpo)) return { ok: false, campos: ["corpo"] };
  const tela: string[] = [];
  const contrato: string[] = [];

  const canal = CANAIS_DE_RETORNO.find((c) => c === corpo.canalRetorno) ?? null;
  const querTelefone = canal !== "email";
  const nome = umaLinha(corpo.nome, LIMITE.nome);
  const telefoneBruto = typeof corpo.telefone === "string" ? corpo.telefone : "";
  const temTelefone = soDigitos(telefoneBruto).length > 0;
  const { email, valido: emailValido } = emailComRegrasDoServidor(typeof corpo.email === "string" ? corpo.email : "");
  const temEmail = email.length > 0;

  if ((nome ?? "").length < 2) tela.push("nome");
  if (querTelefone ? !validarTelefone(telefoneBruto) : temTelefone && !validarTelefone(telefoneBruto)) tela.push("telefone");
  if (querTelefone ? temEmail && !emailValido : !emailValido) tela.push("email");
  if (corpo.politicaCiente !== true) tela.push("politicaCiente");
  if (!canal) contrato.push("canalRetorno");

  const base = comum(corpo, 2, "contato", contrato);
  const campos = [...tela, ...contrato];
  if (campos.length) return { ok: false, campos };

  return {
    ok: true,
    dados: {
      tipo: "contato",
      ...base,
      nome,
      empresa: umaLinha(corpo.empresa, LIMITE.empresa),
      email: temEmail ? email : null,
      telefone: temTelefone ? normalizarTelefone(telefoneBruto) : null,
      canalRetorno: canal,
      melhorHorario: umaLinha(corpo.melhorHorario, LIMITE.rotulo),
      dor: umaLinha(corpo.dor, LIMITE.rotulo),
      procura: umaLinha(corpo.procura, LIMITE.rotulo),
      mensagem: textoLivre(corpo.mensagem, LIMITE.mensagem),
      finalidade: null,
    },
  };
}

// Lista de interesse da Plataforma (versaoContrato 1). Só e-mail e ciência são regras da
// tela, como em validarInteresse do site.
export function validarInteresse(corpo: unknown): ResultadoDeValidacao {
  if (!ehCorpo(corpo)) return { ok: false, campos: ["corpo"] };
  const tela: string[] = [];
  const contrato: string[] = [];

  const { email, valido: emailValido } = emailComRegrasDoServidor(typeof corpo.email === "string" ? corpo.email : "");
  if (!emailValido) tela.push("email");
  if (corpo.politicaCiente !== true) tela.push("politicaCiente");
  if (corpo.finalidade !== "aviso_abertura_plataforma") contrato.push("finalidade");

  const base = comum(corpo, 1, "plataforma", contrato);
  const campos = [...tela, ...contrato];
  if (campos.length) return { ok: false, campos };

  return {
    ok: true,
    dados: {
      tipo: "interesse",
      ...base,
      nome: null,
      empresa: null,
      email,
      telefone: null,
      canalRetorno: null,
      melhorHorario: null,
      dor: null,
      procura: null,
      mensagem: null,
      finalidade: "aviso_abertura_plataforma",
    },
  };
}
