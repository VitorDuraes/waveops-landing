// @ts-check
/* Comparação visual com o design aprovado. Ferramenta local: não roda no CI.

   Para cada página e largura (1440, 768 e 390, com a mesma densidade das capturas do
   design), tira a captura da página inteira e monta uma folha lado a lado: design à
   esquerda, implementação à direita. Imprime também a altura das duas, porque seção
   faltando ou sobrando aparece primeiro como diferença de altura.

   Uso (de tests/site):
     PW_CHANNEL=chrome node qa/visual.mjs [home solucoes ...]
   Variáveis: DESIGN_CAPTURAS (pasta com computador_1440/, tablet_768/, celular_390/)
   Saída: .tmp-qa/capturas/ e .tmp-qa/comparacao/ na raiz do repo. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { criarServidor } from '../../../dev/site/serve.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(aqui, '..', '..', '..');
const pastaDesign =
  process.env.DESIGN_CAPTURAS ??
  '';

/** @type {Record<string, { url: string, design: string }>} */
const PAGINAS = {
  home: { url: '/', design: '1_Home.png' },
  solucoes: { url: '/solucoes/', design: '2_Solucoes.png' },
  plataforma: { url: '/plataforma/', design: '3_Plataforma.png' },
  sobmedida: { url: '/projetos-sob-medida/', design: '4_Projetos_sob_medida.png' },
  contato: { url: '/contato/', design: '5_Contato.png' },
  demonstracoes: { url: '/demonstracoes-tecnicas/', design: '6_Demonstracoes_tecnicas.png' },
};

/* coluna: largura de cada lado na folha. Folha muito alta (acima de ~16 mil px) sai
   com faixas repetidas na captura do Chrome, então o celular usa coluna estreita e
   cada folha também é fatiada em pedaços de 1600 px de altura para leitura. */
const LARGURAS = [
  { pasta: 'computador_1440', largura: 1440, densidade: 1, coluna: 676 },
  { pasta: 'tablet_768', largura: 768, densidade: 1.5, coluna: 480 },
  { pasta: 'celular_390', largura: 390, densidade: 2, coluna: 360 },
];
const ALTURA_FATIA = 1600;

/** @param {string} arquivo */
function alturaPng(arquivo) {
  const cabecalho = fs.readFileSync(arquivo).subarray(16, 24);
  return { largura: cabecalho.readUInt32BE(0), altura: cabecalho.readUInt32BE(4) };
}

const pedidas = process.argv.slice(2).filter((a) => a in PAGINAS);
const alvos = pedidas.length ? pedidas : Object.keys(PAGINAS);
const saidaCapturas = path.join(raizRepo, '.tmp-qa', 'capturas');
const saidaComparacao = path.join(raizRepo, '.tmp-qa', 'comparacao');
fs.mkdirSync(saidaCapturas, { recursive: true });
fs.mkdirSync(saidaComparacao, { recursive: true });

const servidor = criarServidor({ raiz: raizRepo });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
const endereco = servidor.address();
const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

/** @type {string[]} */
const linhas = ['página | largura | design (px CSS) | implementação (px CSS) | diferença'];
try {
  for (const nome of alvos) {
    const pagina = PAGINAS[nome];
    for (const { pasta, largura, densidade, coluna } of LARGURAS) {
      // A captura sai em densidade 1: em 2x, uma página de celular passa dos 16384 px que
      // o Chrome consegue capturar de uma vez e a metade de baixo sai repetida. A altura em
      // px CSS não muda, e a folha reduz as duas imagens para a mesma largura de coluna.
      const contexto = await navegador.newContext({ viewport: { width: largura, height: 900 }, deviceScaleFactor: 1 });
      const aba = await contexto.newPage();
      const resposta = await aba.goto(`http://127.0.0.1:${porta}${pagina.url}`);
      if (!resposta || resposta.status() !== 200) {
        linhas.push(`${nome} | ${largura} | página não existe ainda`);
        await contexto.close();
        continue;
      }
      await aba.evaluate(() => document.fonts.ready);
      const captura = path.join(saidaCapturas, `${nome}-${largura}.png`);
      await aba.screenshot({ path: captura, fullPage: true });
      await contexto.close();

      const arquivoDesign = path.join(pastaDesign, pasta, pagina.design);
      const impl = alturaPng(captura);
      if (!fs.existsSync(arquivoDesign)) {
        linhas.push(`${nome} | ${largura} | sem captura de design | ${impl.altura} | n/a`);
        continue;
      }
      const design = alturaPng(arquivoDesign);
      const alturaDesign = Math.round(design.altura / densidade);
      const alturaImpl = impl.altura;
      const diferenca = (((alturaImpl - alturaDesign) / alturaDesign) * 100).toFixed(1);
      linhas.push(`${nome} | ${largura} | ${alturaDesign} | ${alturaImpl} | ${diferenca}%`);

      const larguraFolha = coluna * 2 + 48;
      const folha = await navegador.newContext({ viewport: { width: larguraFolha, height: 900 } });
      const abaFolha = await folha.newPage();
      const dataUrl = (/** @type {string} */ arquivo) => `data:image/png;base64,${fs.readFileSync(arquivo).toString('base64')}`;
      await abaFolha.setContent(`<!doctype html><html><body style="margin:0;background:#222;font:14px system-ui;color:#eee">
        <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
          <figure style="margin:0;width:${coluna}px"><figcaption>Design · ${nome} · ${largura}px</figcaption><img style="width:100%;display:block" src="${dataUrl(arquivoDesign)}"></figure>
          <figure style="margin:0;width:${coluna}px"><figcaption>Implementação · ${nome} · ${largura}px</figcaption><img style="width:100%;display:block" src="${dataUrl(captura)}"></figure>
        </div></body></html>`);
      await abaFolha.waitForLoadState('load');
      const alturaFolha = await abaFolha.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0, n = 1; y < alturaFolha; y += ALTURA_FATIA, n += 1) {
        await abaFolha.screenshot({
          path: path.join(saidaComparacao, `${nome}-${largura}-${String(n).padStart(2, '0')}.png`),
          clip: { x: 0, y, width: larguraFolha, height: Math.min(ALTURA_FATIA, alturaFolha - y) },
          fullPage: true,
        });
      }
      await folha.close();
    }
  }
} finally {
  await navegador.close();
  servidor.close();
}
console.log(linhas.join('\n'));
console.log(`\nfolhas em ${path.relative(raizRepo, saidaComparacao)}`);
