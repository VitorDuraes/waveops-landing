/**
 * Define a senha de acesso de um cliente direto no banco.
 *
 * Uso:
 *   npx tsx scripts/set-password.ts <email-do-cliente> [senha]
 *
 * Sem senha, gera uma temporária e imprime na tela. Serve para liberar acesso
 * quando o envio de e-mail está indisponível (domínio não verificado no Resend)
 * ou para resetar a senha de um cliente que perdeu a dele.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function senhaTemporaria(tamanho = 12): string {
  return Array.from(crypto.randomBytes(tamanho), (b) => ALFABETO[b % ALFABETO.length]).join("");
}

// Mesmo formato do portal (src/server/auth.ts): scrypt$<salt>$<hash>.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const [email, senhaArg] = process.argv.slice(2);
  if (!email) {
    console.error("Informe o e-mail do cliente. Ex.: npx tsx scripts/set-password.ts cliente@empresa.com.br");
    process.exit(1);
  }
  const senha = senhaArg || senhaTemporaria();
  if (senha.length < 8) {
    console.error("A senha precisa ter ao menos 8 caracteres.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const cliente = await prisma.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!cliente) {
      console.error(`Nenhum cliente com o e-mail ${email}.`);
      process.exit(1);
    }
    await prisma.customer.update({ where: { id: cliente.id }, data: { passwordHash: hashPassword(senha) } });
    console.log("Acesso definido.");
    console.log(`  Cliente: ${cliente.name || cliente.companyName} (${cliente.id})`);
    console.log(`  Login:   ${cliente.email}`);
    console.log(`  Senha:   ${senha}`);
    console.log("Entre em /cliente/login. Troque a senha depois em Minha conta.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
