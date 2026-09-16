import "server-only";
import { getPrisma } from "./db";
import { env } from "./env";
import { ETAPAS, EVENTOS, ROTULO_ETAPA, type NomeEvento } from "@/lib/funil";

// Leitura do funil para a tela do admin (SPEC-18).
//
// A conta e por VISITANTE DISTINTO, nunca por linha de evento. Contar linha
// inflaria o topo (quem recarrega a pagina cinco vezes viraria cinco visitas) e
// deixaria a taxa de conversao menor do que a real.

export interface LinhaFunil {
  nome: NomeEvento;
  rotulo: string;
  etapa: boolean; // degrau do funil, ou sinal lateral
  visitantes: number;
  eventos: number;
  taxaAnterior: number | null; // % em relacao ao degrau anterior
  taxaTopo: number | null; // % em relacao a visita
}

export interface Funil {
  desde: Date;
  linhas: LinhaFunil[];
  semBanco: boolean;
}

function pct(parte: number, total: number): number | null {
  if (!total) return null;
  return Math.round((parte / total) * 1000) / 10;
}

export async function lerFunil(dias = 30): Promise<Funil> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  if (!env.hasDb()) {
    return {
      desde,
      semBanco: true,
      linhas: EVENTOS.map((nome) => ({
        nome,
        rotulo: ROTULO_ETAPA[nome],
        etapa: ETAPAS.includes(nome),
        visitantes: 0,
        eventos: 0,
        taxaAnterior: null,
        taxaTopo: null,
      })),
    };
  }

  // Uma consulta so, agrupada no banco. Duas contagens por evento: linhas (volume
  // bruto) e visitantes distintos (o numero que vale para conversao).
  const linhas = await getPrisma().$queryRaw<{ nome: string; visitantes: bigint; eventos: bigint }[]>`
    SELECT nome, COUNT(DISTINCT visitor_id) AS visitantes, COUNT(*) AS eventos
    FROM eventos
    WHERE created_at >= ${desde}
    GROUP BY nome
  `;
  const porNome = new Map(linhas.map((l) => [l.nome, l]));

  const topo = Number(porNome.get("visita")?.visitantes ?? 0);
  let anterior = topo;

  const saida: LinhaFunil[] = EVENTOS.map((nome) => {
    const bruto = porNome.get(nome);
    const visitantes = Number(bruto?.visitantes ?? 0);
    const eventos = Number(bruto?.eventos ?? 0);
    const etapa = ETAPAS.includes(nome);
    // Sinal lateral (viu preco, clicou no WhatsApp) so ganha taxa em relacao ao topo:
    // compara-lo com o degrau anterior daria um numero sem significado.
    const taxaAnterior = etapa && nome !== "visita" ? pct(visitantes, anterior) : null;
    const taxaTopo = pct(visitantes, topo);
    if (etapa) anterior = visitantes;
    return { nome, rotulo: ROTULO_ETAPA[nome], etapa, visitantes, eventos, taxaAnterior, taxaTopo };
  });

  // Degraus primeiro, na ordem do funil; sinais laterais depois.
  saida.sort((a, b) => {
    if (a.etapa !== b.etapa) return a.etapa ? -1 : 1;
    if (a.etapa) return ETAPAS.indexOf(a.nome) - ETAPAS.indexOf(b.nome);
    return 0;
  });

  return { desde, linhas: saida, semBanco: false };
}
