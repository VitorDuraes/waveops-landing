import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { getPrisma } from "./db";
import { env } from "./env";
import {
  executarAlteracaoRetencao, executarConsultaRetencao,
  type ResultadoPortaAlteracao,
} from "@/lib/leads-excecoes";

const CAMPOS = {
  versao: true, justificativa: true, registradaEm: true, revisarEm: true, por: true,
} satisfies Prisma.LeadRetencaoSelect;

export async function consultarRetencaoLead(usuario: SessionUser | null, id: string) {
  return executarConsultaRetencao({
    papel: usuario?.role ?? null, agora: () => new Date(),
    consultar: env.hasDb() ? async (leadId) => {
      const lead = await getPrisma().lead.findUnique({ where: { id: leadId }, select: { retencao: { select: CAMPOS } } });
      return lead ? { registro: lead.retencao } : null;
    } : null,
  }, id);
}

export async function alterarRetencaoLead(usuario: SessionUser | null, id: string, corpo: unknown) {
  return executarAlteracaoRetencao({
    papel: usuario?.role ?? null, por: usuario?.email ?? null, agora: () => new Date(),
    alterar: env.hasDb() ? async (leadId, comando, por): Promise<ResultadoPortaAlteracao> => {
      const db = getPrisma();
      try {
        return await db.$transaction(async (tx): Promise<ResultadoPortaAlteracao> => {
          const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { tipo: true, retencao: { select: CAMPOS } } });
          if (!lead) return { ok: false, motivo: "nao_encontrado" };
          if ((lead.retencao?.versao ?? 0) !== comando.versao) return { ok: false, motivo: "conflito" };
          if (comando.acao === "encerrar" && !lead.retencao?.justificativa) {
            return { ok: true, registro: lead.retencao, mudou: false };
          }
          if (!lead.retencao) {
            // ON CONFLICT não aborta a transação quando dois primeiros registros disputam a PK.
            await tx.leadRetencao.createMany({ data: [{ leadId }], skipDuplicates: true });
          }
          const atualizada = await tx.leadRetencao.updateMany({
            where: { leadId, versao: comando.versao },
            data: comando.acao === "registrar"
              ? { versao: { increment: 1 }, justificativa: comando.justificativa, registradaEm: comando.registradaEm, revisarEm: comando.revisarEm, por }
              : { versao: { increment: 1 }, justificativa: null, registradaEm: null, revisarEm: null, por: null },
          });
          if (atualizada.count === 0) {
            const existe = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true } });
            return { ok: false, motivo: existe ? "conflito" : "nao_encontrado" };
          }
          const registro = await tx.leadRetencao.findUniqueOrThrow({ where: { leadId }, select: CAMPOS });
          // Responsável e alvo são dados pessoais. Justificativa e contatos nunca entram na auditoria.
          await tx.auditoria.create({ data: {
            acao: comando.acao === "registrar" ? "lead.excecao_registrada" : "lead.excecao_encerrada",
            alvoId: leadId, por,
            detalhe: { tipo: lead.tipo, versao: registro.versao, registradaEm: registro.registradaEm?.toISOString() ?? null, revisarEm: registro.revisarEm?.toISOString() ?? null },
          } });
          return { ok: true, registro, mudou: true };
        });
      } catch (erro) {
        // A FK pode perder a corrida para uma exclusão. A transação já foi revertida.
        if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2003") {
          if (!await db.lead.findUnique({ where: { id: leadId }, select: { id: true } })) return { ok: false, motivo: "nao_encontrado" };
        }
        throw erro;
      }
    } : null,
  }, id, corpo);
}
