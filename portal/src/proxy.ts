import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Proxy (edge, ex-middleware do Next 15): protege /cliente e /admin checando a
// sessao JWT. Checagem OTIMISTA: a barreira real e o guard() nas rotas de API.
// Mantido leve e independente do restante do servidor (sem Prisma/node:crypto).
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-insecure-session-secret-troque-em-producao-min-32"
);
const ENFORCED = (process.env.AUTH_ENFORCED || "true") !== "false";

async function getRole(req: NextRequest): Promise<"customer" | "admin" | null> {
  const token = req.cookies.get("waveops_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    const role = payload.role;
    return role === "customer" || role === "admin" ? role : null;
  } catch {
    return null;
  }
}

function toLogin(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // paginas de login/ativacao sempre liberadas (evita loop de redirecionamento)
  if (pathname === "/cliente/login" || pathname === "/admin/login" || pathname === "/cliente/ativar") {
    return NextResponse.next();
  }
  if (!ENFORCED) return NextResponse.next();

  const role = await getRole(req);
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") return toLogin(req, "/admin/login");
  } else if (pathname.startsWith("/cliente")) {
    if (!role) return toLogin(req, "/cliente/login");
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/cliente", "/cliente/:path*", "/admin", "/admin/:path*"],
};
