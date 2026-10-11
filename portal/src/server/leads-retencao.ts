import "server-only";
import type { SessionUser } from "./auth";
import { getPrisma } from "./db";
import { env } from "./env";
import { executarPreviaRetencaoLeads, type ResultadoPreviaRetencao } from "@/lib/leads-retencao";

// Somente agregados. Não selecionar nem levar ao cliente IDs, contatos ou texto
// livre. Um snapshot mantém total e subconjunto coerentes sob inserção/exclusão.
export async function consultarPreviaRetencaoLeads(usuario: SessionUser | null): Promise<ResultadoPreviaRetencao> {
  return executarPreviaRetencaoLeads({
    papel: usuario?.role ?? null,
    agora: () => new Date(),
    contar: env.hasDb() ? async (limites) => {
      const db = getPrisma();
      const agora = new Date(limites.calculadaEm);
      const [contatoTotal, contatoPrazo, contatoVigente, contatoVencida, interesseTotal, interessePrazo, interesseVigente, interesseVencida] = await db.$transaction([
        db.lead.count({ where: { tipo: "contato" } }),
        db.lead.count({ where: limites.contato.where }),
        db.lead.count({ where: { ...limites.contato.where, retencao: { is: { revisarEm: { gt: agora } } } } }),
        db.lead.count({ where: { ...limites.contato.where, retencao: { is: { revisarEm: { lte: agora } } } } }),
        db.lead.count({ where: { tipo: "interesse" } }),
        db.lead.count({ where: limites.interesse.where }),
        db.lead.count({ where: { ...limites.interesse.where, retencao: { is: { revisarEm: { gt: agora } } } } }),
        db.lead.count({ where: { ...limites.interesse.where, retencao: { is: { revisarEm: { lte: agora } } } } }),
      ], { isolationLevel: "RepeatableRead" });
      return {
        contato: { total: contatoTotal, prazoAtingido: contatoPrazo, revisaoVigente: contatoVigente, revisaoVencida: contatoVencida },
        interesse: { total: interesseTotal, prazoAtingido: interessePrazo, revisaoVigente: interesseVigente, revisaoVencida: interesseVencida },
      };
    } : null,
  });
}
