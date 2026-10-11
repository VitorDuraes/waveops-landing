"use client";
// Hook de leitura da lista de leads do admin: faz POST /api/leads/consulta com os filtros e
// expõe { data, loading, error, reload }, no mesmo formato do useApi. É POST, e não GET,
// porque a busca pode ser o e-mail ou o telefone de um titular: no corpo ela não fica em
// log de acesso do proxy nem no histórico do navegador, como ficaria numa URL.
import { useCallback, useEffect, useState } from "react";
import { CABECALHO_JSON, chamar } from "@/lib/leads-client";
import type { FiltroLeads, ListaLeads } from "@/lib/leads-admin";
import type { ApiState } from "@/lib/useApi";

export function useConsultaLeads({ tipo, status, busca }: FiltroLeads): ApiState<ListaLeads> {
  const [data, setData] = useState<ListaLeads | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    chamar<ListaLeads>("/api/leads/consulta", {
      method: "POST",
      headers: CABECALHO_JSON,
      cache: "no-store",
      body: JSON.stringify({ tipo, status, busca }),
    })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tipo, status, busca, nonce]);

  return { data, loading, error, reload };
}
