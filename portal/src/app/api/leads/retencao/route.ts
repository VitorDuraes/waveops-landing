import { NextResponse } from "next/server";
import { err, guard, ok } from "@/server/http";
import { consultarPreviaRetencaoLeads } from "@/server/leads-retencao";
import { log } from "@/server/log";

function semCache(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// O administrador consulta todos os cadastros. Nenhum prazo, relógio ou filtro vem
// do navegador. A rota só lê contagens; não agenda nem executa exclusão.
export async function GET() {
  const usuario = await guard(["admin"]);
  if (usuario instanceof NextResponse) return semCache(usuario);
  try {
    const resultado = await consultarPreviaRetencaoLeads(usuario);
    if (!resultado.ok) {
      return semCache(resultado.motivo === "sem_permissao"
        ? err("Sem permissão", 403)
        : err("O portal está sem banco de dados neste ambiente. Não é possível calcular a prévia.", 503));
    }
    return semCache(ok(resultado.previa));
  } catch (erro) {
    // Mensagem de erro do banco pode conter dados de conexão. Registrar apenas a classe.
    log.error("admin.leads_retencao_falhou", { erro: erro instanceof Error ? erro.name : "desconhecido" });
    return semCache(err("Não foi possível calcular a prévia de retenção. Tente de novo.", 500));
  }
}
