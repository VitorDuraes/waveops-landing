import "server-only";
import { env } from "./env";
import { maskEmail } from "./log";

// Todas as integracoes degradam para "mock" (apenas log) quando nao ha credencial,
// para o app rodar sem nenhum servico externo configurado.

export async function notifyDiscord(content: string): Promise<void> {
  if (!env.discordWebhook) {
    console.log("[discord:mock]", content);
    return;
  }
  try {
    await fetch(env.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.error("[discord] erro", e);
  }
}

// Monta um link wa.me com mensagem pre-preenchida. Normaliza o telefone (so digitos)
// e prefixa 55 (Brasil) quando o numero nao traz o codigo do pais. Retorna "" se o
// telefone for curto demais para ser um celular valido.
export function waLink(phone: string, text: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const withCountry = digits.startsWith("55") ? digits : "55" + digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

// Alerta interno disparado quando um cliente paga e ativa pela primeira vez. O time
// recebe os dados e um link wa.me ja pronto para abrir a conversa e falar do projeto.
// Estrategia atual: contato MANUAL (sem disparo automatico ao cliente).
export async function notifyTeamNewCustomer(c: {
  name: string;
  company: string;
  plan: string;
  amountReais: number;
  phone: string;
  email: string;
}): Promise<void> {
  const firstName = (c.name || "").split(" ")[0] || "tudo bem";
  const welcome =
    `Olá ${firstName}! Aqui é da WaveOps. Recebemos seu pagamento do plano ${c.plan}. ` +
    `Seja bem-vindo. Quando puder, me conta um pouco do que você quer automatizar pra já começarmos seu projeto.`;
  const link = waLink(c.phone, welcome);
  const valor = `R$ ${c.amountReais.toLocaleString("pt-BR")}/mês`;

  // Discord e canal de TERCEIRO com retencao indefinida: nao mandar PII completa.
  // Telefone, e-mail completo e o link wa.me vao no e-mail interno ao time (abaixo) e
  // no painel admin autenticado, nao no canal. [M2 do audit 2026-06-28]
  const linhas = [
    "Novo cliente pagou e ativou.",
    `${c.company} (${firstName})`,
    `Plano: ${c.plan} · ${valor}`,
    `Contato: ${maskEmail(c.email)} (dados completos no e-mail interno e no painel)`,
  ];
  await notifyDiscord(linhas.join("\n"));

  const btn = link
    ? `<p><a href="${link}" style="background:#7c3aed;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Falar no WhatsApp</a></p>`
    : "<p>WhatsApp inválido. Fale com o cliente por e-mail.</p>";
  const html =
    `<h2>Novo cliente pagou e ativou</h2>` +
    `<p><strong>${c.company}</strong> (${c.name})<br>` +
    `Plano: ${c.plan} · ${valor}<br>` +
    `WhatsApp: ${c.phone || "não informado"}<br>` +
    `E-mail: ${c.email}</p>` +
    btn;
  await sendEmail(env.teamNotifyEmail, `Novo cliente WaveOps: ${c.company}`, html);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!env.resendKey) {
    console.log(`[email:mock] para ${to} · ${subject}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.resendKey}` },
      // Envia tambem em texto puro: melhora entregabilidade e cobre clientes sem HTML.
      body: JSON.stringify({ from: env.emailFrom, to, subject, html, text: htmlToText(html) }),
    });
    // Resend devolve 200/201 no sucesso. Erro comum: 403 (dominio nao verificado) ou
    // 422 (from fora do dominio). Antes isso era engolido; agora loga o motivo para
    // o problema aparecer no painel do Netlify em vez de "e-mail sumiu".
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend recusou (${res.status}) para ${to}: ${detail.slice(0, 300)}`);
    }
  } catch (e) {
    console.error("[email] erro de rede", e);
  }
}

// Versao texto puro do corpo HTML (fallback de entregabilidade). Remove tags e
// normaliza espacos; suficiente para os e-mails simples do portal.
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h\d|div)>/gi, "\n")
    // Preserva o link dos botoes <a href="URL">TEXTO</a> como "TEXTO: URL" antes de
    // remover as tags (senao a URL sumiria no fallback de texto puro).
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
