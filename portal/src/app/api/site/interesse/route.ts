import { NextRequest } from "next/server";
import { validarInteresse } from "@/lib/leads";
import { preflight, receberFormulario } from "@/server/formulario-site";

// Lista de interesse da Plataforma (waveops.com.br/plataforma/). Contrato e respostas em
// src/server/formulario-site.ts; regra em src/lib/leads.ts.

export async function POST(req: NextRequest) {
  return receberFormulario(req, "interesse", validarInteresse);
}

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}
