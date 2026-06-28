"use client";
// Conteudo do modal de pagamento de UMA fatura. Cada forma chama a API real:
// PIX gera QR + copia-e-cola inline; Cartao e Boleto redirecionam ao ambiente
// seguro do gateway (Checkout Pro), que coleta o que falta (ex.: endereco do
// boleto). A confirmacao do pagamento chega depois, pelo webhook do gateway.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/providers";
import { fmtFull } from "@/lib/format";
import type { ClientInvoice } from "@/lib/types";

type Method = "pix" | "card" | "boleto";
interface PixData {
  qrCodeBase64: string;
  copyPaste: string;
}

export function PayModalContent({ inv, onClose }: { inv: ClientInvoice; onClose: () => void }) {
  const [m, setM] = useState<Method>("pix");
  const [pix, setPix] = useState<PixData | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const methods: { m: Method; icon: "pix" | "card" | "barcode"; label: string }[] = [
    { m: "pix", icon: "pix", label: "PIX" },
    { m: "card", icon: "card", label: "Cartão" },
    { m: "boleto", icon: "barcode", label: "Boleto" },
  ];

  // Gera o PIX ao abrir/selecionar PIX. O ref dedupe por fatura: o StrictMode (dev)
  // monta 2x e dispararia 2 POSTs com a MESMA idempotency key, e o Mercado Pago
  // responde "resource is locked: 423". O ref e setado de forma sincrona, antes do
  // estado atualizar, entao barra o segundo disparo.
  const pixReqRef = useRef<string | null>(null);
  useEffect(() => {
    if (m !== "pix" || pix || pixError) return;
    // Dedupe por fatura: o ref e setado de forma SINCRONA, antes do await, entao o
    // StrictMode (monta 2x em dev) nao dispara 2 POSTs (que dariam "resource is
    // locked: 423" no MP). Sem flag de cancelamento de proposito: como so um request
    // roda, ele PRECISA atualizar o estado; uma flag zerada pelo cleanup do 1o ciclo
    // do StrictMode bloquearia o setPix do unico request e prenderia o "Gerando...".
    if (pixReqRef.current === inv.id) return;
    pixReqRef.current = inv.id;
    setPixLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${inv.id}/pix`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao gerar o PIX");
        setPix({ qrCodeBase64: data.qrCodeBase64 || "", copyPaste: data.copyPaste || "" });
      } catch (e) {
        setPixError((e as Error).message);
      } finally {
        setPixLoading(false);
      }
    })();
  }, [m, pix, pixError, inv.id]);

  // Se a MESMA instancia do modal for reusada para outra fatura (troca de prop sem
  // remontar), zera o PIX anterior e libera novo fetch. O guard por prevInv evita
  // rodar no mount (e no double-mount do StrictMode), so na troca real de fatura.
  const prevInvRef = useRef(inv.id);
  useEffect(() => {
    if (prevInvRef.current === inv.id) return;
    prevInvRef.current = inv.id;
    pixReqRef.current = null;
    setPix(null);
    setPixError(null);
    setPixLoading(false);
  }, [inv.id]);

  async function copyPix() {
    if (!pix?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(pix.copyPaste);
      toast("Código PIX copiado");
    } catch {
      toast("Não foi possível copiar. Copie o código manualmente.", "info");
    }
  }

  async function payCard() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || "Falha ao iniciar o pagamento");
      window.location.assign(data.checkoutUrl);
    } catch (e) {
      toast((e as Error).message, "info");
      setBusy(false);
    }
  }

  async function genBoleto() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/boleto`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || "Falha ao gerar o boleto");
      window.location.assign(data.checkoutUrl);
    } catch (e) {
      toast((e as Error).message, "info");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="modal-head">
        <h3>Pagar fatura {inv.id}</h3>
        <button className="act" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <div className="flex between" style={{ marginBottom: 16 }}>
          <span className="muted">Valor</span>
          <span className="big-amount" style={{ fontSize: 22 }}>
            {fmtFull(inv.amount)}
          </span>
        </div>
        <div className="field">
          <label>Forma de pagamento</label>
          <div className="pay-methods">
            {methods.map((o) => (
              <div key={o.m} className={"pay-opt" + (m === o.m ? " active" : "")} onClick={() => setM(o.m)}>
                <Icon name={o.icon} />
                <div className="pl">{o.label}</div>
              </div>
            ))}
          </div>
        </div>

        {m === "pix" && (
          <div className="card" style={{ background: "var(--surface-2)", textAlign: "center", marginTop: 14 }}>
            <div
              style={{
                width: 140,
                height: 140,
                margin: "6px auto",
                borderRadius: 12,
                background: "#fff",
                display: "grid",
                placeItems: "center",
              }}
            >
              {pix?.qrCodeBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt="QR Code PIX"
                  width={120}
                  height={120}
                  style={{ display: "block" }}
                />
              ) : (
                <div className="hint" style={{ color: "#15131c", padding: 8, fontSize: 12 }}>
                  {pixLoading ? "Gerando PIX..." : pixError ? "Não foi possível gerar o QR" : "QR indisponível. Use o copia-e-cola."}
                </div>
              )}
            </div>
            <div className="hint">Aponte a câmera ou copie o código PIX</div>
          </div>
        )}

        {m === "card" && (
          <div className="alert ok" style={{ marginTop: 14 }}>
            <Icon name="card" />
            <div className="body">
              <div className="at" style={{ fontSize: 13.5 }}>
                Pagamento no cartão
              </div>
              <div className="as">
                Você vai para o ambiente seguro do gateway para concluir. A WaveOps não armazena os dados do seu cartão.
              </div>
            </div>
          </div>
        )}

        {m === "boleto" && (
          <div className="alert ok" style={{ marginTop: 14 }}>
            <Icon name="barcode" />
            <div className="body">
              <div className="at" style={{ fontSize: 13.5 }}>
                Pagamento por boleto
              </div>
              <div className="as">
                Você vai para o ambiente seguro do gateway para gerar o boleto. A compensação leva de 1 a 3 dias úteis.
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        {m === "pix" && (
          <button className="btn btn-primary" onClick={copyPix} disabled={!pix?.copyPaste}>
            <Icon name="copy" /> Copiar código PIX
          </button>
        )}
        {m === "card" && (
          <button className="btn btn-primary" onClick={payCard} disabled={busy}>
            <Icon name="card" /> {busy ? "Abrindo..." : "Ir para o pagamento"}
          </button>
        )}
        {m === "boleto" && (
          <button className="btn btn-primary" onClick={genBoleto} disabled={busy}>
            <Icon name="barcode" /> {busy ? "Abrindo..." : "Ir para o boleto"}
          </button>
        )}
      </div>
    </>
  );
}
