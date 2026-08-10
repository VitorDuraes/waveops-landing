"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useModal, useToast } from "@/components/providers";
import { plans } from "@/lib/data";
import { fmt } from "@/lib/format";

// Planos reais (mesma fonte da landing): id -> nome (Operação, Essencial, Pro, Empresarial).
const PLAN_OPTIONS: [string, string][] = plans.map((p) => [p.id, p.name]);

// Modal "Novo cliente": cria via API e recarrega a lista (onCreated).
// O plano define o ESCOPO; o valor mensal é o combinado com este cliente. O campo
// nasce preenchido com o valor de referência do plano e o admin ajusta pela proposta.
export function NewCustomerModalContent({ onCreated }: { onCreated?: () => void }) {
  const { closeModal } = useModal();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState(plans[0].id);
  const planoAtual = plans.find((p) => p.id === planId) || plans[0];
  const [amount, setAmount] = useState(String(plans[0].monthly));

  function trocarPlano(id: string) {
    setPlanId(id);
    // Sugere a referência do novo plano. É sugestão: o campo continua editável.
    const p = plans.find((x) => x.id === id);
    if (p) setAmount(String(p.monthly));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          company: fd.get("company"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          planId: fd.get("planId"),
          amount: fd.get("amount"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar cliente");
      closeModal();
      toast("Cliente criado e cobrança enviada");
      onCreated?.();
    } catch (err) {
      toast((err as Error).message, "info");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="modal-head">
        <h3>Novo cliente</h3>
        <button type="button" className="act" onClick={closeModal} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <div className="field-row">
          <div className="field">
            <label htmlFor="novo-nome">Nome</label>
            <input id="novo-nome" name="name" placeholder="Nome completo" required />
          </div>
          <div className="field">
            <label htmlFor="novo-empresa">Empresa</label>
            <input id="novo-empresa" name="company" placeholder="Empresa" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="novo-e-mail">E-mail</label>
          <input id="novo-e-mail" name="email" type="email" placeholder="cliente@empresa.com.br" required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="novo-whatsapp">WhatsApp</label>
            <input id="novo-whatsapp" name="phone" placeholder="(00) 00000-0000" />
          </div>
          <div className="field">
            <label htmlFor="novo-plano">Plano (escopo)</label>
            <select id="novo-plano" name="planId" value={planId} onChange={(e) => trocarPlano(e.target.value)}>
              {PLAN_OPTIONS.map(([id, label], i) => (
                <option key={i} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="novo-valor">Valor mensal combinado (R$)</label>
          <input
            id="novo-valor"
            name="amount"
            inputMode="decimal"
            placeholder="Ex.: 1997"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="hint">
            {planoAtual.selfService
              ? `Referência do plano ${planoAtual.name}: ${fmt(planoAtual.monthly)}/mês. Ajuste se combinou outro valor.`
              : `${planoAtual.name} é fechado por proposta. Referência interna: ${fmt(planoAtual.monthly)}/mês. Use o valor que você combinou.`}
          </p>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={closeModal}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Criando..." : "Criar e enviar cobrança"}
        </button>
      </div>
    </form>
  );
}
