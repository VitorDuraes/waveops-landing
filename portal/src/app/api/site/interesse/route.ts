import { NextRequest } from "next/server";
import { validarInteresse } from "@/lib/leads";
import { preflight, receberFormularioDoSite } from "@/server/formulario-site";

// Lista de interesse da Plataforma (waveops.com.br/plataforma/). Contrato e respostas em
// src/lib/receber-formulario.ts; regra em src/lib/leads.ts.

export async function POST(req: NextRequest) {
  return receberFormularioDoSite(req, "interesse", validarInteresse);
}

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}
