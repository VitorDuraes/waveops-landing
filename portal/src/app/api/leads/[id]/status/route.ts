import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { log } from "@/server/log";
import { ERRO_SEM_BANCO, descreverErro, mudarStatusLead } from "@/server/leads-admin";
import { ERRO_SEM_JSON, ehJson, statusDoCorpo } from "@/lib/leads-admin";

// Marca o lead como atendido ou reabre. Cada mudança grava uma linha em Auditoria. Só
// aceita JSON: sem isso, um formulário de outra origem alcançaria a rota com o cookie.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  if (!ehJson(req.headers.get("content-type"))) return err(ERRO_SEM_JSON, 415);
  const { id } = await params;
  const corpo: unknown = await req.json().catch(() => null);
  const status = statusDoCorpo(corpo);
  if (!status) return err("Status inválido. Use: novo ou atendido.");

  try {
    const r = await mudarStatusLead(id, status, u.email);
    if (!r.ok) {
      return r.motivo === "nao_encontrado" ? err("Lead não encontrado", 404) : err(ERRO_SEM_BANCO, 503);
    }
    if (r.mudou) {
      log.info(status === "atendido" ? "admin.lead_atendido" : "admin.lead_reaberto", { leadId: id, por: u.email });
    }
    return ok({ ok: true, lead: r.lead });
  } catch (e) {
    log.error("admin.lead_status_falhou", { leadId: id, erro: descreverErro(e) });
    return err("Não foi possível atualizar o lead.", 500);
  }
}
