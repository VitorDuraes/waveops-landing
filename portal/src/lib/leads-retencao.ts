import type { LeadTipo } from "./leads-admin";

// Limites operacionais aprovados para preparar a retenção. Atingir o prazo é um
// critério para revisão, não uma autorização de exclusão nem o encerramento de H4.
const PRAZOS = { contato: 180, interesse: 365 } as const;
const TIPOS = ["contato", "interesse"] as const;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface LimiteRetencaoLead {
  dias: number;
  where: { tipo: LeadTipo; createdAt: { lte: Date } };
}

export interface LimitesRetencaoLeads {
  calculadaEm: string;
  contato: LimiteRetencaoLead;
  interesse: LimiteRetencaoLead;
}

export type ContagensRetencaoLeads = Record<LeadTipo, {
  total: number; prazoAtingido: number; revisaoVigente: number; revisaoVencida: number;
}>;

export interface FaixaRetencaoLead {
  tipo: LeadTipo;
  dias: number;
  criadosAte: string;
  total: number;
  noPrazo: number;
  prazoAtingido: number;
  revisaoVigente: number;
  revisaoVencida: number;
  semExcecao: number;
}

export interface PreviaRetencaoLeads {
  calculadaEm: string;
  tipos: FaixaRetencaoLead[];
}

export type ResultadoPreviaRetencao =
  | { ok: true; previa: PreviaRetencaoLeads }
  | { ok: false; motivo: "sem_permissao" | "sem_banco" };

export interface DependenciasPreviaRetencao {
  papel: string | null;
  agora: () => Date;
  contar: ((limites: LimitesRetencaoLeads) => Promise<ContagensRetencaoLeads>) | null;
}

export function limitesRetencaoLeads(agora: Date): LimitesRetencaoLeads {
  const instante = agora.getTime();
  if (!Number.isFinite(instante)) throw new RangeError("Instante de retenção inválido.");

  const limite = (tipo: LeadTipo): LimiteRetencaoLead => {
    const data = new Date(instante - PRAZOS[tipo] * DIA_MS);
    if (!Number.isFinite(data.getTime())) throw new RangeError("Limite de retenção inválido.");
    return { dias: PRAZOS[tipo], where: { tipo, createdAt: { lte: data } } };
  };
  return { calculadaEm: agora.toISOString(), contato: limite("contato"), interesse: limite("interesse") };
}

export function montarPreviaRetencaoLeads(
  limites: LimitesRetencaoLeads,
  contagens: ContagensRetencaoLeads,
): PreviaRetencaoLeads {
  return {
    calculadaEm: limites.calculadaEm,
    tipos: TIPOS.map((tipo) => {
      const { total, prazoAtingido, revisaoVigente, revisaoVencida } = contagens[tipo];
      if (![total, prazoAtingido, revisaoVigente, revisaoVencida].every((n) => Number.isSafeInteger(n) && n >= 0)
        || prazoAtingido > total || revisaoVigente > prazoAtingido || revisaoVencida > prazoAtingido - revisaoVigente) {
        throw new RangeError("Contagens de retenção inconsistentes.");
      }
      return {
        tipo,
        dias: limites[tipo].dias,
        criadosAte: limites[tipo].where.createdAt.lte.toISOString(),
        total,
        noPrazo: total - prazoAtingido,
        prazoAtingido,
        revisaoVigente,
        revisaoVencida,
        semExcecao: prazoAtingido - revisaoVigente - revisaoVencida,
      };
    }),
  };
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function iso(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) && data.toISOString() === valor;
}

// A resposta é validada antes de aparecer na tela. Campo extra não é preservado,
// contagem incoerente não vira zero e uma data do cliente nunca define os limites.
export function lerPreviaRetencaoLeads(valor: unknown): PreviaRetencaoLeads | null {
  if (!objeto(valor) || !iso(valor.calculadaEm) || !Array.isArray(valor.tipos) || valor.tipos.length !== 2) return null;
  try {
    const limites = limitesRetencaoLeads(new Date(valor.calculadaEm));
    const contagens = {} as ContagensRetencaoLeads;
    for (const [i, tipo] of TIPOS.entries()) {
      const faixa: unknown = valor.tipos[i];
      if (!objeto(faixa) || faixa.tipo !== tipo || faixa.dias !== limites[tipo].dias || faixa.criadosAte !== limites[tipo].where.createdAt.lte.toISOString()) return null;
      if (typeof faixa.total !== "number" || typeof faixa.prazoAtingido !== "number" || faixa.noPrazo !== faixa.total - faixa.prazoAtingido) return null;
      if (typeof faixa.revisaoVigente !== "number" || typeof faixa.revisaoVencida !== "number"
        || faixa.semExcecao !== faixa.prazoAtingido - faixa.revisaoVigente - faixa.revisaoVencida) return null;
      contagens[tipo] = { total: faixa.total, prazoAtingido: faixa.prazoAtingido, revisaoVigente: faixa.revisaoVigente, revisaoVencida: faixa.revisaoVencida };
    }
    return montarPreviaRetencaoLeads(limites, contagens);
  } catch (erro) {
    if (erro instanceof RangeError) return null;
    throw erro;
  }
}

// A DAL passa o papel da sessão e uma porta que executa somente as contagens. A
// decisão de acesso acontece antes de qualquer chamada ao banco ou ao relógio.
export async function executarPreviaRetencaoLeads(deps: DependenciasPreviaRetencao): Promise<ResultadoPreviaRetencao> {
  if (deps.papel !== "admin") return { ok: false, motivo: "sem_permissao" };
  if (!deps.contar) return { ok: false, motivo: "sem_banco" };
  const limites = limitesRetencaoLeads(deps.agora());
  return { ok: true, previa: montarPreviaRetencaoLeads(limites, await deps.contar(limites)) };
}
