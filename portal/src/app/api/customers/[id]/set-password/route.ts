import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { hashPassword } from "@/server/auth";
import { log } from "@/server/log";

// Gera uma senha temporaria legivel (sem caracteres ambiguos como O/0 e l/1).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function senhaTemporaria(tamanho = 12): string {
  const bytes = crypto.randomBytes(tamanho);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

// Define (ou reseta) a senha de acesso de um cliente. Fluxo de ADMIN: existe porque
// o caminho automatico depende do e-mail chegar, e enquanto o remetente nao estiver
// verificado o cliente ficaria sem entrar. A senha volta UMA vez na resposta, para o
// time repassar pelo WhatsApp; nao fica guardada em texto puro em lugar nenhum.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const { id } = await params;

  const cust = await getRepo().getCustomerById(id);
  if (!cust) return err("Cliente não encontrado", 404);

  const body = await req.json().catch(() => ({}) as { password?: string });
  const password = typeof body.password === "string" && body.password.length ? body.password : senhaTemporaria();
  if (password.length < 8) return err("A senha precisa ter ao menos 8 caracteres");

  await getRepo().setCustomerPassword(id, hashPassword(password));
  // Auditoria: quem resetou, para quem e quando. A senha NUNCA entra no log.
  log.info("admin.senha_definida", { customerId: id, email: cust.email, porAdmin: u.email });

  return ok({ ok: true, email: cust.email, password });
}
