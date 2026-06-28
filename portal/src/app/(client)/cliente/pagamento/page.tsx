"use client";
// 07 . Pagamento (/cliente/pagamento). A forma atual vem de /api/me (useClientCtx);
// "Trocar metodo" salva via PATCH /api/me e recarrega, refletindo na hora.
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/providers";
import { useClientCtx } from "@/components/client/useClientCtx";
import { Loading, LoadError } from "@/components/ui/Loading";
import type { PaymentMethod } from "@/lib/types";

type Method = "pix" | "card" | "boleto";

const KEY_TO_LABEL: Record<Method, PaymentMethod> = { pix: "PIX", card: "Cartão", boleto: "Boleto" };
const KEY_TO_ICON: Record<Method, "pix" | "card" | "barcode"> = { pix: "pix", card: "card", boleto: "barcode" };
function labelToKey(label: PaymentMethod | string): Method {
  if (label === "Cartão") return "card";
  if (label === "Boleto") return "boleto";
  return "pix";
}

export default function PagamentoPage() {
  const c = useClientCtx();
  const toast = useToast();
  const [selected, setSelected] = useState<Method | null>(null);
  const [saving, setSaving] = useState(false);

  if (c.loading) return <Loading />;
  if (c.error || !c.me) return <LoadError message={c.error || "Conta não encontrada"} onRetry={c.reload} />;

  const current = labelToKey(c.me.paymentMethod);
  const chosen = selected ?? current;

  const methods: { m: Method; icon: "pix" | "card" | "barcode"; label: string }[] = [
    { m: "pix", icon: "pix", label: "PIX" },
    { m: "card", icon: "card", label: "Cartão" },
    { m: "boleto", icon: "barcode", label: "Boleto" },
  ];

  async function save() {
    if (saving) return;
    if (chosen === current) {
      toast("Essa já é a sua forma de pagamento atual.", "info");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      toast("Forma de pagamento atualizada");
      setSelected(null);
      c.reload();
    } catch (e) {
      toast((e as Error).message, "info");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Pagamento</h2>
          <div className="lead">Gerencie como você paga a WaveOps.</div>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="section-title">Forma de pagamento atual</div>
          <div className="lrow" style={{ border: "none", paddingTop: 0 }}>
            <div className="ic" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
              <Icon name={KEY_TO_ICON[current]} />
            </div>
            <div className="gr">
              <div className="t">{KEY_TO_LABEL[current]} recorrente</div>
              <div className="s">
                Cobrança automática da assinatura{c.me.nextDue !== "—" ? ` · próxima em ${c.me.nextDue}` : ""}
              </div>
            </div>
            <span className="badge ok">
              <span className="d" />
              Ativo
            </span>
          </div>
          <div className="flex gap8 wrap" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => toast("Em breve: atualizar os dados de pagamento.", "info")}>
              <Icon name="edit" /> Atualizar pagamento
            </button>
            <button className="btn btn-ghost" onClick={() => toast("Em breve: gerar nova cobrança avulsa.", "info")}>
              <Icon name="refresh" /> Gerar nova cobrança
            </button>
          </div>
        </div>
        <div className="card">
          <div className="section-title">Trocar método</div>
          <div className="pay-methods">
            {methods.map((o) => (
              <div key={o.m} className={"pay-opt" + (chosen === o.m ? " active" : "")} onClick={() => setSelected(o.m)}>
                <Icon name={o.icon} />
                <div className="pl">{o.label}</div>
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 14 }}>
            Ao trocar para cartão, você é levado ao ambiente seguro do gateway. A WaveOps não guarda os dados do seu
            cartão.
          </p>
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar forma de pagamento"}
          </button>
        </div>
      </div>
    </>
  );
}
