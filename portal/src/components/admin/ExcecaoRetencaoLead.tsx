"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CABECALHO_JSON } from "@/lib/leads-client";
import { formatarDataHora } from "@/lib/leads-admin";
import { lerConsultaRetencao, lerPedidoRetencao, type ConsultaRetencao } from "@/lib/leads-excecoes";

const TEMPO_LIMITE_MS = 12_000;
const TRAVADO = { opacity: 0.55, cursor: "not-allowed" } as const;
class FalhaExcecao extends Error {}

export function ExcecaoRetencaoLead({ leadId }: { leadId: string }) {
  const id = useId();
  const [consulta, setConsulta] = useState<ConsultaRetencao | null>(null);
  const [ocupado, setOcupado] = useState<"GET" | "POST" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [dias, setDias] = useState("30");
  const atual = useRef<AbortController | null>(null);

  const operar = useCallback(async (metodo: "GET" | "POST", corpo?: unknown) => {
    if (atual.current) return;
    const controle = new AbortController();
    atual.current = controle;
    setOcupado(metodo);
    setErro(null);
    setAviso(null);
    if (metodo === "GET") setConsulta(null);
    const espera = window.setTimeout(() => {
      if (atual.current !== controle) return;
      controle.abort();
      atual.current = null;
      setOcupado(null);
      setConsulta(null);
      setErro(metodo === "POST"
        ? "A confirmação não chegou a tempo. A alteração pode ter sido registrada. Recarregue antes de repetir."
        : "A consulta demorou demais. Recarregue a exceção.");
    }, TEMPO_LIMITE_MS);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/retencao`, {
        method: metodo, cache: "no-store", signal: controle.signal,
        ...(metodo === "POST" ? { headers: CABECALHO_JSON, body: JSON.stringify(corpo) } : {}),
      });
      const recebido: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const mensagem = typeof recebido === "object" && recebido !== null && "error" in recebido && typeof recebido.error === "string" ? recebido.error : "Não foi possível confirmar a operação. Recarregue antes de repetir.";
        throw new FalhaExcecao(mensagem);
      }
      const resultado = lerConsultaRetencao(recebido);
      if (!resultado) throw new FalhaExcecao("A resposta está inconsistente. Recarregue antes de repetir uma alteração.");
      if (atual.current !== controle || controle.signal.aborted) return;
      setConsulta(resultado);
      setJustificativa(resultado.excecao?.justificativa ?? "");
      if (metodo === "POST") setAviso(resultado.excecao ? "Revisão registrada." : "Exceção encerrada. O cadastro foi preservado.");
    } catch (falha) {
      if (atual.current === controle && !controle.signal.aborted) {
        setConsulta(null);
        setErro(falha instanceof FalhaExcecao ? falha.message : metodo === "POST"
          ? "A conexão falhou e não foi possível confirmar a alteração. Ela pode ter sido registrada. Recarregue antes de repetir."
          : "A conexão falhou. Recarregue a exceção para tentar novamente.");
      }
    } finally {
      window.clearTimeout(espera);
      if (atual.current === controle) {
        atual.current = null;
        setOcupado(null);
      }
    }
  }, [leadId]);

  useEffect(() => {
    void operar("GET");
    return () => {
      atual.current?.abort();
      atual.current = null;
    };
  }, [operar]);

  function registrar(evento: FormEvent) {
    evento.preventDefault();
    if (!consulta || ocupado) return;
    const leitura = lerPedidoRetencao({ acao: "registrar", versao: consulta.versao, justificativa, dias: Number(dias) });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    void operar("POST", leitura.pedido);
  }
  const e = consulta?.excecao;
  const travado = ocupado !== null || !consulta;
  const tamanho = Array.from(justificativa.replace(/\r\n?/g, "\n").trim().normalize("NFC")).length;
  const data = (valor: string) => <time dateTime={valor} title={valor}>{formatarDataHora(valor)} (Brasília)</time>;

  return (
    <section aria-labelledby={`${id}-titulo`} style={{ marginTop: 22 }}>
      <div className="flex gap8 wrap" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h4 id={`${id}-titulo`} className="section-title" style={{ margin: 0 }}>Exceção de retenção</h4>
        <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado !== null} onClick={() => void operar("GET")}>
          Recarregar exceção
        </button>
      </div>
      <p className="hint">Registre a necessidade de conservar este cadastro e uma data para revisá-la. A revisão vencida exige nova avaliação antes de decidir a exclusão.</p>
      <div aria-live="polite" aria-busy={ocupado !== null}>
        {ocupado && <p className="muted">{ocupado === "GET" ? "Consultando exceção..." : "Registrando alteração..."}</p>}
        {erro && <p role="alert">{erro}</p>}
        {aviso && <p role="status">{aviso}</p>}
        {consulta && <p className="muted" style={{ fontSize: 12.5 }}>Consultada em {data(consulta.calculadaEm)}. Atualize para conferir a situação atual.</p>}
        {consulta && (
          e ? <dl className="dl" style={{ marginBottom: 16 }}>
            <div className="di"><dt className="dt">Situação na consulta</dt><dd className="dd" style={{ fontSize: 14 }}>{e.estado === "vigente" ? "Vigente" : "Vencida"}</dd></div>
            <div className="di"><dt className="dt">Revisar até</dt><dd className="dd" style={{ fontSize: 14 }}>{data(e.revisarEm)}</dd></div>
            <div className="di"><dt className="dt">Responsável</dt><dd className="dd" style={{ fontSize: 14, overflowWrap: "anywhere" }}>{e.por}</dd></div>
            <div className="di"><dt className="dt">Registrada em</dt><dd className="dd" style={{ fontSize: 14 }}>{data(e.registradaEm)}</dd></div>
          </dl> : <p className="muted">Nenhuma exceção registrada.</p>
        )}
      </div>
      {consulta && (
        <form onSubmit={registrar}>
          <div className="field">
            <label htmlFor={`${id}-justificativa`}>Justificativa</label>
            <textarea id={`${id}-justificativa`} value={justificativa} onChange={(evento) => setJustificativa(evento.target.value)} disabled={travado} required aria-describedby={`${id}-orientacao`} />
            <p id={`${id}-orientacao`} className="hint">20 a 500 caracteres. Não inclua e-mail, telefone ou dados sensíveis. {tamanho}/500.</p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-dias`}>Revisar em quantos dias?</label>
            <input id={`${id}-dias`} type="number" min={1} max={30} step={1} value={dias} onChange={(evento) => setDias(evento.target.value)} disabled={travado} required />
            <p className="hint">De 1 a 30 dias a partir do registro, pelo horário do servidor.</p>
          </div>
          <div className="flex gap8 wrap">
            <button type="submit" className="btn btn-primary btn-sm" disabled={travado} style={travado ? TRAVADO : undefined}>{e ? "Atualizar revisão" : "Registrar exceção"}</button>
            {e && <button type="button" className="btn btn-ghost btn-sm" disabled={travado} style={travado ? TRAVADO : undefined} onClick={() => void operar("POST", { acao: "encerrar", versao: consulta.versao })}>Encerrar exceção</button>}
          </div>
        </form>
      )}
    </section>
  );
}
