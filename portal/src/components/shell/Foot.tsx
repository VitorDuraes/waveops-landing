"use client";
import { initials } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Me } from "@/lib/types";
import { LogoutButton } from "./LogoutButton";

// Bloco do usuario no rodape da sidebar (cliente). Mostra o cliente logado de
// verdade (via /api/me), nunca dado de exemplo. Enquanto carrega, usa um rotulo
// neutro em vez de qualquer nome ficticio.
export function ClientFoot() {
  const { data: me } = useApi<Me>("/api/me");
  const name = me?.name || "Minha conta";
  const company = me?.company || "";
  return (
    <div className="side-user">
      <div className="av">{initials(name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nm">{name}</div>
        <div className="em">{company}</div>
      </div>
      <LogoutButton to="/cliente/login" />
    </div>
  );
}

// Bloco da equipe no rodape da sidebar (admin).
export function AdminFoot() {
  return (
    <div className="side-user">
      <div className="av" style={{ background: "linear-gradient(140deg,#22c55e,#16a34a)" }}>
        WO
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nm">Equipe WaveOps</div>
        <div className="em">Admin · financeiro</div>
      </div>
      <LogoutButton to="/admin/login" />
    </div>
  );
}
