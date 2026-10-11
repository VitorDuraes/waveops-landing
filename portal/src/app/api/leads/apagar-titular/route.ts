import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { log } from "@/server/log";
import { ERRO_SEM_BANCO, apagarTitular, descreverErro } from "@/server/leads-admin";
import { ERRO_SEM_JSON, ehJson, lerAlvoDoTitular } from "@/lib/leads-admin";

// Apaga todos os leads de um titular (LGPD), pelo e-mail ou pelo telefone: { email?, telefone? }.
// Uma auditoria só, sem dado pessoal. Só aceita JSON, como as outras rotas de escrita do
// admin: sem isso, um formulário de outra origem alcançaria a rota com o cookie.
export async function POST(req: NextRequest) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  if (!ehJson(req.headers.get("content-type"))) return err(ERRO_SEM_JSON, 415);
  const corpo: unknown = await req.json().catch(() => null);
  const leitura = lerAlvoDoTitular(corpo);
  if (!leitura.ok) return err(leitura.erro);

  try {
    const r = await apagarTitular(leitura.alvo, u.email);
    if (!r.ok) {
      return r.motivo === "nao_encontrado" ? err("Nenhum lead com esse e-mail ou telefone.", 404) : err(ERRO_SEM_BANCO, 503);
    }
    // O log leva só a quantidade: nem o e-mail nem o telefone do titular.
    log.info("admin.leads_titular_apagado", { quantidade: r.quantidade, por: u.email });
    return ok({ ok: true, quantidade: r.quantidade });
  } catch (e) {
    log.error("admin.leads_titular_falhou", { erro: descreverErro(e) });
    return err("Não foi possível apagar os leads.", 500);
  }
}
