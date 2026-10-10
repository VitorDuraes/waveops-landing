import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Testes de navegador do site institucional.

   Variáveis opcionais:
     PW_CHANNEL=chrome   usa o Chrome instalado na máquina em vez do Chromium do Playwright
     SITE_RAIZ=.tmp-site serve o build simulado do Netlify (caminho a partir da raiz do repo)
     SITE_PORTA=4321     porta do servidor local

   Os três projetos batem com as larguras das capturas do design aprovado. */
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(aqui, '..', '..');
const porta = Number(process.env.SITE_PORTA ?? 4321);
const raizServida = path.resolve(raizRepo, process.env.SITE_RAIZ ?? '.');
const canal = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${porta}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: canal },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, channel: canal },
    },
    {
      name: 'celular',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, channel: canal },
    },
  ],
  webServer: {
    command: `node "${path.join(raizRepo, 'dev', 'site', 'serve.mjs')}" --port ${porta} --root "${raizServida}"`,
    url: `http://127.0.0.1:${porta}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
