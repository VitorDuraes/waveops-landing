import { NextRequest } from "next/server";
import { validarContato } from "@/lib/leads";
import { preflight, receberFormulario } from "@/server/formulario-site";

// Formulário de contato do site novo (waveops.com.br/contato/). Contrato e respostas em
// src/server/formulario-site.ts; regra em src/lib/leads.ts.

export async function POST(req: NextRequest) {
  return receberFormulario(req, "contato", validarContato);
}

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}
