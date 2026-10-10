import "server-only";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./db";
import { env } from "./env";
import { LIMITE_LEADS, type LeadDto, type LeadStatus, type LeadTipo } from "@/lib/leads-admin";

// Lado do admin dos leads do site: listar, marcar atendido, reabrir e apagar. A entrada
// pública (rotas /api/site/*) mora em outro arquivo. Lead é dado pessoal: nada dele vai
// para o log, e a auditoria guarda só o que aconteceu, quem fez e o id do alvo.

// Só as colunas que a tela mostra. idEnvio, visitorId e os tempos do navegador ficam no
// banco e não saem do servidor.
const CAMPOS = {
  id: true,
  tipo: true,
  status: true,
  nome: true,
  empresa: true,
  email: true,
  telefone: true,
  canalRetorno: true,
  melhorHorario: true,
  procura: true,
  dor: true,
  mensagem: true,
  finalidade: true,
  politicaVersao: true,
  cienciaTextoVersao: true,
  marketingAceito: true,
  marketingTextoVersao: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  utmContent: true,
  utmTerm: true,
  referrer: true,
  landingUrl: true,
  primeiraFonte: true,
  pagina: true,
  createdAt: true,
  atendidoEm: true,
} satisfies Prisma.LeadSelect;

type LinhaLead = Prisma.LeadGetPayload<{ select: typeof CAMPOS }>;

function paraDto(l: LinhaLead): LeadDto {
  return {
    id: l.id,
    tipo: l.tipo,
    status: l.status,
    nome: l.nome,
    empresa: l.empresa,
    email: l.email,
    telefone: l.telefone,
    canalRetorno: l.canalRetorno,
    melhorHorario: l.melhorHorario,
    procura: l.procura,
    dor: l.dor,
    mensagem: l.mensagem,
    finalidade: l.finalidade,
    politicaVersao: l.politicaVersao,
    cienciaTextoVersao: l.cienciaTextoVersao,
    marketingAceito: l.marketingAceito,
    marketingTextoVersao: l.marketingTextoVersao,
    utmSource: l.utmSource,
    utmMedium: l.utmMedium,
    utmCampaign: l.utmCampaign,
    utmContent: l.utmContent,
    utmTerm: l.utmTerm,
    referrer: l.referrer,
    landingUrl: l.landingUrl,
    primeiraFonte: l.primeiraFonte,
    pagina: l.pagina,
    createdAt: l.createdAt.toISOString(),
    atendidoEm: l.atendidoEm ? l.atendidoEm.toISOString() : null,
  };
}

// Por que a escrita não aconteceu. A rota traduz: nao_encontrado vira 404, indisponivel
// (portal sem banco) vira 503. Erro inesperado de banco não entra aqui: é lançado.
export type FalhaLead = "nao_encontrado" | "indisponivel";

export type ResultadoStatus =
  | { ok: true; lead: LeadDto; mudou: boolean }
  | { ok: false; motivo: FalhaLead };
export type ResultadoApagar = { ok: true } | { ok: false; motivo: FalhaLead };

export const ERRO_SEM_BANCO = "O portal está sem banco de dados neste ambiente. Não dá para alterar leads.";

// P2025: a linha que a operação precisava sumiu no meio do caminho (outro admin apagou
// o lead entre a leitura e a escrita). Para o chamador é o mesmo caso de lead inexistente.
function registroNaoExiste(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2025";
}

// Texto curto para o log do servidor. Nenhuma consulta deste arquivo leva dado pessoal do
// lead nos argumentos (só id, status e o e-mail do admin), então a mensagem do erro é segura.
export function descreverErro(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 300) : "desconhecido";
}

// O que a auditoria guarda do lead: tipo e hora de chegada, nunca nome, e-mail ou telefone.
function detalheDe(lead: { tipo: LeadTipo; createdAt: Date }): Prisma.InputJsonObject {
  return { tipo: lead.tipo, recebidoEm: lead.createdAt.toISOString() };
}

// Os mais recentes primeiro, até LIMITE_LEADS. Sem banco devolve vazio. Falha de banco
// é lançada de propósito: lista vazia por erro faria o admin achar que não chegou lead.
export async function listarLeads(): Promise<LeadDto[]> {
  if (!env.hasDb()) return [];
  const linhas = await getPrisma().lead.findMany({
    select: CAMPOS,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: LIMITE_LEADS,
  });
  return linhas.map(paraDto);
}

// "atendido" grava a hora em atendidoEm, "novo" zera. Pedir o status que o lead já tem
// não muda nada e não gera linha de auditoria (mudou: false).
export async function mudarStatusLead(id: string, status: LeadStatus, por: string): Promise<ResultadoStatus> {
  if (!env.hasDb()) return { ok: false, motivo: "indisponivel" };
  const db = getPrisma();

  const atual = await db.lead.findUnique({ where: { id }, select: CAMPOS });
  if (!atual) return { ok: false, motivo: "nao_encontrado" };
  if (atual.status === status) return { ok: true, lead: paraDto(atual), mudou: false };

  try {
    // A mudança e a linha de auditoria andam juntas: as duas entram ou nenhuma.
    const [atualizado] = await db.$transaction([
      db.lead.update({
        where: { id },
        data: { status, atendidoEm: status === "atendido" ? new Date() : null },
        select: CAMPOS,
      }),
      db.auditoria.create({
        data: {
          acao: status === "atendido" ? "lead.atendido" : "lead.reaberto",
          alvoId: id,
          por,
          detalhe: detalheDe(atual),
        },
      }),
    ]);
    return { ok: true, lead: paraDto(atualizado), mudou: true };
  } catch (e) {
    if (registroNaoExiste(e)) return { ok: false, motivo: "nao_encontrado" };
    throw e;
  }
}

// Apagar a pedido do titular. Some o lead inteiro; a auditoria fica com o id, o tipo e a
// hora de chegada, sem nenhum dado pessoal.
export async function apagarLead(id: string, por: string): Promise<ResultadoApagar> {
  if (!env.hasDb()) return { ok: false, motivo: "indisponivel" };
  const db = getPrisma();

  const atual = await db.lead.findUnique({ where: { id }, select: { tipo: true, createdAt: true } });
  if (!atual) return { ok: false, motivo: "nao_encontrado" };

  try {
    await db.$transaction([
      db.lead.delete({ where: { id } }),
      db.auditoria.create({ data: { acao: "lead.apagado", alvoId: id, por, detalhe: detalheDe(atual) } }),
    ]);
    return { ok: true };
  } catch (e) {
    if (registroNaoExiste(e)) return { ok: false, motivo: "nao_encontrado" };
    throw e;
  }
}
