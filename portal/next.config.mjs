import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// So servimos a landing em "/" quando o landing.html foi sincronizado (build com a
// raiz do repo disponivel, ex.: local/Netlify same-origin). No deploy do portal
// isolado (ex.: Railway, subdominio), o landing.html nao existe e "/" cai no app,
// que redireciona para /cliente/login.
const __dir = dirname(fileURLToPath(import.meta.url));
const hasLanding = existsSync(resolve(__dir, "public", "landing.html"));

// Headers de seguranca em todas as respostas do portal. A Railway permite headers
// HTTP (a landing no GitHub Pages/Netlify nao permitia X-Frame-Options). Nao colocamos
// uma CSP restritiva (default-src) para nao quebrar os scripts/estilos inline do Next
// sem nonce; usamos so frame-ancestors (anti-clickjacking) + X-Frame-Options. [audit 2026-06-28]
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A raiz do workspace e a pasta do portal. Sem isto o Turbopack acha o
  // package-lock.json da raiz do repo (da landing) e avisa a cada boot.
  turbopack: { root: __dir },
  // O Next 16.3 gera portal/AGENTS.md + portal/CLAUDE.md sozinho a cada boot. O
  // projeto ja tem o proprio CLAUDE.md (raiz, importando .claude/waveops-base.md)
  // e um teto declarado de contexto carregado por sessao. Instrucao que entra sem
  // decisao escrita nao entra: desligado.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    return {
      beforeFiles: hasLanding ? [{ source: "/", destination: "/landing.html" }] : [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
