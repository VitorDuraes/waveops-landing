// Globais que os scripts do site expõem ou consomem no navegador.
export {};

declare global {
  interface Window {
    /** assets/funil.js: medição própria de funil (SPEC-18). */
    WaveFunil?: { enviar(nome: string, props?: Record<string, string | number | boolean>): void };
    /** Meta Pixel. Fica desligado no site novo até existir consentimento. */
    fbq?: (...args: unknown[]) => void;
  }
}
