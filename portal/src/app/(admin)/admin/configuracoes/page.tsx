"use client";
// 16 . Configuracoes (/admin/configuracoes)
import { Icon, type IconName } from "@/components/icons";
import { initials } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { Loading, LoadError } from "@/components/ui/Loading";

interface Integration {
  key: IconName;
  name: string;
  desc: string;
  connected: boolean;
}

// Endereços da equipe (estrutura intencional). Discord substitui o Slack; o
// WaveOps CRM (Twenty) substitui o Trello/ClickUp.
const TEAM: [string, string, string][] = [
  ["Equipe WaveOps", "financeiro@waveops.com.br", "Admin"],
  ["Suporte", "suporte@waveops.com.br", "Suporte"],
  ["Comercial", "comercial@waveops.com.br", "Comercial"],
];

export default function ConfiguracoesPage() {
  const req = useApi<Integration[]>("/api/integrations");

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Configurações</h2>
          <div className="lead">Integrações, equipe e régua de cobrança.</div>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="section-title">Integrações</div>
          {req.loading && <Loading />}
          {req.error && <LoadError message={req.error} onRetry={req.reload} />}
          {req.data?.map((it) => (
            <div className="lrow" key={it.name}>
              <div className="ic">
                <Icon name={it.key} />
              </div>
              <div className="gr">
                <div className="t">{it.name}</div>
                <div className="s">{it.desc}</div>
              </div>
              <span className={"badge " + (it.connected ? "ok" : "warn")}>
                <span className="d" />
                {it.connected ? "Conectado" : "Não configurado"}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="section-title">Equipe</div>
            {TEAM.map(([n, e, r]) => (
              <div className="lrow" key={e}>
                <div
                  className="avatar-sm"
                  style={{ background: "linear-gradient(140deg,var(--accent-strong),var(--accent-press))" }}
                >
                  {initials(n)}
                </div>
                <div className="gr">
                  <div className="t">{n}</div>
                  <div className="s">{e}</div>
                </div>
                <span className="badge accent">{r}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-title">Régua de cobrança</div>
            <div className="flex between" style={{ padding: "8px 0" }}>
              <span>Pausar após atraso de</span>
              <span className="cell-strong">7 dias</span>
            </div>
            <div className="flex between" style={{ padding: "8px 0" }}>
              <span>Lembretes de cobrança</span>
              <span className="cell-strong">Por e-mail</span>
            </div>
            <div className="flex between" style={{ padding: "8px 0" }}>
              <span>Execução do job</span>
              <span className="cell-strong">Diária</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
