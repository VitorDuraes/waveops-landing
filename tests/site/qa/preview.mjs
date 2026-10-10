// @ts-check
/* Verificação de um site publicado que NÃO é produção (Deploy Preview do Netlify).
   Ferramenta local: não roda no CI.

   Para cada página de dev/site/paginas.json, nas três larguras do design: status, erro
   de console, rolagem horizontal, axe (sério ou crítico) e todo pedido de rede que sai
   da origem do preview (o esperado é nenhum). Depois: links internos e âncoras,
   cabeçalhos (X-Robots-Tag com noindex e os de segurança), os 301 do portal sem seguir
   o redirecionamento, a página 404, as âncoras da página única antiga, o menu do
   celular e os dois formulários, que precisam mostrar "Envio desligado" sem mandar
   pedido nenhum.

   Recusa rodar em waveops.com.br: lá o envio dos formulários é de verdade.

   Uso (de tests/site):
     SITE_URL=https://deploy-preview-73--waveops.netlify.app PW_CHANNEL=chrome node qa/preview.mjs
   Saída: resumo no terminal e .tmp-qa/preview/resultado.json na raiz do repo. Sai com
   código 1 se alguma conferência falhar. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { lerPaginas } from '../../../dev/site/build.mjs';
import { destinoLegado } from '../../../assets/site/lib/legado.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(aqui, '..', '..', '..');
const base = (process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!base) {
  console.error('defina SITE_URL com o endereço do Deploy Preview');
  process.exit(2);
}
const { origin: origem, hostname } = new URL(base);
if (/^(www\.)?waveops\.com\.br$/.test(hostname.toLowerCase().replace(/\.$/, ''))) {
  console.error('recusado: este roteiro envia formulário e só roda fora de produção');
  process.exit(2);
}

const LARGURAS = [
  { nome: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { nome: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: false },
  { nome: 'celular', viewport: { width: 390, height: 844 }, isMobile: true },
];
const ANCORAS_ANTIGAS = ['#contato', '#pacotes', '#servicos', '#casos', '#como', '#faq', '#publicos', '#operacao'];
const PORTAL = 'https://portal.waveops.com.br';
const REDIRECTS = [
  ['/cliente/login', `${PORTAL}/cliente/login`],
  ['/admin/', `${PORTAL}/admin/`],
  ['/checkout', `${PORTAL}/checkout`],
  ['/api/e', `${PORTAL}/api/e`],
  ['/termos', `${PORTAL}/termos`],
  ['/privacidade', `${PORTAL}/privacidade`],
  ['/solucoes', '/solucoes/'],
];

/** @type {string[]} */
const falhas = [];
/** @param {boolean} ok @param {string} texto */
const conferir = (ok, texto) => {
  if (!ok) falhas.push(texto);
  return ok;
};

/** @type {Record<string, unknown>} */
const resultado = { base, quando: new Date().toISOString() };
const paginas = /** @type {{ id: string, url: string, indexavel?: boolean }[]} */ (lerPaginas(raizRepo).paginas).filter(
  (p) => p.indexavel !== false,
);
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

/** Abre uma aba que registra erro de console e bloqueia (e registra) todo pedido para fora da origem do preview. */
async function abrir(/** @type {typeof LARGURAS[number]} */ largura) {
  const contexto = await navegador.newContext({ viewport: largura.viewport, isMobile: largura.isMobile, hasTouch: largura.isMobile });
  /** @type {string[]} */
  const erros = [];
  /** @type {string[]} */
  const fora = [];
  // Bloquear, e não só registrar: se algum código mandar algo para produção, o pedido morre aqui.
  await contexto.route('**/*', (rota) => {
    const url = rota.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origem) return rota.continue();
    fora.push(`${rota.request().method()} ${url}`);
    return rota.abort('blockedbyclient');
  });
  const aba = await contexto.newPage();
  aba.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text().slice(0, 160));
  });
  aba.on('pageerror', (e) => erros.push(e.message.slice(0, 160)));
  return { contexto, aba, erros, fora };
}

try {
  // 1. Páginas nas três larguras.
  /** @type {Record<string, unknown>[]} */
  const porPagina = [];
  /** @type {Set<string>} */
  const links = new Set();
  for (const pagina of paginas) {
    for (const largura of LARGURAS) {
      const { contexto, aba, erros, fora } = await abrir(largura);
      const resposta = await aba.goto(base + pagina.url, { waitUntil: 'networkidle' });
      const status = resposta?.status() ?? 0;
      const transborda = await aba.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const axe = await new AxeBuilder({ page: aba }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
      if (largura.nome === 'desktop') {
        for (const href of await aba.$$eval('a[href]', (as) => as.map((a) => /** @type {HTMLAnchorElement} */ (a).href))) links.add(href);
      }
      const rotulo = `${pagina.url} ${largura.nome}`;
      conferir(status === 200, `${rotulo}: status ${status}`);
      conferir(!transborda, `${rotulo}: rolagem horizontal`);
      conferir(erros.length === 0, `${rotulo}: erro de console ${erros.join(' | ')}`);
      conferir(graves.length === 0, `${rotulo}: axe ${graves.join(', ')}`);
      conferir(fora.length === 0, `${rotulo}: pedido fora do preview ${fora.join(' | ')}`);
      porPagina.push({ pagina: pagina.url, largura: largura.nome, status, transborda, erros, axeGraves: graves, foraDoPreview: fora });
      await contexto.close();
    }
  }
  resultado.paginas = porPagina;

  // 2. Links internos e âncoras. Externos só são listados, nunca chamados.
  /** @type {Map<string, string>} */
  const htmlPorCaminho = new Map();
  /** @type {Record<string, unknown>[]} */
  const conferidos = [];
  /** @type {Set<string>} */
  const externos = new Set();
  for (const href of links) {
    const url = new URL(href);
    if (url.origin !== origem) {
      if (url.protocol.startsWith('http')) externos.add(url.origin + url.pathname);
      continue;
    }
    if (!htmlPorCaminho.has(url.pathname)) {
      const r = await fetch(origem + url.pathname);
      htmlPorCaminho.set(url.pathname, r.ok ? await r.text() : `__status_${r.status}`);
    }
    const html = /** @type {string} */ (htmlPorCaminho.get(url.pathname));
    const existe = !html.startsWith('__status_');
    const ancoraOk = !url.hash || html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`);
    conferir(existe, `link ${url.pathname}: ${html}`);
    conferir(ancoraOk, `âncora ${url.pathname}${url.hash} não existe`);
    conferidos.push({ link: url.pathname + url.hash, existe, ancoraOk });
  }
  resultado.links = { internos: conferidos.length, externos: [...externos].sort() };

  // 3. Cabeçalhos de cada página.
  /** @type {Record<string, unknown>[]} */
  const cabecalhos = [];
  for (const pagina of paginas) {
    const r = await fetch(base + pagina.url);
    const h = Object.fromEntries(['x-robots-tag', 'x-frame-options', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security'].map((k) => [k, r.headers.get(k) ?? '']));
    conferir(/noindex/i.test(h['x-robots-tag']), `${pagina.url}: sem X-Robots-Tag noindex`);
    conferir(h['x-frame-options'] === 'DENY', `${pagina.url}: X-Frame-Options ${h['x-frame-options']}`);
    conferir(/frame-ancestors 'none'/.test(h['content-security-policy']), `${pagina.url}: sem frame-ancestors`);
    conferir(h['x-content-type-options'] === 'nosniff', `${pagina.url}: sem nosniff`);
    cabecalhos.push({ pagina: pagina.url, ...h });
  }
  resultado.cabecalhos = cabecalhos;

  // 4. Redirects sem seguir, 404, robots e sitemap.
  /** @type {Record<string, unknown>[]} */
  const redirects = [];
  for (const [de, para] of REDIRECTS) {
    const r = await fetch(base + de, { redirect: 'manual' });
    const destino = r.headers.get('location') ?? '';
    const ok = r.status === 301 && (destino === para || destino === origem + para);
    conferir(ok, `redirect ${de}: ${r.status} para ${destino}`);
    redirects.push({ de, status: r.status, destino });
  }
  const r404 = await fetch(`${base}/rota-que-nao-existe/`);
  const html404 = await r404.text();
  conferir(r404.status === 404 && /noindex/.test(html404), `404: status ${r404.status}`);
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  const sitemap = await fetch(`${base}/sitemap.xml`);
  conferir(/Allow: \//.test(robots) && /Sitemap:/.test(robots), 'robots.txt diferente do esperado');
  conferir(sitemap.status === 200, `sitemap.xml: status ${sitemap.status}`);
  resultado.redirects = redirects;
  resultado.erro404 = r404.status;

  // 5. Âncoras da página única antiga.
  /** @type {Record<string, unknown>[]} */
  const legado = [];
  for (const ancora of ANCORAS_ANTIGAS) {
    const { contexto, aba } = await abrir(LARGURAS[0]);
    const esperado = destinoLegado(ancora);
    await aba.goto(`${base}/${ancora}`);
    let ok = false;
    try {
      await aba.waitForURL((u) => u.pathname + u.hash === esperado, { timeout: 8000 });
      ok = true;
    } catch {
      /* fica falso */
    }
    conferir(ok, `âncora antiga ${ancora} não levou a ${esperado} (ficou em ${aba.url()})`);
    legado.push({ ancora, esperado, chegou: aba.url().replace(origem, '') });
    await contexto.close();
  }
  resultado.legado = legado;

  // 6. Menu do celular.
  {
    const { contexto, aba, erros } = await abrir(LARGURAS[2]);
    await aba.goto(`${base}/`, { waitUntil: 'networkidle' });
    const botao = aba.locator('[aria-controls="menu-movel"]');
    await botao.click();
    const abriu = await aba.locator('#menu-movel').isVisible();
    const itens = await aba.locator('#menu-movel a').count();
    await aba.keyboard.press('Escape');
    const fechou = await aba.locator('#menu-movel').isHidden();
    const focoVoltou = await botao.evaluate((b) => b === document.activeElement);
    conferir(abriu && itens > 0 && fechou && focoVoltou && erros.length === 0, `menu do celular: abriu ${abriu}, itens ${itens}, fechou ${fechou}, foco ${focoVoltou}`);
    resultado.menu = { abriu, itens, fechou, focoVoltou };
    await contexto.close();
  }

  // 7. Formulários: precisam recusar o envio no preview, sem pedido nenhum.
  /** @type {Record<string, unknown>[]} */
  const formularios = [];
  {
    const { contexto, aba, fora } = await abrir(LARGURAS[0]);
    await aba.goto(`${base}/contato/`, { waitUntil: 'networkidle' });
    const antes = fora.length;
    await aba.fill('#f-nome', 'TESTE Preview');
    await aba.fill('#f-tel', '34900000000');
    await aba.check('#f-politica');
    await aba.waitForTimeout(1600);
    await aba.locator('[data-form-contato] [data-botao-enviar]').click();
    const aviso = aba.getByText('Envio desligado neste ambiente de teste.');
    const desligado = await aviso.isVisible({ timeout: 5000 }).catch(() => false);
    await aba.waitForTimeout(1500);
    const pedidos = fora.slice(antes);
    conferir(desligado && pedidos.length === 0, `contato: aviso ${desligado}, pedidos ${pedidos.join(' | ')}`);
    formularios.push({ formulario: 'contato', avisoDesligado: desligado, pedidosForaDoPreview: pedidos });
    await contexto.close();
  }
  {
    const { contexto, aba, fora } = await abrir(LARGURAS[0]);
    await aba.goto(`${base}/plataforma/`, { waitUntil: 'networkidle' });
    const antes = fora.length;
    await aba.fill('#pl-email', 'teste.preview@example.com');
    await aba.check('#pl-politica');
    await aba.waitForTimeout(1600);
    await aba.locator('[data-form-interesse] [data-botao-enviar]').click();
    const aviso = aba.getByText('Envio desligado neste ambiente de teste.');
    const desligado = await aviso.isVisible({ timeout: 5000 }).catch(() => false);
    await aba.waitForTimeout(1500);
    const pedidos = fora.slice(antes);
    conferir(desligado && pedidos.length === 0, `lista de interesse: aviso ${desligado}, pedidos ${pedidos.join(' | ')}`);
    formularios.push({ formulario: 'interesse', avisoDesligado: desligado, pedidosForaDoPreview: pedidos });
    await contexto.close();
  }
  resultado.formularios = formularios;
} finally {
  await navegador.close();
}

resultado.falhas = falhas;
const saida = path.join(raizRepo, '.tmp-qa', 'preview');
fs.mkdirSync(saida, { recursive: true });
fs.writeFileSync(path.join(saida, 'resultado.json'), JSON.stringify(resultado, null, 2));
console.log(`preview: ${base}`);
console.log(`páginas x larguras: ${/** @type {unknown[]} */ (resultado.paginas).length}; links internos conferidos: ${/** @type {{ internos: number }} */ (resultado.links).internos}`);
console.log(`falhas: ${falhas.length}`);
for (const f of falhas) console.log(`  ${f}`);
console.log(`detalhe em ${path.relative(raizRepo, path.join(saida, 'resultado.json'))}`);
process.exit(falhas.length ? 1 : 0);
