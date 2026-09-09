/* WaveOps: energia de scroll suavizada, para alimentar o campo de partículas do hero.

   Puro de propósito: recebe o leitor de posição por injeção, então roda em node
   sem DOM e é verificável sem navegador. */

/**
 * @param {object} opts
 * @param {() => number} opts.getY leitor da posição de scroll em pixels.
 * @param {number} [opts.decay] fator de decaimento por frame, entre 0 e 1.
 * @param {number} [opts.scale] pixels de deslocamento que saturam a energia.
 */
export function createScrollSignal({ getY, decay = 0.88, scale = 0.045 }) {
  let last = getY();
  let energy = 0;
  let direction = 0;

  return {
    get energy() {
      return energy;
    },
    get direction() {
      return direction;
    },
    sample() {
      const now = getY();
      const delta = now - last;
      last = now;

      if (delta !== 0) direction = delta > 0 ? 1 : -1;

      // Magnitude normalizada, saturada em 1.
      const impulse = Math.min(1, Math.abs(delta) * scale);
      // Sobe rápido no impulso, desce devagar no decaimento.
      energy = Math.max(impulse, energy * decay);
      if (energy < 1e-4) {
        energy = 0;
        direction = 0;
      }
      return energy;
    },
  };
}
