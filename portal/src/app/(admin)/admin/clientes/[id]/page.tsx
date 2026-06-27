"use client";
// 12 . Detalhe do cliente (/admin/clientes/[id])
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers";
import { useAdminActions } from "@/components/admin/useAdminActions";
import { useApi } from "@/lib/useApi";
import { Loading, LoadError } from "@/components/ui/Loading";
import { plans } from "@/lib/data";
import type { Customer, ClientInvoice, Followup, ProjectBrief, Ticket } from "@/lib/types";
import { fmt, initials } from "@/lib/format";

type Tab = "resumo" | "projeto" | "plano" | "faturas" | "followups" | "suporte" | "historico";
const TABS: [Tab, string][] = [
  ["resumo", "Resumo"],
  ["projeto", "Projeto"],
  ["plano", "Plano"],
  ["faturas", "Faturas"],
  ["followups", "Follow-ups"],
  ["suporte", "Suporte"],
  ["historico", "Histórico"],
];

export default function ClienteDetalhePage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const { resendInvoice, wa, setStatus, refund } = useAdminActions();
  const [tab, setTab] = useState<Tab>("resumo");
  const req = useApi<{
    customer: Customer;
    invoices: ClientInvoice[];
    followups: Followup[];
    brief: ProjectBrief | null;
    tickets: Ticket[];
  }>(params.id ? "/api/customers/" + params.id : null);

  if (req.loading) return <Loading />;
  if (req.error || !req.data)
    return <LoadError message={req.error || "Cliente não encontrado."} onRetry={req.reload} />;

  const c = req.data.customer;
  const invoices = req.data.invoices;
  const cfollow = req.data.followups;
  const brief = req.data.brief;
  const tickets = req.data.tickets;
  const plan = plans.find((p) => c.plan.startsWith(p.name)) || plans[0];
  const inAberto = c.status === "vencido" || c.status === "pendente" || c.status === "pausado";
  const openInv = invoices.find((i) => i.status === "em-aberto" || i.status === "vencida");
  const resendOpen = () =>
    openInv ? resendInvoice(openInv.id) : toast("Nenhuma fatura em aberto para reenviar", "info");

  // O admin abre chamado em nome do cliente (o cliente nao abre pelo portal).
  async function openTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: c.id,
          title: fd.get("title"),
          type: fd.get("type"),
          priority: fd.get("priority"),
          description: fd.get("description"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao abrir chamado");
      toast("Chamado aberto");
      form.reset();
      req.reload();
    } catch (err) {
      toast((err as Error).message, "info");
    }
  }

  return (
    <>
      <Link className="btn btn-quiet btn-sm" href="/admin/clientes" style={{ marginBottom: 16 }}>
        <Icon name="chevronLeft" /> Voltar
      </Link>
      <div className="page-head">
        <div className="flex gap16">
          <span
            className="avatar-sm"
            style={{ width: 54, height: 54, fontSize: 20, borderRadius: 14 }}
          >
            {initials(c.name)}
          </span>
          <div>
            <h2 style={{ marginBottom: 4 }}>{c.name}</h2>
            <div className="flex gap8 wrap">
              <span className="muted">{c.company}</span> <StatusBadge status={c.status} />
            </div>
          </div>
        </div>
        <div className="flex gap8">
          <button className="btn btn-ghost" onClick={resendOpen}>
            <Icon name="refresh" /> Reenviar cobrança
          </button>
          {c.status === "vencido" && (
            <button className="btn btn-danger" onClick={() => setStatus(c.id, "pausado", req.reload)}>
              <Icon name="pause" /> Pausar
            </button>
          )}
          <button className="btn btn-primary" onClick={() => wa(c.phone)}>
            <Icon name="whatsapp" /> WhatsApp
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={k === tab ? "active" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div className="grid cols-2">
          <div className="dl">
            <div className="di">
              <div className="dt">Empresa</div>
              <div className="dd">{c.company}</div>
            </div>
            <div className="di">
              <div className="dt">Documento</div>
              <div className="dd">{c.document || "—"}</div>
            </div>
            <div className="di">
              <div className="dt">E-mail</div>
              <div className="dd" style={{ fontSize: 13.5 }}>
                {c.email}
              </div>
            </div>
            <div className="di">
              <div className="dt">WhatsApp</div>
              <div className="dd">{c.phone}</div>
            </div>
            <div className="di">
              <div className="dt">Plano</div>
              <div className="dd">{c.plan}</div>
            </div>
            <div className="di">
              <div className="dt">Valor mensal</div>
              <div className="dd">{fmt(c.amount)}</div>
            </div>
            <div className="di">
              <div className="dt">Próx. vencimento</div>
              <div className="dd">{c.nextDue}</div>
            </div>
            <div className="di">
              <div className="dt">Último pagamento</div>
              <div className="dd">{c.lastPay}</div>
            </div>
          </div>
          <div className="card">
            <div className="section-title">Financeiro</div>
            <div className="flex between" style={{ padding: "8px 0" }}>
              <span className="muted">Total pago (6 meses)</span>
              <span className="cell-strong">{fmt(c.amount * 5)}</span>
            </div>
            <div className="flex between" style={{ padding: "8px 0" }}>
              <span className="muted">Em aberto</span>
              <span className="cell-strong" style={{ color: c.status === "vencido" ? "var(--danger)" : "inherit" }}>
                {inAberto ? fmt(c.amount) : "R$ 0"}
              </span>
            </div>
            <div className="flex between" style={{ padding: "8px 0" }}>
              <span className="muted">Forma de pagamento</span>
              <span className="cell-strong">{c.method}</span>
            </div>
            <div className="flex gap8 wrap" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={resendOpen}>
                <Icon name="refresh" /> Reenviar cobrança
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => wa(c.phone)}>
                <Icon name="whatsapp" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "projeto" &&
        (brief ? (
          <div className="grid cols-2">
            <div className="dl">
              <div className="di">
                <div className="dt">O que automatizar</div>
                <div className="dd">{brief.goal}</div>
              </div>
              <div className="di">
                <div className="dt">Ferramenta atual</div>
                <div className="dd">{brief.currentTool || "—"}</div>
              </div>
              <div className="di">
                <div className="dt">Dor principal</div>
                <div className="dd">{brief.pain || "—"}</div>
              </div>
              <div className="di">
                <div className="dt">Volume/mês</div>
                <div className="dd">{brief.volume || "—"}</div>
              </div>
              <div className="di">
                <div className="dt">Recebido em</div>
                <div className="dd">{brief.createdAt}</div>
              </div>
            </div>
            <div className="card">
              <div className="section-title">Kickoff</div>
              <p className="muted" style={{ marginTop: -4 }}>
                Briefing enviado pelo cliente. Use o WhatsApp para alinhar o projeto e dar o pontapé.
              </p>
              <div className="flex gap8 wrap" style={{ marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" onClick={() => wa(c.phone)}>
                  <Icon name="whatsapp" /> Falar com o cliente
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon="plan"
              title="Sem briefing ainda"
              desc="O cliente ainda não preencheu o briefing do projeto na área dele."
            />
          </div>
        ))}

      {tab === "plano" && (
        <div className="grid cols-2">
          <div className="dl">
            <div className="di">
              <div className="dt">Plano</div>
              <div className="dd">{c.plan}</div>
            </div>
            <div className="di">
              <div className="dt">Status</div>
              <div className="dd">
                <StatusBadge status={c.status} />
              </div>
            </div>
            <div className="di">
              <div className="dt">Ciclo</div>
              <div className="dd">Mensal recorrente</div>
            </div>
            <div className="di">
              <div className="dt">Valor</div>
              <div className="dd">{fmt(c.amount)}/mês</div>
            </div>
          </div>
          <div className="card">
            <div className="section-title">Benefícios</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
              {plan.benefits.map((b, i) => (
                <li className="flex gap12" key={i}>
                  <span style={{ color: "var(--accent-strong)" }}>
                    <Icon name="check" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex gap8" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("Abrindo troca de plano...", "info")}>
                <Icon name="edit" /> Trocar plano
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setStatus(c.id, "cancelado", req.reload)}>
                Cancelar assinatura
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => refund(c.id, req.reload)}>
                <Icon name="refresh" /> Reembolsar
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "faturas" &&
        (invoices.length ? (
          <div className="card flush">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fatura</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Forma</th>
                    <th className="right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="cell-mono">{i.id}</td>
                      <td className="cell-strong">{i.due}</td>
                      <td>{fmt(i.amount)}</td>
                      <td>
                        <StatusBadge status={i.status} />
                      </td>
                      <td>{i.method}</td>
                      <td>
                        <div className="row-actions">
                          <button className="act" onClick={() => resendInvoice(i.id)} title="Reenviar cobrança">
                            <Icon name="refresh" />
                          </button>
                          <button className="act" title="Ver">
                            <Icon name="eye" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <EmptyState icon="invoice" title="Sem faturas" desc="Este cliente ainda não tem cobranças registradas." />
          </div>
        ))}

      {tab === "followups" &&
        (cfollow.length ? (
          <div className="card">
            <div className="tl">
              {cfollow.map((f) => (
                <div className={"tl-item" + (f.status === "enviado" ? " sent" : "")} key={f.id}>
                  <div className="tt">
                    {f.label} · {f.channel} <StatusBadge status={f.status} />
                  </div>
                  <div className="ts">
                    {f.sentAt} · {f.invoice} · {f.result}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <EmptyState icon="bell" title="Nenhum follow-up" desc="Não há lembretes registrados para este cliente." />
          </div>
        ))}

      {tab === "suporte" && (
        <div className="grid cols-2">
          <form className="card" onSubmit={openTicket}>
            <div className="section-title">Abrir chamado</div>
            <p className="muted" style={{ marginTop: -4 }}>
              O cliente fala com a gente pelo WhatsApp. Registre o chamado aqui para acompanhar internamente.
            </p>
            <div className="field">
              <label>Título</label>
              <input name="title" placeholder="Resuma o que o cliente precisa" required />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Tipo</label>
                <select name="type">
                  <option>Dúvida sobre plano</option>
                  <option>Dúvida sobre pagamento</option>
                  <option>Problema em automação</option>
                  <option>Solicitar nova automação</option>
                  <option>Solicitar ajuste</option>
                  <option>Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Prioridade</label>
                <select name="priority" defaultValue="Média">
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Descrição</label>
              <textarea name="description" placeholder="Contexto do atendimento (ex.: resumo da conversa no WhatsApp)." />
            </div>
            <button type="submit" className="btn btn-primary">
              Abrir chamado
            </button>
          </form>

          <div className="card">
            <div className="section-title">Chamados deste cliente</div>
            {tickets.length ? (
              tickets.map((t) => (
                <div className="lrow" key={t.id}>
                  <div className="ic">
                    <Icon name="support" />
                  </div>
                  <div className="gr">
                    <div className="t">{t.title}</div>
                    <div className="s">
                      {t.type} · {t.createdAt}
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))
            ) : (
              <EmptyState icon="support" title="Sem chamados" desc="Nenhum chamado registrado para este cliente." />
            )}
          </div>
        </div>
      )}

      {tab === "historico" && (
        <div className="card">
          <div className="tl">
            <div className="tl-item sent">
              <div className="tt">Pagamento confirmado · {fmt(c.amount)}</div>
              <div className="ts">
                {c.lastPay} · {c.method}
              </div>
            </div>
            <div className="tl-item sent">
              <div className="tt">Follow-up enviado</div>
              <div className="ts">via WhatsApp</div>
            </div>
            <div className="tl-item sent">
              <div className="tt">Cobrança gerada</div>
              <div className="ts">ciclo mensal</div>
            </div>
            <div className="tl-item sent">
              <div className="tt">Onboarding criado no WaveOps CRM</div>
              <div className="ts">início —</div>
            </div>
            <div className="tl-item sent">
              <div className="tt">Cliente criado</div>
              <div className="ts">primeiro pagamento aprovado</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
