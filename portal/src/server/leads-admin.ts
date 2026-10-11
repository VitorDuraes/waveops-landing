import "server-only";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./db";
import { env } from "./env";
import {
  LIMITE_LEADS,
  escaparCuringasLike,
  interpretarBusca,
  type AlvoDoTitular,
  type FiltroLeads,
  type LeadDto,
  type LeadStatus,
  type LeadTipo,
  type ListaLeads,
} from "@/lib/leads-admin";

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

// Texto curto para o log do servidor. A busca e a exclusão por titular levam e-mail ou
// telefone nos argumentos, e o erro de validação do Prisma imprime os argumentos da
// consulta: esse sai sem detalhe. Os demais erros (conexão, tabela, restrição) só trazem
// o texto do banco, sem o valor buscado.
export function descreverErro(e: unknown): string {
  if (!(e instanceof Error)) return "desconhecido";
  if (e.name === "PrismaClientValidationError") return "consulta recusada pelo Prisma, detalhe omitido";
  return e.message.slice(0, 300);
}

// O que a auditoria guarda do lead: tipo e hora de chegada, nunca nome, e-mail ou telefone.
function detalheDe(lead: { tipo: LeadTipo; createdAt: Date }): Prisma.InputJsonObject {
  return { tipo: lead.tipo, recebidoEm: lead.createdAt.toISOString() };
}

// Condição do banco para os filtros da tela. A busca olha para o formato do que foi
// digitado (ver interpretarBusca): e-mail e telefone são igualdade, que usa os índices
// leads_email_idx e leads_telefone_idx e acha o titular por mais antigo que seja; o resto
// é parte do nome ou da empresa, sem diferenciar maiúscula (o acento conta). Os três não
// entram juntos num OR: um ILIKE no meio impediria o uso dos índices.
function onde(filtro: FiltroLeads): Prisma.LeadWhereInput {
  const condicoes: Prisma.LeadWhereInput[] = [];
  if (filtro.tipo !== "todos") condicoes.push({ tipo: filtro.tipo });
  if (filtro.status !== "todos") condicoes.push({ status: filtro.status });
  const busca = interpretarBusca(filtro.busca);
  if (busca?.tipo === "email") {
    condicoes.push({ email: busca.valor });
  } else if (busca?.tipo === "telefone") {
    condicoes.push({ telefone: busca.valor });
  } else if (busca) {
    // O Prisma não escapa os curingas do ILIKE: sem isso, "%" casaria todo nome.
    const trecho = escaparCuringasLike(busca.valor);
    condicoes.push({
      OR: [
        { nome: { contains: trecho, mode: "insensitive" } },
        { empresa: { contains: trecho, mode: "insensitive" } },
      ],
    });
  }
  return condicoes.length ? { AND: condicoes } : {};
}

// Os mais recentes primeiro, até LIMITE_LEADS, com o total e os novos de tudo o que
// combina com os filtros (não só dos 500 devolvidos). Sem banco devolve vazio. Falha de
// banco é lançada de propósito: lista vazia por erro faria o admin achar que não chegou lead.
export async function listarLeads(filtro: FiltroLeads): Promise<ListaLeads> {
  if (!env.hasDb()) return { leads: [], total: 0, novos: 0 };
  const db = getPrisma();
  const where = onde(filtro);
  const [linhas, porStatus] = await Promise.all([
    db.lead.findMany({
      where,
      select: CAMPOS,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIMITE_LEADS,
    }),
    db.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  return {
    leads: linhas.map(paraDto),
    total: porStatus.reduce((soma, g) => soma + g._count._all, 0),
    novos: porStatus.find((g) => g.status === "novo")?._count._all ?? 0,
  };
}

// "atendido" grava a hora em atendidoEm, "novo" zera. O updateMany só casa com o lead que
// ainda não está no status pedido, e a auditoria só entra quando ele mudou uma linha
// (count 1): de dois pedidos iguais ao mesmo tempo, só um muda o lead e só um audita. O
// segundo espera o primeiro terminar, não casa mais e cai em mudou: false, igual a pedir
// o status que o lead já tinha. Tudo na mesma transação: a mudança e a auditoria entram
// juntas ou nenhuma entra.
export async function mudarStatusLead(id: string, status: LeadStatus, por: string): Promise<ResultadoStatus> {
  if (!env.hasDb()) return { ok: false, motivo: "indisponivel" };

  return getPrisma().$transaction(async (tx): Promise<ResultadoStatus> => {
    const { count } = await tx.lead.updateMany({
      where: { id, status: { not: status } },
      data: { status, atendidoEm: status === "atendido" ? new Date() : null },
    });
    // count 0 é lead inexistente ou lead que já estava nesse status: a leitura separa os dois.
    const lead = await tx.lead.findUnique({ where: { id }, select: CAMPOS });
    if (!lead) return { ok: false, motivo: "nao_encontrado" };
    if (count === 1) {
      await tx.auditoria.create({
        data: {
          acao: status === "atendido" ? "lead.atendido" : "lead.reaberto",
          alvoId: id,
          por,
          detalhe: detalheDe(lead),
        },
      });
    }
    return { ok: true, lead: paraDto(lead), mudou: count === 1 };
  });
}

export type ResultadoTitular = { ok: true; quantidade: number } | { ok: false; motivo: FalhaLead };

// Apaga todos os leads de um titular, pelo e-mail ou pelo telefone (com os dois, apaga o
// que casar com qualquer um). Numa transação só: lê os ids, apaga esses ids e grava UMA
// linha de auditoria, sem dado pessoal: a quantidade apagada e os tipos que havia. O
// alvoId é o do primeiro lead apagado: um id sintético feito do e-mail ou do telefone
// seria dado pessoal com outra roupa. Sem nenhum lead que case, não apaga nem audita.
export async function apagarTitular(alvo: AlvoDoTitular, por: string): Promise<ResultadoTitular> {
  if (!env.hasDb()) return { ok: false, motivo: "indisponivel" };
  const criterios: Prisma.LeadWhereInput[] = [];
  if (alvo.email) criterios.push({ email: alvo.email });
  if (alvo.telefone) criterios.push({ telefone: alvo.telefone });
  // A rota já exige um dos dois. Sem critério, um OR vazio não casaria nada de qualquer jeito.
  if (criterios.length === 0) return { ok: false, motivo: "nao_encontrado" };

  return getPrisma().$transaction(async (tx): Promise<ResultadoTitular> => {
    const linhas = await tx.lead.findMany({ where: { OR: criterios }, select: { id: true, tipo: true } });
    if (linhas.length === 0) return { ok: false, motivo: "nao_encontrado" };
    // Apaga por id, não pela condição: o que chegar depois da leitura fica de fora, e a
    // auditoria conta só o que esta transação apagou.
    const { count } = await tx.lead.deleteMany({ where: { id: { in: linhas.map((l) => l.id) } } });
    if (count === 0) return { ok: false, motivo: "nao_encontrado" };
    await tx.auditoria.create({
      data: {
        acao: "lead.titular_apagado",
        alvoId: linhas[0].id,
        por,
        detalhe: { quantidade: count, tipos: [...new Set(linhas.map((l) => l.tipo))].sort() },
      },
    });
    return { ok: true, quantidade: count };
  });
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
