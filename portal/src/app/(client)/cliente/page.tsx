"use client";
// 04 . Dashboard do cliente (/cliente)
import Link from "next/link";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useModal } from "@/components/providers";
import { useClientCtx } from "@/components/client/useClientCtx";
import { PayModalContent } from "@/components/client/PayModalContent";
import { BriefingCard } from "@/components/client/BriefingCard";
import { whatsappUrl } from "@/lib/contact";
import { Loading, LoadError } from "@/components/ui/Loading";
import { Stagger, StaggerItem } from "@/components/motion";
import { fmt } from "@/lib/format";

export default function ClienteDashboard() {
  const c = useClientCtx();
  const { openModal, closeModal } = useModal();

  if (c.loading) return <Loading />;
  if (c.error || !c.me)
    return <LoadError message={c.error || "Não foi possível carregar sua conta."} onRetry={c.reload} />;

  const m = c.me;
  const canPay = !!c.open && (c.open.status === "em-aberto" || c.open.status === "vencida");

  function pay() {
    if (!c.open) return;
    openModal(<PayModalContent inv={c.open} onClose={closeModal} />);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Olá, {m.firstName} 👋</h2>
          <div className="lead">Aqui está o resumo da sua conta WaveOps.</div>
        </div>
        {canPay && c.open && (
          <button className="btn btn-primary btn-lg" onClick={pay}>
            <Icon name="money" /> Pagar agora · {fmt(c.open.amount)}
          </button>
        )}
      </div>

      <div className={"alert " + c.alert.tone} style={{ marginBottom: 22 }}>
        <Icon name={c.alert.icon} />
        <div className="body">
          <div className="at">{c.alert.t}</div>
          <div className="as">{c.alert.s}</div>
        </div>
      </div>

      <BriefingCard />

      <Stagger className="grid cols-4">
        <StaggerItem className="metric">
          <div className="mlab">
            <span className="mi">
              <Icon name="plan" />
            </span>{" "}
            Plano atual
          </div>
          <div className="mval" style={{ fontSize: 24 }}>
            {m.plan}
          </div>
          <div className="mdelta flat">
            {fmt(m.amount)}/{m.cycle}
          </div>
        </StaggerItem>
        <StaggerItem className="metric">
          <div className="mlab">
            <span className="mi">
              <Icon name="checkCircle" />
            </span>{" "}
            Status
          </div>
          <div style={{ marginTop: 14 }}>
            <StatusBadge status={c.statusKey} />
          </div>
          <div className="mdelta flat" style={{ marginTop: 10 }}>
            desde {m.startDate}
          </div>
        </StaggerItem>
        <StaggerItem className="metric">
          <div className="mlab">
            <span className="mi">
              <Icon name="clock" />
            </span>{" "}
            Próximo vencimento
          </div>
          <div className="mval" style={{ fontSize: 24 }}>
            {c.nextDue}
          </div>
          <div className="mdelta flat">{m.paymentMethod}</div>
        </StaggerItem>
        <StaggerItem className="metric">
          <div className="mlab">
            <span className="mi">
              <Icon name="invoice" />
            </span>{" "}
            Fatura em aberto
          </div>
          <div className="mval" style={{ fontSize: 24 }}>
            {canPay && c.open ? fmt(c.open.amount) : "R$ 0"}
          </div>
          <div className={"mdelta " + (canPay ? "down" : "up")}>
            {canPay && c.open ? <StatusBadge status={c.open.status} /> : "nenhuma"}
          </div>
        </StaggerItem>
      </Stagger>

      <div className="grid cols-2" style={{ marginTop: 22 }}>
        <div className="card">
          <div className="section-title">
            Últimas faturas{" "}
            <Link className="btn btn-quiet btn-sm" href="/cliente/faturas">
              Ver todas <Icon name="chevronRight" />
            </Link>
          </div>
          {c.invoices.slice(0, 4).map((inv) => (
            <div className="lrow" key={inv.id}>
              <div className="ic">
                <Icon name="invoice" />
              </div>
              <div className="gr">
                <div className="t">
                  {inv.id} · {fmt(inv.amount)}
                </div>
                <div className="s">
                  Venc. {inv.due}
                  {inv.paidAt ? " · pago " + inv.paidAt : ""}
                </div>
              </div>
              <StatusBadge status={inv.status} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-title">Atalhos</div>
          <div className="lrow">
            <div className="ic">
              <Icon name="card" />
            </div>
            <div className="gr">
              <div className="t">Forma de pagamento</div>
              <div className="s">{m.paymentMethod} · atualizar</div>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/cliente/pagamento">
              Abrir
            </Link>
          </div>
          <div className="lrow">
            <div className="ic">
              <Icon name="plan" />
            </div>
            <div className="gr">
              <div className="t">Meu plano</div>
              <div className="s">Detalhes e benefícios</div>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/cliente/plano">
              Abrir
            </Link>
          </div>
          <div className="lrow">
            <div className="ic" style={{ color: "#22c55e" }}>
              <Icon name="whatsapp" />
            </div>
            <div className="gr">
              <div className="t">Fale com a gente</div>
              <div className="s">WhatsApp, resposta no mesmo dia útil</div>
            </div>
            <a
              className="btn btn-ghost btn-sm"
              href={whatsappUrl("Olá! Sou cliente WaveOps e preciso de ajuda.")}
              target="_blank"
              rel="noopener"
            >
              Abrir
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
