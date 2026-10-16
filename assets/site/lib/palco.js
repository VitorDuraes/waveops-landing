// @ts-check
/* WaveOps · contas do palco de fundo da Home (spec 13). Funções puras, sem DOM: recebem as
   medidas que o módulo da página lê com getBoundingClientRect e devolvem qual capítulo está
   ativo, até qual passo a cena dele está montada e quanto a cena encolhe para caber na tela.
   Testadas em tests/site/unit/palco.test.mjs. */

/** Janela em que o palco liga. Abaixo de 560 px de altura a cena não cabe junto com o topo e o
    painel, e cada capítulo vira uma faixa com a cena montada (spec 13.3). */
export const MIDIA_PALCO = '(min-height: 560px)';

/** Tamanho para o qual a cena é desenhada no desktop e no celular (spec 13.3). */
export const CENA_DESKTOP = Object.freeze({ largura: 720, altura: 480 });
export const CENA_CELULAR = Object.freeze({ largura: 350, altura: 420 });

/**
 * Quanto do trecho entre `inicio` e `fim` o `valor` já percorreu, de 0 a 1. O trecho pode ser
 * decrescente (o topo de um capítulo sobe na tela). Trecho vazio vale 1 a partir do início.
 * @param {number} inicio
 * @param {number} fim
 * @param {number} valor
 * @returns {number}
 */
export function progressoNoTrecho(inicio, fim, valor) {
  if (inicio === fim) return valor >= inicio ? 1 : 0;
  return Math.min(1, Math.max(0, (valor - inicio) / (fim - inicio)));
}

/**
 * Passo de 1 a `total` para um progresso de 0 a 1. O primeiro passo aparece já no início,
 * para a tela nunca ficar vazia.
 * @param {number} progresso
 * @param {number} total
 * @returns {number}
 */
export function passoPorProgresso(progresso, total) {
  return Math.min(total, Math.max(1, Math.ceil(progresso * total)));
}

/**
 * O capítulo ativo é o último cujo topo passou da metade da janela. A cena dele se monta
 * enquanto a metade da janela percorre os primeiros 75% do capítulo. Antes do primeiro
 * capítulo, nenhum fica ativo e nenhuma cena aparece: `{ ativa: -1, passo: 0 }`.
 * @param {{ topo: number, altura: number }[]} capitulos caixas dos capítulos, em ordem
 * @param {number} alturaJanela
 * @param {number[]} totais quantos passos tem cada cena
 * @returns {{ ativa: number, passo: number }}
 */
export function estadoFixo(capitulos, alturaJanela, totais) {
  const linha = alturaJanela / 2;
  let ativa = -1;
  capitulos.forEach((capitulo, i) => {
    if (capitulo.topo <= linha) ativa = i;
  });
  if (ativa === -1) return { ativa, passo: 0 };
  const { topo, altura } = capitulos[ativa];
  return { ativa, passo: passoPorProgresso(progressoNoTrecho(topo, topo + 0.75 * altura, linha), totais[ativa]) };
}

/**
 * Escala da cena para ela caber inteira na área útil. Nunca aumenta: no máximo 1.
 * @param {{ largura: number, altura: number }} area
 * @param {{ largura: number, altura: number }} cena
 * @returns {number}
 */
export function escalaDaCena(area, cena) {
  return Math.min(1, area.largura / cena.largura, area.altura / cena.altura);
}
