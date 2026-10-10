import { ORIGENS_DA_LANDING } from "./funil";
import { ehRoboDeFormulario, protocoloDe, type LeadValidado, type ResultadoDeValidacao } from "./leads";

// Recepção dos formulários do site novo (rotas /api/site/contato e /api/site/interesse),
// sem Next e sem banco: tudo o que tem efeito chega por Dependencias. Testada em
// tests/unit/receber-formulario.test.ts; src/server/formulario-site.ts liga ao Next.
//
// O site manda JSON de outra origem (waveops.com.br), então há preflight, e só lê `ok` e
// `campos` da resposta. Quatro decisões que parecem detalhe e não são:
//
// 1. CORS EM TODA RESPOSTA de origem permitida, inclusive 413, 422, 429 e 503, e também
//    quando algo quebra no meio. Sem o cabeçalho, o navegador esconde a resposta, o
//    fetch rejeita e a tela mostra falha de rede em vez de marcar o campo.
// 2. ORIGEM OBRIGATÓRIA. Diferente de /api/e, que trata origem ausente como o próprio
//    portal: aqui ninguém do portal envia, e o site sempre manda Origin.
// 3. NUNCA 2xx EM ERRO. Qualquer 2xx confirma para a pessoa ("Recebido"). Falha de banco,
//    banco ausente em produção e exceção inesperada são 503, e a tela oferece tentar de
//    novo e o WhatsApp, com os dados preservados.
// 4. ROBÔ RECEBE 200 sem gravar, antes da validação, para não aprender as regras.

export const CORPO_MAXIMO = 16 * 1024;

// Limites por IP. O bruto vem antes de ler o corpo e segura enxurrada de robô e de envio
// inválido (que não grava, mas gasta CPU e log). Os outros valem para envio válido.
const LIMITES = {
  bruto: { max: 30, janelaMs: 60_000 },
  minuto: { max: 5, janelaMs: 60_000 },
  hora: { max: 20, janelaMs: 3_600_000 },
} as const;

export type TipoDeFormulario = "contato" | "interesse";
export type ResultadoDaGravacao = "gravado" | "repetido" | "sem-banco";

export interface Resposta {
  status: number;
  corpo: Record<string, unknown> | null;
  cabecalhos: Record<string, string>;
}

export interface Dependencias {
  origin: string | null;
  ip: string;
  // null = passou de CORPO_MAXIMO.
  lerCorpo(): Promise<string | null>;
  validar(corpo: unknown): ResultadoDeValidacao;
  // true = dentro do limite (e o acesso conta).
  permitir(chave: string, max: number, janelaMs: number): boolean;
  gravar(lead: LeadValidado): Promise<ResultadoDaGravacao>;
  // Agenda o aviso ao time para depois da resposta.
  aoGravar(lead: LeadValidado): void;
  // Log sem dado pessoal.
  registrar(nivel: "info" | "warn" | "error", evento: string, campos: Record<string, unknown>): void;
  emProducao: boolean;
}

function origemPermitida(origin: string | null): origin is string {
  return !!origin && ORIGENS_DA_LANDING.includes(origin);
}

function resposta(origin: string | null, status: number, corpo: Record<string, unknown> | null, extra: Record<string, string> = {}): Resposta {
  const cabecalhos: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin", ...extra };
  if (origemPermitida(origin)) cabecalhos["Access-Control-Allow-Origin"] = origin;
  return { status, corpo, cabecalhos };
}

export function respostaDoPreflight(origin: string | null): Resposta {
  if (!origemPermitida(origin)) return { status: 204, corpo: null, cabecalhos: { Vary: "Origin" } };
  return {
    status: 204,
    corpo: null,
    cabecalhos: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  };
}

export async function receberFormulario(tipo: TipoDeFormulario, d: Dependencias): Promise<Resposta> {
  const { origin } = d;
  if (!origemPermitida(origin)) return resposta(null, 403, { ok: false, erro: "origem" });
  try {
    return await receber(tipo, d, origin);
  } catch (e) {
    d.registrar("error", "lead.erro_inesperado", { tipo, motivo: e instanceof Error ? e.message.slice(0, 200) : "desconhecido" });
    return resposta(origin, 503, { ok: false, erro: "indisponivel" });
  }
}

async function receber(tipo: TipoDeFormulario, d: Dependencias, origin: string): Promise<Resposta> {
  const chave = (janela: string) => `lead:${tipo}:${janela}:${d.ip}`;
  const volume = () => resposta(origin, 429, { ok: false, erro: "volume" }, { "Retry-After": "60" });

  if (!d.permitir(chave("bruto"), LIMITES.bruto.max, LIMITES.bruto.janelaMs)) {
    d.registrar("warn", "lead.volume_bruto", { tipo });
    return volume();
  }

  const texto = await d.lerCorpo();
  if (texto === null) return resposta(origin, 413, { ok: false, erro: "tamanho" });

  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return resposta(origin, 422, { ok: false, erro: "validacao", campos: ["corpo"] });
  }

  if (ehRoboDeFormulario(corpo)) {
    d.registrar("info", "lead.robo", { tipo });
    return resposta(origin, 200, { ok: true, protocolo: protocoloDe(corpo) });
  }

  const resultado = d.validar(corpo);
  if (!resultado.ok) {
    d.registrar("info", "lead.recusado", { tipo, campos: resultado.campos });
    return resposta(origin, 422, { ok: false, erro: "validacao", campos: resultado.campos });
  }

  if (!d.permitir(chave("min"), LIMITES.minuto.max, LIMITES.minuto.janelaMs) || !d.permitir(chave("hora"), LIMITES.hora.max, LIMITES.hora.janelaMs)) {
    d.registrar("warn", "lead.volume", { tipo });
    return volume();
  }

  let gravacao: ResultadoDaGravacao;
  try {
    gravacao = await d.gravar(resultado.dados);
  } catch (e) {
    d.registrar("error", "lead.falha_gravacao", { tipo, motivo: e instanceof Error ? e.message.slice(0, 200) : "desconhecido" });
    return resposta(origin, 503, { ok: false, erro: "indisponivel" });
  }

  // Sem banco em produção é configuração quebrada: responder 200 perderia o lead calado.
  if (gravacao === "sem-banco" && d.emProducao) {
    d.registrar("error", "lead.sem_banco", { tipo });
    return resposta(origin, 503, { ok: false, erro: "indisponivel" });
  }

  // Gravar antes de responder; avisar depois. A falha do aviso não muda o 200: o lead já
  // está no banco, e um 503 aqui faria a pessoa achar que perdeu o envio.
  if (gravacao === "gravado") {
    try {
      d.aoGravar(resultado.dados);
    } catch (e) {
      d.registrar("warn", "lead.aviso_falhou", { tipo, motivo: e instanceof Error ? e.message.slice(0, 200) : "desconhecido" });
    }
  }
  d.registrar("info", "lead.recebido", { tipo, gravacao });
  return resposta(origin, 200, { ok: true, protocolo: resultado.dados.idEnvio });
}
