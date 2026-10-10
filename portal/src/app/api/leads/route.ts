import { NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { log } from "@/server/log";
import { descreverErro, listarLeads } from "@/server/leads-admin";

// Leads do site (contato e lista de interesse) para o painel admin: os mais recentes
// primeiro, até o limite de LIMITE_LEADS. Dado pessoal, então só o admin lê.
export async function GET() {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  try {
    const res = ok(await listarLeads());
    // Lista de dado pessoal: nenhum cache no caminho, nem o do navegador.
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    log.error("admin.leads_lista_falhou", { erro: descreverErro(e) });
    return err("Não foi possível carregar os leads.", 500);
  }
}
