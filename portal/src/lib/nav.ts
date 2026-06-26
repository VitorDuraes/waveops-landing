// Navegacao das areas logadas + metadados de pagina (titulo/breadcrumb da topbar).
import type { IconName } from "@/components/icons";

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  count?: string;
}
export type NavEntry = NavItem | { sec: string };

export const CLIENT_NAV: NavEntry[] = [
  { id: "/cliente", label: "Dashboard", icon: "grid", href: "/cliente" },
  { id: "/cliente/plano", label: "Meu Plano", icon: "plan", href: "/cliente/plano" },
  { id: "/cliente/faturas", label: "Faturas", icon: "invoice", href: "/cliente/faturas" },
  { id: "/cliente/pagamento", label: "Pagamento", icon: "card", href: "/cliente/pagamento" },
  { id: "/cliente/suporte", label: "Fale com a gente", icon: "whatsapp", href: "/cliente/suporte" },
];

export const ADMIN_NAV: NavEntry[] = [
  { sec: "Operação" },
  { id: "/admin", label: "Dashboard", icon: "grid", href: "/admin" },
  { id: "/admin/clientes", label: "Clientes", icon: "users", href: "/admin/clientes" },
  { id: "/admin/faturas", label: "Faturas", icon: "invoice", href: "/admin/faturas" },
  { id: "/admin/followups", label: "Follow-ups", icon: "bell", href: "/admin/followups" },
  { sec: "Configuração" },
  { id: "/admin/planos", label: "Planos", icon: "layers", href: "/admin/planos" },
  { id: "/admin/configuracoes", label: "Configurações", icon: "settings", href: "/admin/configuracoes" },
];

export const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/cliente": { title: "Dashboard", crumb: "WaveOps · Cliente" },
  "/cliente/plano": { title: "Meu Plano", crumb: "Cliente · Plano" },
  "/cliente/faturas": { title: "Faturas", crumb: "Cliente · Faturas" },
  "/cliente/pagamento": { title: "Pagamento", crumb: "Cliente · Pagamento" },
  "/cliente/suporte": { title: "Fale com a gente", crumb: "Cliente · Contato" },
  "/admin": { title: "Dashboard", crumb: "WaveOps · Admin" },
  "/admin/clientes": { title: "Clientes", crumb: "Admin · Clientes" },
  "/admin/faturas": { title: "Faturas", crumb: "Admin · Faturas" },
  "/admin/followups": { title: "Follow-ups", crumb: "Admin · Follow-ups" },
  "/admin/planos": { title: "Planos", crumb: "Admin · Planos" },
  "/admin/configuracoes": { title: "Configurações", crumb: "Admin · Configurações" },
};
