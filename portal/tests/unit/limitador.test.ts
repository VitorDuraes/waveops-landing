import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { criarLimitador } from "../../src/lib/limitador";

// Limitador em memória (janela deslizante) com relógio injetado. O bug que estes testes
// prendem: o expurgo apagava qualquer chave parada há 15 min, e o limite de 1 hora
// zerava antes da hora (um IP gravava 75 leads por hora em vez de 20).

function relogio(inicio = 1_000_000) {
  let agora = inicio;
  return { agora: () => agora, andar: (ms: number) => (agora += ms) };
}

describe("criarLimitador", () => {
  test("permite até o máximo e barra o seguinte", () => {
    const r = relogio();
    const l = criarLimitador(r.agora);
    for (let i = 0; i < 5; i++) assert.equal(l.permitir("ip", 5, 60_000), true, `acesso ${i + 1}`);
    assert.equal(l.permitir("ip", 5, 60_000), false);
  });

  test("a janela desliza: o acesso mais antigo sai e libera vaga", () => {
    const r = relogio();
    const l = criarLimitador(r.agora);
    for (let i = 0; i < 5; i++) l.permitir("ip", 5, 60_000);
    r.andar(60_001);
    assert.equal(l.permitir("ip", 5, 60_000), true);
  });

  test("limite de 1 hora vale a hora inteira, mesmo com o expurgo rodando", () => {
    const r = relogio();
    const l = criarLimitador(r.agora);
    let permitidos = 0;
    // Uma tentativa a cada 10 s durante 1 hora: 360 tentativas.
    for (let i = 0; i < 360; i++) {
      if (l.permitir("ip:hora", 20, 3_600_000)) permitidos++;
      r.andar(10_000);
    }
    assert.equal(permitidos, 20);
  });

  test("chave parada além da própria janela sai da memória; dentro dela, fica", () => {
    const r = relogio();
    const l = criarLimitador(r.agora);
    l.permitir("curta", 5, 60_000);
    l.permitir("longa", 5, 3_600_000);
    r.andar(20 * 60_000);
    l.permitir("outra", 5, 60_000); // dispara a varredura
    assert.equal(l.tamanho(), 2, "a de 1 minuto saiu, a de 1 hora ficou");
    r.andar(41 * 60_000);
    l.permitir("mais-uma", 5, 60_000);
    assert.equal(l.tamanho(), 1, "a de 1 hora saiu depois da própria janela");
  });

  test("chaves diferentes não dividem balde", () => {
    const l = criarLimitador(relogio().agora);
    assert.equal(l.permitir("a", 1, 60_000), true);
    assert.equal(l.permitir("b", 1, 60_000), true);
    assert.equal(l.permitir("a", 1, 60_000), false);
  });
});
