import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// So servimos a landing em "/" quando o landing.html foi sincronizado (build com a
// raiz do repo disponivel, ex.: local/Netlify same-origin). No deploy do portal
// isolado (ex.: Railway, subdominio), o landing.html nao existe e "/" cai no app,
// que redireciona para /cliente/login.
const __dir = dirname(fileURLToPath(import.meta.url));
const hasLanding = existsSync(resolve(__dir, "public", "landing.html"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No MVP nao bloqueamos o build por lint. Erros de tipo continuam barrando.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return {
      beforeFiles: hasLanding ? [{ source: "/", destination: "/landing.html" }] : [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
