import "server-only";
import { getPrisma } from "./db";
import { env } from "./env";
import { log } from "./log";
import { ETAPAS, EVENTOS, EVENTOS_DA_LANDING, ROTULO_ETAPA, type NomeEvento } from "@/lib/funil";

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
  perdidos: number; // quantos ficaram pelo caminho desde o degrau anterior
}

export interface Resumo {
  visitas: number;
  leads: number;
  pagamentos: number;
  ativacoes: number;
  conversaoGeral: number | null; // % de visita que virou pagamento
}

export interface Funil {
  desde: Date;
  linhas: LinhaFunil[];
  resumo: Resumo;
  // Degrau onde mais gente ficou pelo caminho. E por onde comeca qualquer conversa
  // sobre conversao, entao a tela marca em vez de deixar o leitor procurar.
  piorQueda: NomeEvento | null;
  semBanco: boolean;
  // Mensagem quando a consulta falha (tipicamente: tabela ainda nao existe porque a
  // migration nao rodou). A tela mostra isso em vez de estourar erro de servidor.
  erro?: string;
}

function zeradas(): LinhaFunil[] {
  return EVENTOS.map((nome) => ({
    nome,
    rotulo: ROTULO_ETAPA[nome],
    etapa: ETAPAS.includes(nome),
    visitantes: 0,
    eventos: 0,
    taxaAnterior: null,
    taxaTopo: null,
    perdidos: 0,
  }));
}

const RESUMO_ZERO: Resumo = { visitas: 0, leads: 0, pagamentos: 0, ativacoes: 0, conversaoGeral: null };

function resumoDe(linhas: LinhaFunil[]): Resumo {
  const q = (nome: NomeEvento) => linhas.find((l) => l.nome === nome)?.visitantes ?? 0;
  const visitas = q("visita");
  const pagamentos = q("pagamento_confirmado");
  return {
    visitas,
    leads: q("lead_enviado"),
    pagamentos,
    ativacoes: q("ativacao"),
    conversaoGeral: pct(pagamentos, visitas),
  };
}

// Abaixo deste volume no topo, a tela mostra os numeros mas nao tira conclusao.
export const MINIMO_PARA_DIAGNOSTICO = 30;

function pct(parte: number, total: number): number | null {
  if (!total) return null;
  return Math.round((parte / total) * 1000) / 10;
}

export interface LinhaOrigem {
  fonte: string;
  visitas: number;
  leads: number;
  pagantes: number;
  taxa: number | null; // % de visita que virou pagamento, por canal
}

// "Qual canal traz pagante". A pergunta so fica de pe porque o visitorId e o MESMO
// nos dois dominios no mesmo dia: a visita chega marcada com a fonte na landing, e o
// pagamento acontece no portal, sem fonte nenhuma. O join por visitor_id costura os
// dois. Atribuicao de ULTIMO toque dentro do dia, que e o que este desenho sustenta:
// o hash troca a meia-noite, entao visita de segunda e pagamento de quarta nao se
// encontram aqui. Para esse caso existe Customer.visitorId, que e outro caminho.
export async function lerOrigens(dias = 30): Promise<LinhaOrigem[]> {
  if (!env.hasDb()) return [];
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  try {
    const linhas = await getPrisma().$queryRaw<
      { fonte: string | null; visitas: bigint; leads: bigint; pagantes: bigint }[]
    >`
      SELECT
        COALESCE(v.fonte, 'direto') AS fonte,
        COUNT(DISTINCT v.visitor_id) AS visitas,
        COUNT(DISTINCT l.visitor_id) AS leads,
        COUNT(DISTINCT p.visitor_id) AS pagantes
      FROM eventos v
      LEFT JOIN eventos l
        ON l.visitor_id = v.visitor_id AND l.nome = 'lead_enviado' AND l.origem = 'landing' AND l.created_at >= ${desde}
      LEFT JOIN eventos p
        ON p.visitor_id = v.visitor_id AND p.nome = 'pagamento_confirmado' AND p.created_at >= ${desde}
      WHERE v.nome = 'visita' AND v.origem = 'landing' AND v.created_at >= ${desde}
      GROUP BY COALESCE(v.fonte, 'direto')
      ORDER BY 2 DESC
      LIMIT 15
    `;
    return linhas.map((l) => {
      const visitas = Number(l.visitas);
      const pagantes = Number(l.pagantes);
      return {
        fonte: l.fonte || "direto",
        visitas,
        leads: Number(l.leads),
        pagantes,
        taxa: pct(pagantes, visitas),
      };
    });
  } catch (e) {
    log.error("origens.consulta_falhou", { erro: e instanceof Error ? e.message : "desconhecido" });
    return [];
  }
}

export async function lerFunil(dias = 30): Promise<Funil> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  if (!env.hasDb()) return { desde, semBanco: true, linhas: zeradas(), resumo: RESUMO_ZERO, piorQueda: null };

  // Uma consulta so, agrupada no banco. Duas contagens por evento: linhas (volume
  // bruto) e visitantes distintos (o numero que vale para conversao).
  //
  // O try/catch existe por um motivo concreto: se a migration nao rodou, a tabela nao
  // existe e a consulta estoura. Sem isso, a tela responde erro de servidor generico e
  // nao diz o que fazer. Aconteceu em 16/09/2026, por DIRECT_URL ausente no Railway.
  let linhas: { nome: string; visitantes: bigint; eventos: bigint }[];
  try {
    linhas = await getPrisma().$queryRaw<{ nome: string; visitantes: bigint; eventos: bigint }[]>`
      SELECT nome, COUNT(DISTINCT visitor_id) AS visitantes, COUNT(*) AS eventos
      FROM eventos
      WHERE created_at >= ${desde}
        AND (origem = 'landing' OR NOT (nome = ANY(${EVENTOS_DA_LANDING})))
      GROUP BY nome
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const semTabela = /eventos/i.test(msg) && /(does not exist|rela..o|relation)/i.test(msg);
    log.error("funil.consulta_falhou", { erro: msg.slice(0, 300) });
    return {
      desde,
      semBanco: false,
      linhas: zeradas(),
      resumo: RESUMO_ZERO,
      piorQueda: null,
      erro: semTabela
        ? "A tabela eventos ainda nao existe. Rode a migration no ambiente (npm run db:deploy). Se ela falhar com P1012, falta a variavel DIRECT_URL: veja portal/docs/deploy-railway.md."
        : "Nao foi possivel consultar os eventos. Detalhe no log do servidor.",
    };
  }
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
    const perdidos = etapa && nome !== "visita" ? Math.max(0, anterior - visitantes) : 0;
    if (etapa) anterior = visitantes;
    return { nome, rotulo: ROTULO_ETAPA[nome], etapa, visitantes, eventos, taxaAnterior, taxaTopo, perdidos };
  });

  // Degraus primeiro, na ordem do funil; sinais laterais depois.
  saida.sort((a, b) => {
    if (a.etapa !== b.etapa) return a.etapa ? -1 : 1;
    if (a.etapa) return ETAPAS.indexOf(a.nome) - ETAPAS.indexOf(b.nome);
    return 0;
  });

  // Maior queda em NUMERO de pessoas, nao em porcentagem: 60% de 5 visitantes e
  // ruido, 20% de 400 e o problema de verdade.
  const degraus = saida.filter((l) => l.etapa);
  const pior = degraus.reduce<LinhaFunil | null>((p, l) => (l.perdidos > (p?.perdidos ?? 0) ? l : p), null);

  return {
    desde,
    linhas: saida,
    resumo: resumoDe(saida),
    // O marcador so aparece com amostra que sustenta a conclusao. Sem esse piso, no
    // primeiro dia de medicao (1 visita, 1 lead, 0 checkout) a tela apontaria "maior
    // perda: checkout aberto" com base em UMA pessoa. Apontar o dedo para o lugar
    // errado com ar de certeza e pior do que nao apontar.
    piorQueda: topo >= MINIMO_PARA_DIAGNOSTICO && pior && pior.perdidos > 0 ? pior.nome : null,
    semBanco: false,
  };
}
