// Limitador em memória (janela deslizante), um por processo. Suficiente para uma
// instância (o Railway roda uma réplica); para várias, trocar por Redis ou Upstash.
// Função pura com relógio injetado, testada em tests/unit/limitador.test.ts; o
// singleton usado pelas rotas vive em src/server/ratelimit.ts.
//
// Expurgo: sem ele, cada chave nova virava entrada permanente no Map. Ele roda no máximo
// a cada minuto e apaga a chave cujo último acesso passou da PRÓPRIA janela. O expurgo
// antigo usava um prazo fixo de 15 min e zerava o limite de 1 hora antes da hora (um IP
// gravava 75 leads por hora em vez de 20). [M5 do audit 2026-06-28; janela por chave em
// 2026-10-10]

const INTERVALO_DO_EXPURGO_MS = 60_000;

export interface Limitador {
  // true = dentro do limite (e o acesso conta); false = estourou.
  permitir(chave: string, max: number, janelaMs: number): boolean;
  tamanho(): number;
}

interface Registro {
  janela: number;
  tempos: number[];
}

export function criarLimitador(agora: () => number = Date.now): Limitador {
  const acessos = new Map<string, Registro>();
  let ultimoExpurgo = agora();

  function expurgar(t: number): void {
    if (t - ultimoExpurgo < INTERVALO_DO_EXPURGO_MS) return;
    ultimoExpurgo = t;
    for (const [chave, registro] of acessos) {
      const ultimo = registro.tempos[registro.tempos.length - 1];
      if (ultimo === undefined || t - ultimo > registro.janela) acessos.delete(chave);
    }
  }

  return {
    permitir(chave, max, janelaMs) {
      const t = agora();
      expurgar(t);
      const atual = acessos.get(chave);
      const tempos = (atual?.tempos ?? []).filter((x) => t - x < janelaMs);
      const janela = Math.max(janelaMs, atual?.janela ?? 0);
      if (tempos.length >= max) {
        acessos.set(chave, { janela, tempos });
        return false;
      }
      tempos.push(t);
      acessos.set(chave, { janela, tempos });
      return true;
    },
    tamanho: () => acessos.size,
  };
}
