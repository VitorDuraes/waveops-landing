// Sincroniza a landing canonica (raiz do repo: index.html + assets/) para o
// public/ do portal, para o Next servir a landing na raiz "/" na mesma origem
// do portal (checkout, cliente, admin). A fonte de verdade continua sendo a raiz;
// estes arquivos em public/ sao gerados (gitignored). Roda no predev/prebuild.
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(here, "..");
const repoRoot = resolve(portalRoot, "..");
const publicDir = resolve(portalRoot, "public");

const srcHtml = resolve(repoRoot, "index.html");
const srcAssets = resolve(repoRoot, "assets");
const outHtml = resolve(publicDir, "landing.html");
const outAssets = resolve(publicDir, "assets");

if (!existsSync(srcHtml)) {
  // Build do portal isolado (ex.: Railway com Root Directory = portal): a raiz do
  // repo (index.html + assets) nao esta no contexto. Nao e erro: pula o sync. O
  // portal nao depende desses assets e "/" redireciona para /cliente/login
  // (next.config so serve a landing em "/" quando o landing.html existe).
  console.warn("[sync-landing] index.html nao encontrado em " + srcHtml + " -> pulando o sync da landing.");
  process.exit(0);
}

mkdirSync(publicDir, { recursive: true });
cpSync(srcHtml, outHtml);
if (existsSync(outAssets)) rmSync(outAssets, { recursive: true, force: true });
if (existsSync(srcAssets)) cpSync(srcAssets, outAssets, { recursive: true });

console.log("[sync-landing] landing.html + assets/ sincronizados para portal/public/");
