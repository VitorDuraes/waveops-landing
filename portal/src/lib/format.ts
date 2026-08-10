// WaveOps Portal - helpers de formatacao (equivalentes a fmt/fmtFull/initials/statusBadge).

import type { Tone } from "@/lib/types";

// "R$ 397" (sem casas decimais)
export function fmt(n: number): string {
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0 });
}

// "R$ 397,00" (duas casas decimais)
export function fmtFull(n: number): string {
  return (
    "R$ " +
    Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// "Agosto 2026": mes e ano correntes, primeira letra maiuscula (pt-BR devolve minuscula).
export function mesAno(d = new Date()): string {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(" de ", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Iniciais a partir do nome ("João Silva" -> "JS"). Tolera nome ausente ou vazio:
// um avatar sem letra nao pode derrubar a tela inteira. [varredura 2026-08-10]
export function initials(name?: string | null): string {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Mapeia status -> [tom, rotulo] para o componente StatusBadge.
const STATUS_MAP: Record<string, [Tone, string]> = {
  ativo: ["ok", "Ativo"],
  pago: ["ok", "Pago"],
  paga: ["ok", "Paga"],
  pendente: ["warn", "Pendente"],
  "em-aberto": ["warn", "Em aberto"],
  aguardando: ["info", "Aguardando pagamento"],
  vencido: ["danger", "Vencido"],
  vencida: ["danger", "Vencida"],
  pausado: ["paused", "Pausado"],
  cancelado: ["neutral", "Cancelado"],
  cancelada: ["neutral", "Cancelada"],
  estornada: ["neutral", "Estornada"],
  reembolsada: ["neutral", "Reembolsada"],
  aberto: ["info", "Aberto"],
  "em-andamento": ["warn", "Em andamento"],
  resolvido: ["ok", "Resolvido"],
  fechado: ["neutral", "Fechado"],
  enviado: ["ok", "Enviado"],
  agendado: ["info", "Agendado"],
  falhou: ["danger", "Falhou"],
};

export function statusMeta(status: string): [Tone, string] {
  return STATUS_MAP[status] || ["neutral", status];
}
