"use client";

import { useEffect, useRef, useState } from "react";
import { chamar } from "@/lib/leads-client";
import { formatarDataHora } from "@/lib/leads-admin";
import { lerPreviaRetencaoLeads, type PreviaRetencaoLeads } from "@/lib/leads-retencao";

const NUMERO = new Intl.NumberFormat("pt-BR");
const TEMPO_LIMITE_MS = 12_000;

export function RetencaoLeads() {
  const [previa, setPrevia] = useState<PreviaRetencaoLeads | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atual = useRef<AbortController | null>(null);

  useEffect(() => () => {
    atual.current?.abort();
    atual.current = null;
  }, []);

  async function consultar() {
    atual.current?.abort();
    const controle = new AbortController();
    atual.current = controle;
    setPrevia(null);
    setErro(null);
    setCarregando(true);
    const espera = window.setTimeout(() => {
      if (atual.current !== controle) return;
      controle.abort();
      atual.current = null;
      setCarregando(false);
      setErro("A consulta demorou demais. Tente de novo.");
    }, TEMPO_LIMITE_MS);

    try {
      const corpo = await chamar<unknown>("/api/leads/retencao", { method: "GET", cache: "no-store", signal: controle.signal });
      const resultado = lerPreviaRetencaoLeads(corpo);
      if (!resultado) throw new Error("A prévia recebida está inconsistente. Tente de novo.");
      if (atual.current === controle && !controle.signal.aborted) setPrevia(resultado);
    } catch (falha) {
      if (atual.current === controle && !controle.signal.aborted) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível calcular a prévia. Tente de novo.");
      }
    } finally {
      window.clearTimeout(espera);
      if (atual.current === controle) {
        atual.current = null;
        setCarregando(false);
      }
    }
  }

  return (
    <section className="card" aria-labelledby="retencao-leads-titulo" style={{ marginBottom: 18 }}>
      <div className="flex gap12 wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 id="retencao-leads-titulo" style={{ margin: 0, fontSize: 16 }}>Prévia de retenção</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={consultar} disabled={carregando}>
          {carregando ? "Consultando..." : previa ? "Atualizar prévia" : "Consultar prévia"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
        Contatos: 180 dias. Lista de interesse: 365 dias desde o cadastro. A consulta abrange todos os
        cadastros, independentemente dos filtros da listagem. Revise negociações ativas e exceções antes
        de decidir a exclusão.
      </p>
      <div aria-live="polite" aria-busy={carregando}>
        {erro && <p role="alert" style={{ marginBottom: 0 }}>{erro}</p>}
        {carregando && <p className="muted" style={{ marginBottom: 0 }}>Calculando as contagens...</p>}
        {previa && (
          <>
            <p className="muted" style={{ fontSize: 12.5 }}>
              Prévia calculada em <time dateTime={previa.calculadaEm} title={previa.calculadaEm}>{formatarDataHora(previa.calculadaEm)}</time> (Brasília).
              Atualize após alterar cadastros.
            </p>
            <div className="table-wrap">
              <table className="tbl" aria-label="Contagens da prévia de retenção">
                <thead><tr><th scope="col">Tipo</th><th scope="col">Prazo</th><th scope="col">Recebidos até</th><th scope="col">Total</th><th scope="col">Dentro do prazo</th><th scope="col">Prazo atingido</th></tr></thead>
                <tbody>
                  {previa.tipos.map((faixa) => (
                    <tr key={faixa.tipo}>
                      <th scope="row">{faixa.tipo === "contato" ? "Contatos" : "Lista de interesse"}</th>
                      <td>{faixa.dias} dias</td>
                      <td><time dateTime={faixa.criadosAte} title={faixa.criadosAte}>{formatarDataHora(faixa.criadosAte)} (Brasília)</time></td>
                      <td>{NUMERO.format(faixa.total)}</td>
                      <td>{NUMERO.format(faixa.noPrazo)}</td>
                      <td>{NUMERO.format(faixa.prazoAtingido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
