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
      const [contatoTotal, contatoPrazo, interesseTotal, interessePrazo] = await db.$transaction([
        db.lead.count({ where: { tipo: "contato" } }),
        db.lead.count({ where: limites.contato.where }),
        db.lead.count({ where: { tipo: "interesse" } }),
        db.lead.count({ where: limites.interesse.where }),
      ], { isolationLevel: "RepeatableRead" });
      return {
        contato: { total: contatoTotal, prazoAtingido: contatoPrazo },
        interesse: { total: interesseTotal, prazoAtingido: interessePrazo },
      };
    } : null,
  });
}
