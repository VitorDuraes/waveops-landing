"use client";
// Briefing do projeto, em destaque no dashboard do cliente. Na primeira entrada
// (sem briefing) mostra o formulario; depois de enviado, vira um resumo discreto.
// O envio espelha o projeto no WaveOps CRM (Twenty) e avisa o time (rota /api/me/briefing).
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/providers";
import { useApi } from "@/lib/useApi";
import type { ProjectBrief } from "@/lib/types";

export function BriefingCard() {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ brief: ProjectBrief | null }>("/api/me/briefing");
  const [sending, setSending] = useState(false);

  if (loading) return null;
  const brief = data?.brief ?? null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSending(true);
    try {
      const res = await fetch("/api/me/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: fd.get("goal"),
          currentTool: fd.get("currentTool"),
          pain: fd.get("pain"),
          volume: fd.get("volume"),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha ao enviar o briefing");
      toast("Briefing enviado! Nossa equipe já vai te chamar no WhatsApp.");
      reload();
    } catch (err) {
      toast((err as Error).message, "info");
    } finally {
      setSending(false);
    }
  }

  if (brief) {
    return (
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="section-title">Seu projeto</div>
        <p className="muted" style={{ marginTop: -4 }}>
          Recebemos seu briefing em {brief.createdAt}. Nossa equipe entra em contato pelo WhatsApp para dar o pontapé.
        </p>
        <div className="lrow">
          <div className="ic" style={{ color: "var(--accent-strong)" }}>
            <Icon name="checkCircle" />
          </div>
          <div className="gr">
            <div className="t">O que você quer automatizar</div>
            <div className="s">{brief.goal}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit} style={{ marginBottom: 22, borderColor: "var(--accent)" }}>
      <div className="section-title">Conta pra gente seu projeto</div>
      <p className="muted" style={{ marginTop: -4 }}>
        Pra já começar, descreva o que você quer automatizar. A gente usa isso pra montar seu projeto e te chamar no WhatsApp.
      </p>
      <div className="field">
        <label htmlFor="brief-o-que-voce-quer-automatizar-ou-construir">O que você quer automatizar ou construir?</label>
        <textarea id="brief-o-que-voce-quer-automatizar-ou-construir"
          name="goal"
          required
          minLength={10}
          placeholder="Ex.: automatizar o envio de boletos e o follow-up de cobrança no WhatsApp."
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="brief-ferramenta-que-usa-hoje">Ferramenta que usa hoje</label>
          <input id="brief-ferramenta-que-usa-hoje" name="currentTool" placeholder="Ex.: planilha, n8n, Bling, nenhuma" />
        </div>
        <div className="field">
          <label htmlFor="brief-volume-por-mes-aprox">Volume por mês (aprox.)</label>
          <input id="brief-volume-por-mes-aprox" name="volume" placeholder="Ex.: 300 pedidos/mês" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="brief-qual-a-maior-dor-hoje">Qual a maior dor hoje?</label>
        <input id="brief-qual-a-maior-dor-hoje" name="pain" placeholder="Ex.: perco tempo copiando dados entre sistemas." />
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? "Enviando..." : "Enviar briefing"}
      </button>
    </form>
  );
}
