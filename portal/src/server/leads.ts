import "server-only";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./db";
import { env } from "./env";
import { log } from "./log";
import { notifyDiscord } from "./integrations";
import { rateLimit } from "./ratelimit";
import type { LeadValidado } from "@/lib/leads";

// Lado com efeito colateral dos leads do site: gravar e avisar o time. A regra pura
// (contrato, validação, limpeza) vive em src/lib/leads.ts e é testada lá.

export type ResultadoDaGravacao = "gravado" | "repetido" | "sem-banco";

function paraLinha(lead: LeadValidado, visitorId: string): Prisma.LeadCreateManyInput {
  return {
    tipo: lead.tipo,
    idEnvio: lead.idEnvio,
    nome: lead.nome,
    empresa: lead.empresa,
    email: lead.email,
    telefone: lead.telefone,
    canalRetorno: lead.canalRetorno,
    melhorHorario: lead.melhorHorario,
    dor: lead.dor,
    procura: lead.procura,
    mensagem: lead.mensagem,
    finalidade: lead.finalidade,
    politicaVersao: lead.politicaVersao,
    cienciaTextoVersao: lead.cienciaTextoVersao,
    marketingAceito: lead.marketingAceito,
    marketingTextoVersao: lead.marketingTextoVersao,
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    utmContent: lead.utmContent,
    utmTerm: lead.utmTerm,
    referrer: lead.referrer,
    landingUrl: lead.landingUrl,
    primeiraFonte: lead.primeiraFonte,
    pagina: lead.pagina,
    visitorId,
    enviadoEm: lead.enviadoEm,
    preenchidoEmMs: lead.preenchidoEmMs,
  };
}

// Todo envio válido vira linha; a única repetição descartada é a do mesmo idEnvio. A
// primeira gravação de um id vence: o reenvio do site repete o id, às vezes com a
// primeira tentativa ainda em voo (o navegador desiste aos 12 s, o servidor não), e o
// ON CONFLICT DO NOTHING do createMany resolve sem exceção e sem linha nova.
//
// Não há deduplicação por conteúdo, nem na lista de interesse. A regra antiga do n8n
// ("mesmo e-mail com o mesmo estado de marketing não grava") deixava um terceiro, que
// não prova ser dono do e-mail, suprimir a inscrição real cadastrando o e-mail antes.
// Aqui cada inscrição fica com a própria hora, versões e visitorId, e o histórico
// completo de um e-mail aparece no admin. Consentimento vindo do formulário não prova o
// dono do e-mail: marketing só depois de double opt-in.
export async function gravarLead(lead: LeadValidado, visitorId: string): Promise<ResultadoDaGravacao> {
  if (!env.hasDb()) {
    log.info("lead.mock", { tipo: lead.tipo });
    return "sem-banco";
  }
  const { count } = await getPrisma().lead.createMany({ data: [paraLinha(lead, visitorId)], skipDuplicates: true });
  return count === 1 ? "gravado" : "repetido";
}

const ROTULO_CANAL: Record<string, string> = { whatsapp: "WhatsApp", email: "e-mail", ligacao: "ligação" };
const AVISOS_POR_HORA = 10;

// Aviso no Discord sem dado pessoal: nem nome, nem contato, nem texto livre (nada que a
// pessoa digitou entra, então também não há menção forjada). O dado fica no admin.
// No máximo 10 por hora: acima disso, só o admin, para um ataque de volume não virar
// spam no canal do time.
export async function avisarTime(lead: LeadValidado): Promise<void> {
  if (!rateLimit("aviso:leads", AVISOS_POR_HORA, 3_600_000)) {
    log.info("lead.aviso_suprimido", { tipo: lead.tipo });
    return;
  }
  const admin = `${env.appUrl.replace(/\/+$/, "")}/admin/leads`;
  const texto =
    lead.tipo === "contato"
      ? `Novo lead pelo site (contato, retorno por ${ROTULO_CANAL[lead.canalRetorno ?? ""] ?? "canal não informado"}). Veja no admin: ${admin}`
      : `Nova inscrição na lista de interesse da Plataforma. Veja no admin: ${admin}`;
  await notifyDiscord(texto);
}
