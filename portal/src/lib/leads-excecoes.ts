// Janela operacional confirmada por Vitor. Não define base legal nem autoriza expurgo.
export const MAX_DIAS_REVISAO = 30;
export const MIN_JUSTIFICATIVA = 20;
export const MAX_JUSTIFICATIVA = 500;
const DIA_MS = 86_400_000;
const MAX_VERSAO = 2_147_483_647;

export type PedidoRetencao =
  | { acao: "registrar"; versao: number; justificativa: string; dias: number }
  | { acao: "encerrar"; versao: number };
export type LeituraPedidoRetencao = { ok: true; pedido: PedidoRetencao } | { ok: false; erro: string };
export type ComandoRetencao =
  | { acao: "registrar"; versao: number; justificativa: string; registradaEm: Date; revisarEm: Date }
  | { acao: "encerrar"; versao: number };
export interface RegistroRetencao {
  versao: number;
  justificativa: string | null;
  registradaEm: Date | null;
  revisarEm: Date | null;
  por: string | null;
}
export interface ConsultaRetencao {
  calculadaEm: string;
  versao: number;
  excecao: null | {
    justificativa: string;
    registradaEm: string;
    revisarEm: string;
    por: string;
    estado: "vigente" | "vencida";
  };
}
type FalhaRetencao = { ok: false; motivo: "sem_permissao" | "sem_banco" | "nao_encontrado" | "conflito" }
  | { ok: false; motivo: "entrada_invalida"; erro: string };
export type ResultadoConsultaRetencao = { ok: true; consulta: ConsultaRetencao } | FalhaRetencao;
export type ResultadoAlteracaoRetencao = { ok: true; consulta: ConsultaRetencao; mudou: boolean } | FalhaRetencao;
export type ResultadoPortaAlteracao =
  | { ok: true; registro: RegistroRetencao | null; mudou: boolean }
  | { ok: false; motivo: "nao_encontrado" | "conflito" };
export interface DependenciasConsultaRetencao {
  papel: string | null;
  agora: () => Date;
  consultar: ((id: string) => Promise<{ registro: RegistroRetencao | null } | null>) | null;
}
export interface DependenciasAlteracaoRetencao {
  papel: string | null;
  por: string | null;
  agora: () => Date;
  alterar: ((id: string, comando: ComandoRetencao, por: string) => Promise<ResultadoPortaAlteracao>) | null;
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
function versaoValida(valor: unknown, maximo = MAX_VERSAO): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= maximo;
}
function textoSeguro(valor: string): boolean {
  // Quebra de linha é permitida na justificativa. Controles e surrogates isolados não são.
  if (/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(valor)) return false;
  return Array.from(valor).every((c) => {
    const ponto = c.codePointAt(0)!;
    return ponto < 0xd800 || ponto > 0xdfff;
  });
}
function justificativaNormalizada(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.replace(/\r\n?/g, "\n").trim().normalize("NFC");
  const tamanho = Array.from(texto).length;
  return tamanho >= MIN_JUSTIFICATIVA && tamanho <= MAX_JUSTIFICATIVA && textoSeguro(texto) ? texto : null;
}
function responsavelValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim() === valor && valor.length > 0
    && Array.from(valor).length <= 254 && textoSeguro(valor) && !valor.includes("\n");
}
function instante(data: Date): number {
  if (!(data instanceof Date) || !Number.isFinite(data.getTime())) throw new RangeError("Instante de revisão inválido.");
  return data.getTime();
}
function iso(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) && data.toISOString() === valor;
}
function idValido(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,100}$/.test(id);
}

export function lerPedidoRetencao(corpo: unknown): LeituraPedidoRetencao {
  if (!objeto(corpo) || !versaoValida(corpo.versao, MAX_VERSAO - 1)) {
    return { ok: false, erro: "Recarregue a exceção antes de alterar. A versão enviada é inválida." };
  }
  if (corpo.acao === "encerrar") return { ok: true, pedido: { acao: "encerrar", versao: corpo.versao } };
  if (corpo.acao !== "registrar") return { ok: false, erro: "Ação inválida. Use registrar ou encerrar." };
  const justificativa = justificativaNormalizada(corpo.justificativa);
  if (!justificativa) return { ok: false, erro: "Informe uma justificativa de 20 a 500 caracteres, sem caracteres de controle." };
  if (typeof corpo.dias !== "number" || !Number.isInteger(corpo.dias) || corpo.dias < 1 || corpo.dias > MAX_DIAS_REVISAO) {
    return { ok: false, erro: "Escolha uma revisão entre 1 e 30 dias." };
  }
  return { ok: true, pedido: { acao: "registrar", versao: corpo.versao, justificativa, dias: corpo.dias } };
}

export function prepararAlteracaoRetencao(pedido: PedidoRetencao, agora: Date): ComandoRetencao {
  const milissegundos = instante(agora);
  if (pedido.acao === "encerrar") return { acao: "encerrar", versao: pedido.versao };
  const revisarEm = new Date(milissegundos + pedido.dias * DIA_MS);
  instante(revisarEm);
  return { acao: "registrar", versao: pedido.versao, justificativa: pedido.justificativa, registradaEm: new Date(milissegundos), revisarEm };
}

export function montarConsultaRetencao(registro: RegistroRetencao | null, agora: Date): ConsultaRetencao {
  const calculada = instante(agora);
  const consulta: ConsultaRetencao = { calculadaEm: agora.toISOString(), versao: registro?.versao ?? 0, excecao: null };
  if (!registro) return consulta;
  if (!versaoValida(registro.versao)) throw new RangeError("Versão de revisão inválida.");
  const campos = [registro.justificativa, registro.registradaEm, registro.revisarEm, registro.por];
  if (campos.every((valor) => valor === null)) return consulta;
  if (campos.some((valor) => valor === null) || registro.versao === 0
    || justificativaNormalizada(registro.justificativa) !== registro.justificativa || !responsavelValido(registro.por)) {
    throw new RangeError("Exceção de retenção inconsistente.");
  }
  const registrada = instante(registro.registradaEm!);
  const revisao = instante(registro.revisarEm!);
  if (revisao <= registrada || revisao - registrada > MAX_DIAS_REVISAO * DIA_MS) throw new RangeError("Janela de revisão inválida.");
  consulta.excecao = {
    justificativa: registro.justificativa!, registradaEm: registro.registradaEm!.toISOString(),
    revisarEm: registro.revisarEm!.toISOString(), por: registro.por,
    estado: revisao > calculada ? "vigente" : "vencida",
  };
  return consulta;
}

// Falha de leitura não é ausência de exceção. Reconstruir também descarta campos extras.
export function lerConsultaRetencao(corpo: unknown): ConsultaRetencao | null {
  if (!objeto(corpo) || !iso(corpo.calculadaEm) || !versaoValida(corpo.versao)) return null;
  try {
    const agora = new Date(corpo.calculadaEm);
    if (corpo.excecao === null) return { calculadaEm: corpo.calculadaEm, versao: corpo.versao, excecao: null };
    const e = corpo.excecao;
    if (!objeto(e) || typeof e.justificativa !== "string" || !responsavelValido(e.por) || !iso(e.registradaEm) || !iso(e.revisarEm)) return null;
    const consulta = montarConsultaRetencao({ versao: corpo.versao, justificativa: e.justificativa, por: e.por, registradaEm: new Date(e.registradaEm), revisarEm: new Date(e.revisarEm) }, agora);
    return e.estado === consulta.excecao?.estado ? consulta : null;
  } catch (erro) {
    if (erro instanceof RangeError) return null;
    throw erro;
  }
}

export async function executarConsultaRetencao(deps: DependenciasConsultaRetencao, id: string): Promise<ResultadoConsultaRetencao> {
  if (deps.papel !== "admin") return { ok: false, motivo: "sem_permissao" };
  if (!idValido(id)) return { ok: false, motivo: "entrada_invalida", erro: "Identificador de lead inválido." };
  if (!deps.consultar) return { ok: false, motivo: "sem_banco" };
  const agora = deps.agora();
  const alvo = await deps.consultar(id);
  return alvo ? { ok: true, consulta: montarConsultaRetencao(alvo.registro, agora) } : { ok: false, motivo: "nao_encontrado" };
}

export async function executarAlteracaoRetencao(deps: DependenciasAlteracaoRetencao, id: string, corpo: unknown): Promise<ResultadoAlteracaoRetencao> {
  if (deps.papel !== "admin" || !responsavelValido(deps.por)) return { ok: false, motivo: "sem_permissao" };
  if (!idValido(id)) return { ok: false, motivo: "entrada_invalida", erro: "Identificador de lead inválido." };
  const leitura = lerPedidoRetencao(corpo);
  if (!leitura.ok) return { ok: false, motivo: "entrada_invalida", erro: leitura.erro };
  if (!deps.alterar) return { ok: false, motivo: "sem_banco" };
  const agora = deps.agora();
  const resultado = await deps.alterar(id, prepararAlteracaoRetencao(leitura.pedido, agora), deps.por);
  return resultado.ok ? { ok: true, consulta: montarConsultaRetencao(resultado.registro, agora), mudou: resultado.mudou } : resultado;
}
