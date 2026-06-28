#!/usr/bin/env node
// WaveOps secret-scan: PreToolUse hook que bloqueia Write/Edit com segredo.
// Implementa a regra OWASP "hook bloqueia Write se detectar padrao".
// Falha aberta (exit 0) em qualquer erro proprio, para nunca travar o fluxo por bug do hook.

const HIGH_CONFIDENCE = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI API key", re: /sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { name: "Slack token", re: /xox[bpoas]-[0-9A-Za-z-]{10,}/ },
  { name: "GitHub PAT (classic)", re: /ghp_[A-Za-z0-9]{36}/ },
  { name: "GitHub PAT (fine-grained)", re: /github_pat_[A-Za-z0-9_]{50,}/ },
  { name: "Stripe secret key", re: /(?:sk|rk)_live_[A-Za-z0-9]{20,}/ },
  { name: "Apify token", re: /apify_api_[A-Za-z0-9]{20,}/ },
  { name: "AWS access key id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
];

// Strings que indicam placeholder, nao segredo real.
const PLACEHOLDER = /(example|placeholder|xxxx|your[-_]|changeme|<[^>]+>|\.\.\.|dummy|fake|sample)/i;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function collectText(input) {
  if (!input || typeof input !== "object") return "";
  const parts = [];
  if (typeof input.content === "string") parts.push(input.content);
  if (typeof input.new_string === "string") parts.push(input.new_string);
  if (typeof input.new_source === "string") parts.push(input.new_source);
  if (Array.isArray(input.edits)) {
    for (const e of input.edits) {
      if (e && typeof e.new_string === "string") parts.push(e.new_string);
    }
  }
  return parts.join("\n");
}

const raw = await readStdin();
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // sem JSON valido: nao bloqueia
}

const text = collectText(payload.tool_input);
if (!text) process.exit(0);

const hits = [];
for (const { name, re } of HIGH_CONFIDENCE) {
  const m = text.match(re);
  if (m && !PLACEHOLDER.test(m[0])) hits.push(`${name}: ${m[0].slice(0, 12)}...`);
}

if (hits.length === 0) process.exit(0);

process.stderr.write(
  "BLOQUEADO pelo secret-scan da WaveOps. Possivel segredo no conteudo:\n" +
    hits.map((h) => "  - " + h).join("\n") +
    "\n\nUse variavel de ambiente ou referencia de credencial. Nada de segredo hardcoded.\n" +
    "Se for falso positivo, ajuste .claude/hooks/secret-scan.mjs.\n"
);
process.exit(2); // exit 2 = bloqueia a tool call no Claude Code
