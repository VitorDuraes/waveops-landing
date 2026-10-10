import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { log } from "@/server/log";
import { descreverErro, listarLeads } from "@/server/leads-admin";
import { ERRO_SEM_JSON, ehJson, lerConsulta } from "@/lib/leads-admin";

// Leads do site (contato e lista de interesse) para o painel admin, com os filtros do corpo
// { busca?, tipo?, status? } aplicados no servidor. Devolve os LIMITE_LEADS mais recentes que
// combinam, mais o total e os novos de tudo o que combina. A busca por e-mail completo ou
// telefone acha qualquer lead, por mais antigo que seja (é como se atende um titular).
//
// É POST, e não GET com ?busca=, porque a busca pode ser o e-mail ou o telefone de um titular
// e a URL fica em log de acesso do proxy e no histórico do navegador. Pelo mesmo motivo o
// termo da busca não entra em log nenhum, nem no de erro. Dado pessoal, então só o admin lê, e
// só com JSON, como as outras rotas do admin.
export async function POST(req: NextRequest) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  if (!ehJson(req.headers.get("content-type"))) return err(ERRO_SEM_JSON, 415);
  const corpo: unknown = await req.json().catch(() => null);
  const consulta = lerConsulta(corpo);
  if (!consulta.ok) return err(consulta.erro);

  try {
    const res = ok(await listarLeads(consulta.filtro));
    // Lista de dado pessoal: nenhum cache no caminho, nem o do navegador.
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    log.error("admin.leads_consulta_falhou", { erro: descreverErro(e) });
    return err("Não foi possível carregar os leads.", 500);
  }
}
