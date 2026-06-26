"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useModal, useToast } from "@/components/providers";
import { plans } from "@/lib/data";

// Planos reais (mesma fonte da landing): id -> nome (Operação, Essencial, Pro, Empresarial).
const PLAN_OPTIONS: [string, string][] = plans.map((p) => [p.id, p.name]);

// Modal "Novo cliente": cria via API e recarrega a lista (onCreated).
export function NewCustomerModalContent({ onCreated }: { onCreated?: () => void }) {
  const { closeModal } = useModal();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

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
            <label>Nome</label>
            <input name="name" placeholder="Nome completo" required />
          </div>
          <div className="field">
            <label>Empresa</label>
            <input name="company" placeholder="Empresa" />
          </div>
        </div>
        <div className="field">
          <label>E-mail</label>
          <input name="email" type="email" placeholder="cliente@empresa.com.br" required />
        </div>
        <div className="field-row">
          <div className="field">
            <label>WhatsApp</label>
            <input name="phone" placeholder="(00) 00000-0000" />
          </div>
          <div className="field">
            <label>Plano</label>
            <select name="planId" defaultValue="operacao">
              {PLAN_OPTIONS.map(([id, label], i) => (
                <option key={i} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
