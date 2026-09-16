// 18 . Funil (/admin/funil)
import { redirect } from "next/navigation";
import { readSession } from "@/server/auth";
import { env } from "@/server/env";
import { lerFunil } from "@/server/funil";

// Server Component de propósito: lê o banco direto, sem passar por rota de API.
// A barreira de autorização é ESTA checagem, não o proxy: o proxy é otimista e a
// regra do projeto é barrar no servidor, junto do acesso ao dado.
export const dynamic = "force-dynamic";

export default async function FunilPage() {
  if (env.authEnforced) {
    const u = await readSession();
    if (!u || u.role !== "admin") redirect("/admin/login");
  }

  const funil = await lerFunil(30);
  const degraus = funil.linhas.filter((l) => l.etapa);
  const laterais = funil.linhas.filter((l) => !l.etapa);
  const topo = degraus[0]?.visitantes ?? 0;
  const fim = degraus[degraus.length - 1]?.visitantes ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Funil</h2>
          <div className="lead">
            Últimos 30 dias, por visitante distinto. De {topo} visita{topo === 1 ? "" : "s"} saíram{" "}
            {fim} conta{fim === 1 ? "" : "s"} ativada{fim === 1 ? "" : "s"}.
          </div>
        </div>
      </div>

      {funil.semBanco && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Sem banco configurado.</strong> O portal está em modo mock, então os números
          abaixo são zero. Configure <code>DATABASE_URL</code> para medir de verdade.
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Etapa</th>
              <th style={{ textAlign: "right" }}>Visitantes</th>
              <th style={{ textAlign: "right" }}>Eventos</th>
              <th style={{ textAlign: "right" }}>Da etapa anterior</th>
              <th style={{ textAlign: "right" }}>Da visita</th>
            </tr>
          </thead>
          <tbody>
            {degraus.map((l) => (
              <tr key={l.nome}>
                <td>{l.rotulo}</td>
                <td style={{ textAlign: "right" }}>{l.visitantes}</td>
                <td style={{ textAlign: "right" }}>{l.eventos}</td>
                <td style={{ textAlign: "right" }}>
                  {l.taxaAnterior === null ? "—" : `${l.taxaAnterior}%`}
                </td>
                <td style={{ textAlign: "right" }}>{l.taxaTopo === null ? "—" : `${l.taxaTopo}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 24 }}>Sinais laterais</h3>
      <p className="lead">
        Não são degraus do funil: quem clica no WhatsApp não avançou para o checkout, pegou outro
        caminho. Ficam aqui para não distorcer a taxa de conversão.
      </p>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Sinal</th>
              <th style={{ textAlign: "right" }}>Visitantes</th>
              <th style={{ textAlign: "right" }}>Eventos</th>
              <th style={{ textAlign: "right" }}>Da visita</th>
            </tr>
          </thead>
          <tbody>
            {laterais.map((l) => (
              <tr key={l.nome}>
                <td>{l.rotulo}</td>
                <td style={{ textAlign: "right" }}>{l.visitantes}</td>
                <td style={{ textAlign: "right" }}>{l.eventos}</td>
                <td style={{ textAlign: "right" }}>{l.taxaTopo === null ? "—" : `${l.taxaTopo}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
