// @ts-check
/* WaveOps · contas do palco das cinco frentes da Home (spec 13). Funções puras, sem DOM:
   recebem as medidas que o módulo da página lê com getBoundingClientRect e devolvem qual cena
   está ativa e até qual passo ela está montada. Testadas em tests/site/unit/palco.test.mjs. */

/** Janela em que o palco fica fixo ao lado da lista. Abaixo de 600 px de altura o palco não
    cabe, e cada cena passa a se montar embaixo do texto da sua frente (spec 13.3). */
export const MIDIA_FIXO = '(min-width: 1024px) and (min-height: 600px)';

/**
 * Quanto do trecho entre `inicio` e `fim` o `valor` já percorreu, de 0 a 1. O trecho pode ser
 * decrescente (o topo de uma cena sobe na tela). Trecho vazio vale 1 a partir do início.
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
 * Palco fixo (desktop): a frente ativa é a última cujo topo passou da metade da janela, ou a
 * primeira. A cena dela se monta enquanto a metade da janela percorre os primeiros 75% do bloco.
 * @param {{ topo: number, altura: number }[]} blocos blocos de texto das frentes, em ordem
 * @param {number} alturaJanela
 * @param {number[]} totais quantos passos tem cada cena
 * @returns {{ ativa: number, passo: number }}
 */
export function estadoFixo(blocos, alturaJanela, totais) {
  const linha = alturaJanela / 2;
  let ativa = 0;
  blocos.forEach((bloco, i) => {
    if (bloco.topo <= linha) ativa = i;
  });
  const { topo, altura } = blocos[ativa];
  return { ativa, passo: passoPorProgresso(progressoNoTrecho(topo, topo + 0.75 * altura, linha), totais[ativa]) };
}

/**
 * Cena embaixo do texto (celular, tablet e desktop baixo): ela se monta enquanto o próprio topo
 * sobe de 90% para 35% da altura da janela.
 * @param {{ topo: number }} cena
 * @param {number} alturaJanela
 * @param {number} total
 * @returns {number}
 */
export function passoLocal(cena, alturaJanela, total) {
  return passoPorProgresso(progressoNoTrecho(0.9 * alturaJanela, 0.35 * alturaJanela, cena.topo), total);
}
