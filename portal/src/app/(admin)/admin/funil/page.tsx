// 18 . Funil (/admin/funil)
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { readSession } from "@/server/auth";
import { env } from "@/server/env";
import { lerFunil, type LinhaFunil } from "@/server/funil";

// Server Component de propósito: lê o banco direto, sem passar por rota de API.
// A barreira de autorização é ESTA checagem, não o proxy: o proxy é otimista e a
// regra do projeto é barrar no servidor, junto do acesso ao dado.
export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90];

const num = (n: number) => n.toLocaleString("pt-BR");
const taxa = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR")}%`);

// A largura usa RAIZ QUADRADA da proporcao, nao a proporcao direta. Motivo: um funil
// real de topo de site vai de 1.240 visitas para 86 leads, e em escala linear tudo
// depois da segunda etapa vira um risco de 2 pixels, sem silhueta e sem leitura. A
// raiz preserva a ordem e a nocao de queda, e os numeros reais estao sempre escritos
// ao lado. A tela diz que a escala e essa, em vez de deixar o leitor supor.
function largura(l: LinhaFunil, topo: number): string {
  if (!topo || !l.visitantes) return "0%";
  return `${Math.max(3, Math.round(Math.sqrt(l.visitantes / topo) * 100))}%`;
}

export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  if (env.authEnforced) {
    const u = await readSession();
    if (!u || u.role !== "admin") redirect("/admin/login");
  }

  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const funil = await lerFunil(dias);

  const degraus = funil.linhas.filter((l) => l.etapa);
  const laterais = funil.linhas.filter((l) => !l.etapa);
  const topo = degraus[0]?.visitantes ?? 0;
  const { resumo } = funil;
  const vazio = !funil.erro && !funil.semBanco && topo === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Funil</h2>
          <div className="lead">
            Da visita ao cliente usando o portal, por visitante distinto. Últimos {dias} dias.
          </div>
        </div>
        <div className="seg">
          {PERIODOS.map((d) => (
            <Link
              key={d}
              href={`/admin/funil?dias=${d}`}
              className={d === dias ? "active" : undefined}
              style={{
                padding: "8px 16px",
                borderRadius: 7,
                fontWeight: 600,
                fontSize: "13.5px",
                color: d === dias ? "var(--accent-ink)" : "var(--muted)",
                background: d === dias ? "var(--accent)" : "transparent",
              }}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      {funil.erro && (
        <div className="alert warn" style={{ marginBottom: "var(--gap)" }}>
          <Icon name="alert" />
          <div>
            <div className="at">A medição não está gravando</div>
            <div className="as">{funil.erro}</div>
          </div>
        </div>
      )}

      {funil.semBanco && (
        <div className="alert warn" style={{ marginBottom: "var(--gap)" }}>
          <Icon name="alert" />
          <div>
            <div className="at">Sem banco configurado</div>
            <div className="as">
              O portal está em modo mock. Configure <code>DATABASE_URL</code> para medir de verdade.
            </div>
          </div>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: "var(--gap)" }}>
        <Metrica icone="trend" rotulo="Visitas" valor={resumo.visitas} nota="topo do funil" />
        <Metrica
          icone="users"
          rotulo="Leads"
          valor={resumo.leads}
          nota={`${taxa(degraus.find((l) => l.nome === "lead_enviado")?.taxaTopo ?? null)} das visitas`}
        />
        <Metrica icone="money" rotulo="Pagamentos" valor={resumo.pagamentos} nota="faturas confirmadas" />
        <Metrica
          icone="checkCircle"
          rotulo="Conversão"
          valor={taxa(resumo.conversaoGeral)}
          nota="visita que virou pagamento"
          destaque
        />
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, marginBottom: 10 }}>
          <h3 style={{ fontSize: 17 }}>Onde as pessoas param</h3>
          {funil.piorQueda && (
            <span className="badge danger">
              <span className="d" />
              maior perda: {degraus.find((l) => l.nome === funil.piorQueda)?.rotulo}
            </span>
          )}
        </div>
        <p className="lead" style={{ marginTop: 0, marginBottom: 16, fontSize: 12.5 }}>
          A largura da barra usa escala de raiz quadrada. Em escala linear, tudo depois da segunda
          etapa viraria um risco de dois pixels. Os números ao lado são os reais.
        </p>

        {vazio ? (
          <div className="empty">
            <div className="ei">
              <Icon name="trend" />
            </div>
            <h3>Nenhum evento ainda</h3>
            <p>
              A medição está de pé, mas ninguém passou pelo funil nos últimos {dias} dias. A primeira
              visita à landing já aparece aqui.
            </p>
          </div>
        ) : (
          <div className="funnel">
            {degraus.map((l, i) => (
              <div key={l.nome}>
                {i > 0 && (
                  <div className={`fdrop${funil.piorQueda === l.nome ? " pior" : ""}`}>
                    <span className="fvao">
                      <span className="fperda">
                        {l.perdidos > 0 ? `− ${num(l.perdidos)} saíram` : "sem perda"}
                      </span>
                      <span className="fnota">{taxa(l.taxaAnterior)} seguiram</span>
                    </span>
                  </div>
                )}
                <div
                  className={`fstage${i === degraus.length - 1 ? " fim" : ""}${l.visitantes === 0 ? " zero" : ""}`}
                >
                  <div className="fnum">{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="flabel">{l.rotulo}</div>
                    <div className="fsub">{num(l.eventos)} eventos</div>
                  </div>
                  <div
                    className="fbar"
                    style={
                      { "--w": largura(l, topo), "--d": `${i * 70}ms` } as React.CSSProperties
                    }
                  />
                  <div className="fnums">
                    <div className="fqtd">{num(l.visitantes)}</div>
                    <div className="fpct">{taxa(l.taxaTopo)} do topo</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "var(--gap)" }}>
        <h3 style={{ fontSize: 17 }}>Sinais laterais</h3>
        <p className="lead" style={{ marginTop: 4, marginBottom: 12, fontSize: 13.5 }}>
          Não são degraus. Quem clica no WhatsApp não avançou para o checkout, pegou outro caminho.
          Ficam fora da conta para não distorcer a conversão.
        </p>
        <div className="fside">
          {laterais.map((l) => (
            <div className="fside-row" key={l.nome}>
              <div className="flabel" style={{ fontSize: 14 }}>
                {l.rotulo}
              </div>
              <div className="fbar" style={{ "--w": largura(l, topo) } as React.CSSProperties} />
              <div className="fv">
                {num(l.visitantes)} · {taxa(l.taxaTopo)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Metrica({
  icone,
  rotulo,
  valor,
  nota,
  destaque,
}: {
  icone: IconName;
  rotulo: string;
  valor: number | string;
  nota: string;
  destaque?: boolean;
}) {
  return (
    <div className="metric">
      <div className="mlab">
        <span className="mi">
          <Icon name={icone} />
        </span>
        {rotulo}
      </div>
      <div className="mval" style={destaque ? { color: "var(--accent-strong)" } : undefined}>
        {typeof valor === "number" ? num(valor) : valor}
      </div>
      <div className="mdelta flat">{nota}</div>
    </div>
  );
}
