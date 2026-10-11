import { NextRequest, NextResponse } from "next/server";
import { err, guard, ok } from "@/server/http";
import { alterarRetencaoLead, consultarRetencaoLead } from "@/server/leads-excecoes";
import { ERRO_SEM_JSON, ehJson } from "@/lib/leads-admin";
import type { ResultadoAlteracaoRetencao, ResultadoConsultaRetencao } from "@/lib/leads-excecoes";
import { log } from "@/server/log";

type Contexto = { params: Promise<{ id: string }> };
function semCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}
function resposta(resultado: ResultadoConsultaRetencao | ResultadoAlteracaoRetencao) {
  if (resultado.ok) return semCache(ok(resultado.consulta));
  switch (resultado.motivo) {
    case "sem_permissao": return semCache(err("Sem permissão", 403));
    case "sem_banco": return semCache(err("O portal está sem banco de dados. Não é possível consultar ou alterar exceções.", 503));
    case "nao_encontrado": return semCache(err("Lead não encontrado", 404));
    case "conflito": return semCache(err("Outra alteração foi registrada. Recarregue a exceção antes de tentar novamente.", 409));
    case "entrada_invalida": return semCache(err(resultado.erro, 400));
  }
}
function falha(erro: unknown) {
  log.error("admin.lead_excecao_falhou", { erro: erro instanceof Error ? erro.name : "desconhecido" });
  if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2021") {
    return semCache(err("A estrutura de retenção está indisponível. Verifique as migrações do portal.", 503));
  }
  return semCache(err("Não foi possível confirmar a operação de retenção. Recarregue antes de repetir uma alteração.", 500));
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const usuario = await guard(["admin"]);
  if (usuario instanceof NextResponse) return semCache(usuario);
  try {
    return resposta(await consultarRetencaoLead(usuario, (await params).id));
  } catch (erro) {
    return falha(erro);
  }
}
export async function POST(req: NextRequest, { params }: Contexto) {
  const usuario = await guard(["admin"]);
  if (usuario instanceof NextResponse) return semCache(usuario);
  if (!ehJson(req.headers.get("content-type"))) return semCache(err(ERRO_SEM_JSON, 415));
  const corpo: unknown = await req.json().catch(() => null);
  try {
    return resposta(await alterarRetencaoLead(usuario, (await params).id, corpo));
  } catch (erro) {
    return falha(erro);
  }
}
