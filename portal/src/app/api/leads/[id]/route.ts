import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { log } from "@/server/log";
import { ERRO_SEM_BANCO, apagarLead, descreverErro } from "@/server/leads-admin";

// Apaga o lead a pedido do titular (LGPD). Não tem desfazer. A exclusão fica em Auditoria
// só com o id, o tipo e a hora de chegada, e o log traz o id sem nenhum dado pessoal.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const { id } = await params;

  try {
    const r = await apagarLead(id, u.email);
    if (!r.ok) {
      return r.motivo === "nao_encontrado" ? err("Lead não encontrado", 404) : err(ERRO_SEM_BANCO, 503);
    }
    log.info("admin.lead_apagado", { leadId: id, por: u.email });
    return ok({ ok: true, id });
  } catch (e) {
    log.error("admin.lead_apagar_falhou", { leadId: id, erro: descreverErro(e) });
    return err("Não foi possível apagar o lead.", 500);
  }
}
