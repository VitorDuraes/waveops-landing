// Chamadas de escrita das telas de leads do admin (a tabela e o modal de detalhe).

// As rotas de escrita só aceitam application/json.
export const CABECALHO_JSON = { "Content-Type": "application/json" } as const;

// Chama a API do admin. Falha vira Error com o texto que a API devolveu, pronto para o toast.
export async function chamar<T = unknown>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const corpo: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const erro = typeof corpo === "object" && corpo !== null ? (corpo as { error?: unknown }).error : undefined;
    throw new Error(typeof erro === "string" && erro ? erro : "Não foi possível concluir a ação. Tente de novo.");
  }
  return corpo as T;
}
