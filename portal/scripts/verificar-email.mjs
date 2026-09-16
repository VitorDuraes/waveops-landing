// Diagnostico do e-mail do dominio waveops.com.br.
//
// Existe porque o e-mail de ativacao e o UNICO caminho automatico de um cliente que
// pagou entrar no portal. Quando ele quebra, o cliente paga e nao recebe nada, e o
// time so descobre pelo alerta no Discord. Este script responde, em um comando, se o
// caminho esta de pe: `npm run check:email`.
//
// Nao envia e-mail para ninguem. O teste de envio, quando ligado com --enviar, usa o
// endereco-sumidouro oficial do Resend (delivered@resend.dev), que nao entrega a
// nenhuma caixa real.
//
// Uso:
//   node scripts/verificar-email.mjs              (so DNS)
//   node scripts/verificar-email.mjs --enviar     (DNS + teste de envio no Resend)

import { promises as dns } from "node:dns";

// Resolvedor publico explicito. Com o DNS da maquina, um resolvedor corporativo ou do
// provedor pode responder diferente do que o resto do mundo ve, e o que importa aqui e
// exatamente o que o mundo ve. Na primeira versao deste script isso escondeu o DMARC
// que estava publicado.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const DOMINIO = process.env.EMAIL_DOMINIO || "waveops.com.br";
const REMETENTE = process.env.EMAIL_FROM || `WaveOps <nao-responder@${DOMINIO}>`;
const enviar = process.argv.includes("--enviar");

const ok = (m) => console.log(`  [ok]    ${m}`);
const falha = (m) => console.log(`  [FALHA] ${m}`);
const aviso = (m) => console.log(`  [aviso] ${m}`);

let problemas = 0;

async function txt(nome) {
  try {
    return (await dns.resolveTxt(nome)).map((p) => p.join(""));
  } catch {
    return [];
  }
}

async function mx(nome) {
  try {
    return await dns.resolveMx(nome);
  } catch {
    return [];
  }
}

console.log(`\nDominio: ${DOMINIO}`);
console.log(`Remetente configurado: ${REMETENTE}\n`);

// 1. SPF. Sem ele, o receptor nao tem como saber que o Resend pode mandar pelo dominio.
console.log("SPF");
const spfRaiz = (await txt(DOMINIO)).filter((t) => t.toLowerCase().startsWith("v=spf1"));
const spfSend = (await txt(`send.${DOMINIO}`)).filter((t) => t.toLowerCase().startsWith("v=spf1"));
if (spfSend.length) ok(`send.${DOMINIO}: ${spfSend[0]}`);
else if (spfRaiz.length) aviso(`so na raiz: ${spfRaiz[0]} (o Resend pede no subdominio send.)`);
else {
  falha(`nenhum registro SPF em ${DOMINIO} nem em send.${DOMINIO}`);
  problemas++;
}

// 2. DKIM. E o que assina a mensagem. Sem ele o Resend nem verifica o dominio.
console.log("\nDKIM");
const dkim = await txt(`resend._domainkey.${DOMINIO}`);
if (dkim.length) ok(`resend._domainkey: chave publica presente (${dkim[0].length} caracteres)`);
else {
  falha(`resend._domainkey.${DOMINIO} nao existe`);
  problemas++;
}

// 3. MX do subdominio de envio (o Resend usa para bounce/feedback).
console.log("\nMX de envio");
const mxSend = await mx(`send.${DOMINIO}`);
if (mxSend.length) ok(`send.${DOMINIO}: ${mxSend.map((m) => m.exchange).join(", ")}`);
else {
  falha(`send.${DOMINIO} sem MX`);
  problemas++;
}

// 4. DMARC. O ponto perigoso: politica restritiva SEM SPF e DKIM joga todo e-mail do
// dominio para spam, inclusive os que o Resend conseguir mandar.
console.log("\nDMARC");
const dmarc = (await txt(`_dmarc.${DOMINIO}`)).filter((t) => t.toLowerCase().startsWith("v=dmarc1"));
if (dmarc.length) {
  const politica = (dmarc[0].match(/p=(\w+)/) || [])[1] || "none";
  ok(`politica p=${politica}`);
  if (politica !== "none" && (!dkim.length || (!spfSend.length && !spfRaiz.length))) {
    falha(`p=${politica} sem SPF/DKIM completos: todo e-mail do dominio cai em spam ou e recusado`);
    problemas++;
  }
} else aviso("sem DMARC (nao bloqueia o envio, mas piora a entregabilidade)");

// 5. MX da raiz. Nao tem a ver com envio: e a caixa que RECEBE. A landing publica um
// endereco @waveops.com.br, e sem MX na raiz toda resposta de lead volta como erro.
console.log("\nRecebimento na raiz (caixa de contato da landing)");
const mxRaiz = await mx(DOMINIO);
if (mxRaiz.length) ok(`${DOMINIO}: ${mxRaiz.map((m) => m.exchange).join(", ")}`);
else {
  falha(`${DOMINIO} sem MX: contato@${DOMINIO} nao recebe nada, toda mensagem volta`);
  problemas++;
}

// 6. Teste de envio de verdade, opcional.
if (enviar) {
  console.log("\nEnvio pelo Resend");
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    aviso("RESEND_API_KEY ausente no ambiente: teste de envio pulado");
  } else {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        from: REMETENTE,
        to: ["delivered@resend.dev"],
        subject: "Verificacao de dominio WaveOps",
        html: "<p>Teste automatico. Nao entregue a nenhuma caixa real.</p>",
      }),
    });
    const corpo = await res.text();
    if (res.ok) ok(`o Resend aceitou o envio (HTTP ${res.status})`);
    else {
      falha(`HTTP ${res.status}: ${corpo.slice(0, 200)}`);
      problemas++;
    }
  }
} else {
  console.log("\n(rode com --enviar para testar o envio de verdade no Resend)");
}

console.log(
  problemas === 0
    ? "\nResultado: caminho de e-mail de pe.\n"
    : `\nResultado: ${problemas} problema(s). O e-mail de ativacao do cliente NAO funciona ate resolver.\n`
);
// exitCode em vez de process.exit(): com as consultas de DNS ainda fechando, o exit
// abrupto derruba o libuv no Windows com "UV_HANDLE_CLOSING" e devolve 127, que
// mascararia o resultado real do diagnostico.
process.exitCode = problemas === 0 ? 0 : 1;
