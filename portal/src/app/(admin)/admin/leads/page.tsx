"use client";
// 19 . Leads (/admin/leads)
import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading, LoadError } from "@/components/ui/Loading";
import { LeadModalContent } from "@/components/admin/LeadModal";
import { useModal, useToast } from "@/components/providers";
import { useApi } from "@/lib/useApi";
import {
  LIMITE_LEADS,
  assuntosDoLead,
  filtrarLeads,
  formatarDataHora,
  formatarTelefone,
  linkWhatsappDoLead,
  resumoDaLista,
  rotuloCanal,
  rotuloTipo,
  type FiltroStatus,
  type FiltroTipo,
  type LeadDto,
  type LeadStatus,
} from "@/lib/leads-admin";

const TIPOS: [FiltroTipo, string][] = [
  ["todos", "Todos"],
  ["contato", "Contato"],
  ["interesse", "Lista"],
];
const STATUS: [FiltroStatus, string][] = [
  ["todos", "Todos"],
  ["novo", "Novos"],
  ["atendido", "Atendidos"],
];

// As células da tabela não quebram linha. Texto livre (nome, e-mail, assunto) ganha um
// teto de largura com reticências, senão um e-mail comprido empurra as ações para fora
// da tela. O valor inteiro fica no title e no detalhe.
const CORTE: CSSProperties = {
  display: "block",
  maxWidth: 170,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
// O assunto é o rótulo inteiro de uma opção do formulário, de até 40 caracteres. O que a
// pessoa procura quebra em até duas linhas; o que mais pesa fica numa linha só.
const ASSUNTO_PRINCIPAL: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  maxWidth: 220,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};
const ASSUNTO_SECUNDARIO: CSSProperties = { ...CORTE, maxWidth: 220 };

// O SVG do Icon não tem tamanho próprio: sem isso ele ocupa a caixa inteira.
const ICONE_BUSCA: CSSProperties = { width: 16, height: 16, flexShrink: 0 };

// Botão travado enquanto uma ação roda. O design system não tem estilo para :disabled.
const TRAVADO: CSSProperties = { opacity: 0.55, cursor: "not-allowed" };

// Chama a API do admin. Falha vira Error com o texto que a API devolveu, pronto para o toast.
async function chamar(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  if (res.ok) return;
  const corpo = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(corpo.error || "Não foi possível concluir a ação. Tente de novo.");
}

interface LinhaProps {
  lead: LeadDto;
  travado: boolean;
  onAbrir: (lead: LeadDto) => void;
  onStatus: (lead: LeadDto, status: LeadStatus) => void;
  onApagar: (lead: LeadDto) => void;
}

function LinhaLead({ lead: l, travado, onAbrir, onStatus, onApagar }: LinhaProps) {
  const contato = l.tipo === "contato";
  const pessoa = (contato ? l.nome || l.email : l.email || l.nome) || "Sem identificação";
  const assuntos = assuntosDoLead(l);
  // O link respeita o canal escolhido: com retorno por ligação ou e-mail o telefone só aparece.
  const wa = linkWhatsappDoLead(l);
  const atendido = l.status === "atendido";
  const rotuloStatus = atendido ? "Reabrir" : "Marcar atendido";
  const [dia = "", hora = ""] = formatarDataHora(l.createdAt).split(" ");
  const estiloTravado = travado ? TRAVADO : undefined;

  return (
    // O clique na linha abre o detalhe para quem usa mouse. Para teclado, o botão da
    // coluna Pessoa recebe o foco e o clique dele sobe até a linha.
    <tr onClick={() => onAbrir(l)}>
      <td>
        <span style={{ display: "block" }}>{dia}</span>
        <span className="cell-sub" style={{ display: "block" }}>
          {hora}
        </span>
      </td>
      <td>{rotuloTipo(l.tipo)}</td>
      <td>
        <button type="button" title="Ver todos os dados do lead" style={{ display: "block", textAlign: "left" }}>
          <span className="cell-strong" style={CORTE}>
            {pessoa}
          </span>
          {contato && l.empresa && (
            <span className="cell-sub" style={CORTE}>
              {l.empresa}
            </span>
          )}
        </button>
      </td>
      <td>
        {contato ? (
          <>
            <span className="cell-strong" style={CORTE}>
              {rotuloCanal(l.canalRetorno) || "-"}
            </span>
            {l.telefone && (
              <span className="cell-sub" style={CORTE}>
                {formatarTelefone(l.telefone)}
              </span>
            )}
            {l.email && (
              <span className="cell-sub" style={CORTE} title={l.email}>
                {l.email}
              </span>
            )}
          </>
        ) : (
          <span className="muted">-</span>
        )}
      </td>
      <td>
        {assuntos.length ? (
          assuntos.map((a, i) => (
            <span
              key={i}
              className={i === 0 ? undefined : "cell-sub"}
              style={i === 0 ? ASSUNTO_PRINCIPAL : ASSUNTO_SECUNDARIO}
              title={a}
            >
              {a}
            </span>
          ))
        ) : (
          <span className="muted">-</span>
        )}
      </td>
      <td>
        <StatusBadge status={l.status} />
      </td>
      <td>
        <div className="row-actions">
          {wa && (
            <a
              className="act"
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              title="Chamar no WhatsApp"
              aria-label={`Chamar no WhatsApp: ${pessoa}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="whatsapp" />
            </a>
          )}
          <button
            type="button"
            className="act"
            title={rotuloStatus}
            aria-label={`${rotuloStatus}: ${pessoa}`}
            disabled={travado}
            style={estiloTravado}
            onClick={(e) => {
              e.stopPropagation();
              onStatus(l, atendido ? "novo" : "atendido");
            }}
          >
            <Icon name={atendido ? "refresh" : "check"} />
          </button>
          <button
            type="button"
            className="act"
            title="Apagar lead"
            aria-label={`Apagar lead: ${pessoa}`}
            disabled={travado}
            style={estiloTravado}
            onClick={(e) => {
              e.stopPropagation();
              onApagar(l);
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function LeadsPage() {
  const { openModal } = useModal();
  const toast = useToast();
  const req = useApi<LeadDto[]>("/api/leads");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [busca, setBusca] = useState("");
  // Id do lead com ação em andamento. Trava os botões para não repetir o pedido.
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Só a primeira carga troca a tela por "Carregando". Nos reloads depois de uma ação a
  // tabela fica no lugar, sem piscar e sem perder a posição da rolagem.
  if (req.loading && !req.data) return <Loading />;
  if (req.error || !req.data)
    return <LoadError message={req.error || "Não foi possível carregar os leads."} onRetry={req.reload} />;

  const leads = req.data;
  const lista = filtrarLeads(leads, { tipo, status, busca });
  const novos = leads.filter((l) => l.status === "novo").length;
  const travado = ocupado !== null || req.loading;
  const semLeads = leads.length === 0;

  async function mudarStatus(lead: LeadDto, novo: LeadStatus) {
    if (travado) return;
    setOcupado(lead.id);
    try {
      await chamar(`/api/leads/${encodeURIComponent(lead.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      toast(novo === "atendido" ? "Lead marcado como atendido" : "Lead reaberto");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível atualizar o lead.", "info");
    } finally {
      // Recarrega mesmo no erro: "não encontrado" quer dizer que a lista está velha.
      setOcupado(null);
      req.reload();
    }
  }

  async function apagar(lead: LeadDto) {
    if (travado) return;
    if (!window.confirm("Apagar este lead a pedido do titular? Não dá para desfazer.")) return;
    setOcupado(lead.id);
    try {
      await chamar(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "DELETE" });
      toast("Lead apagado");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível apagar o lead.", "info");
    } finally {
      setOcupado(null);
      req.reload();
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Leads</h2>
          <div className="lead">{resumoDaLista(leads.length, lista.length, novos)}</div>
        </div>
      </div>

      {!semLeads && (
        <div className="toolbar">
          <div className="flex gap8 wrap" role="group" aria-label="Filtrar por tipo">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Tipo
            </span>
            {TIPOS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                className={"chip-filter " + (k === tipo ? "active" : "")}
                aria-pressed={k === tipo}
                onClick={() => setTipo(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap8 wrap" role="group" aria-label="Filtrar por status">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Status
            </span>
            {STATUS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                className={"chip-filter " + (k === status ? "active" : "")}
                aria-pressed={k === status}
                onClick={() => setStatus(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="sp" />
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "8px 13px",
              display: "flex",
              alignItems: "center",
              gap: 9,
              color: "var(--muted)",
            }}
          >
            <Icon name="search" style={ICONE_BUSCA} />
            <input
              type="text"
              aria-label="Buscar lead por nome, empresa, e-mail ou telefone"
              placeholder="Nome, empresa, e-mail ou telefone..."
              autoComplete="off"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ background: "none", border: "none", color: "var(--text)", outline: "none", width: 260 }}
            />
          </div>
        </div>
      )}

      <div className="card flush">
        {lista.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={semLeads ? "Nenhum lead ainda" : "Nenhum lead aqui"}
            desc={
              semLeads
                ? "Os contatos e as inscrições da lista de interesse do site chegam aqui assim que forem enviados."
                : "Nenhum lead combina com esse tipo, esse status ou essa busca. Ajuste os filtros."
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <caption className="sr-only">Leads recebidos pelo site, do mais recente para o mais antigo</caption>
              <thead>
                <tr>
                  <th>Recebido</th>
                  <th>Tipo</th>
                  <th>Pessoa</th>
                  <th>Contato</th>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <LinhaLead
                    key={l.id}
                    lead={l}
                    travado={travado}
                    onAbrir={(lead) => openModal(<LeadModalContent lead={lead} />)}
                    onStatus={mudarStatus}
                    onApagar={apagar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {leads.length >= LIMITE_LEADS && (
        <p className="hint">
          Mostrando os {LIMITE_LEADS} leads mais recentes. Os filtros e a busca valem só para eles.
        </p>
      )}
    </>
  );
}
