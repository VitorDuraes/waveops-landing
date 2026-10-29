import { test, expect, type Page, type Route } from '@playwright/test';

/* Jornadas do formulário de contato. O endpoint simulado do servidor local é
   interceptado aqui para cada teste decidir a resposta. O relógio da página é
   controlado (page.clock) para passar da trava anti-robô de 1,2 s e para testar o
   tempo limite de 12 s sem esperar 12 s de verdade. */

test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'tablet', 'formulário coberto em desktop e celular');
});

type Pedido = Record<string, unknown>;

async function abrir(page: Page) {
  await page.clock.install();
  const resposta = await page.goto('/contato/');
  test.skip(resposta?.status() === 404, 'contato/index.html ainda não existe');
  await expect(page.locator('#form-contato')).toBeVisible();
}

async function interceptar(page: Page, responder: (route: Route, n: number) => Promise<void> | void) {
  const pedidos: Pedido[] = [];
  await page.route('**/__dev/lead*', async (route) => {
    pedidos.push(JSON.parse(route.request().postData() ?? '{}'));
    await responder(route, pedidos.length);
  });
  return pedidos;
}

const ok = (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, protocolo: 'p-1' }) });

async function preencherMinimo(page: Page) {
  await page.getByLabel('Seu nome').fill('Ana Souza');
  await page.locator('#f-tel').fill('(34) 99177-5784');
  await page.locator('#f-politica').check();
}

test('envio feliz mostra a confirmação, foca o título e manda o contrato v2', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  const eventos: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/e')) eventos.push(r.postData() ?? '');
  });
  await preencherMinimo(page);
  await page.locator('#f-dor').selectOption('integracao');
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  const titulo = page.getByRole('heading', { name: 'Recebido, Ana.' });
  await expect(titulo).toBeVisible();
  await expect(titulo).toBeFocused();
  await expect(page.locator('#form-contato')).toBeHidden();
  expect(pedidos).toHaveLength(1);
  const corpo = pedidos[0];
  expect(corpo).toMatchObject({
    versaoContrato: 2,
    origem: 'contato',
    canalRetorno: 'whatsapp',
    telefone: '34991775784',
    whatsapp: '34991775784',
    dor: 'Ferramentas que não conversam',
    politicaCiente: true,
    marketingAceito: false,
    website: '',
    pagina: '/contato/',
  });
  for (const chave of ['idEnvio', 'enviadoEm', 'politicaVersao', 'politicaCienteEm', 'utm_source', 'landingUrl', 'primeiraFonte']) {
    expect(corpo).toHaveProperty(chave);
  }
  await expect.poll(() => eventos.some((e) => e.includes('"n":"lead_enviado"'))).toBe(true);
});

test('envio vazio mostra o resumo, marca os campos e foca o primeiro erro', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#contato-resumo')).toBeVisible();
  await expect(page.locator('#contato-resumo')).toContainText('Faltam 3 campos para enviar.');
  await expect(page.locator('#f-nome')).toBeFocused();
  await expect(page.locator('#f-nome')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#e-nome')).toHaveText('Informe o seu nome.');
  await expect(page.locator('#e-tel')).toBeVisible();
  await expect(page.locator('#e-politica')).toBeVisible();
  expect(pedidos).toHaveLength(0);
  await page.getByLabel('Seu nome').fill('Ana');
  await expect(page.locator('#e-nome')).toBeHidden();
});

test('o canal de retorno troca o que é obrigatório', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('E-mail', { exact: true }).check();
  await expect(page.locator('[data-tel-opcional]')).toBeVisible();
  await expect(page.locator('[data-email-opcional]')).toBeHidden();
  await expect(page.locator('[data-canal-dica]')).toHaveText('A gente responde no e-mail informado.');
  await page.getByLabel('Ligação').check();
  await expect(page.locator('[data-rotulo-tel]')).toHaveText('Telefone para ligação');
  await expect(page.getByLabel(/Melhor horário para ligar/)).toBeVisible();
  await page.getByLabel('WhatsApp', { exact: true }).check();
  await expect(page.getByLabel(/Melhor horário para ligar/)).toBeHidden();
});

test('falha do servidor preserva os dados, oferece WhatsApp e reenvia o mesmo idEnvio', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, (route, n) =>
    n === 1 ? route.fulfill({ status: 503, body: '{"ok":false}' }) : ok(route),
  );
  await preencherMinimo(page);
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#contato-falha')).toBeVisible();
  await expect(page.locator('#contato-falha')).toContainText('Não foi possível enviar agora.');
  await expect(page.locator('[data-falha-whatsapp]')).toBeVisible();
  await expect(page.getByLabel('Seu nome')).toHaveValue('Ana Souza');
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { name: 'Recebido, Ana.' })).toBeVisible();
  expect(pedidos).toHaveLength(2);
  expect(pedidos[1].idEnvio).toBe(pedidos[0].idEnvio);
});

test('sem resposta em 12 s, o envio cai no estado de falha', async ({ page }) => {
  await abrir(page);
  await interceptar(page, () => new Promise<void>(() => {}));
  await preencherMinimo(page);
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByRole('button', { name: 'Enviando…' })).toHaveAttribute('aria-disabled', 'true');
  await page.clock.fastForward(12500);
  await expect(page.locator('#contato-falha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
});

test('duplo clique gera um envio só', async ({ page }) => {
  await abrir(page);
  let liberar: () => void = () => {};
  const pedidos = await interceptar(page, (route) => new Promise<void>((r) => { liberar = () => { void ok(route).then(r); }; }));
  await preencherMinimo(page);
  await page.clock.fastForward(2000);
  const botao = page.getByRole('button', { name: 'Enviar pedido' });
  await botao.click();
  await page.locator('[data-botao-enviar]').click({ force: true });
  await expect.poll(() => pedidos.length).toBe(1);
  liberar();
  await expect(page.getByRole('heading', { name: 'Recebido, Ana.' })).toBeVisible();
  expect(pedidos).toHaveLength(1);
});

test('robô que preenche o honeypot vê a confirmação e nada é enviado', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await preencherMinimo(page);
  await page.locator('#f-website').evaluate((el: HTMLInputElement) => { el.value = 'http://spam.example'; });
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Recebido, Ana.' })).toBeVisible();
  expect(pedidos).toHaveLength(0);
});

test('"Enviar outro pedido" volta ao formulário vazio com foco no nome', async ({ page }) => {
  await abrir(page);
  await interceptar(page, ok);
  await preencherMinimo(page);
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await page.getByRole('button', { name: 'Enviar outro pedido' }).click();
  await expect(page.locator('#form-contato')).toBeVisible();
  await expect(page.getByLabel('Seu nome')).toHaveValue('');
  await expect(page.getByLabel('Seu nome')).toBeFocused();
  await expect(page.getByLabel('Seu nome')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#e-nome')).toBeHidden();
  await expect(page.locator('#e-tel')).toBeHidden();
  await expect(page.locator('#contato-resumo')).toBeHidden();
});

test('teclado: dá para preencher e enviar só com Tab, Espaço e Enter', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await page.getByLabel('Seu nome').focus();
  await page.keyboard.type('Ana Souza');
  await page.locator('#f-tel').focus();
  await page.keyboard.type('34991775784');
  await page.locator('#f-politica').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#f-politica')).toBeChecked();
  await page.clock.fastForward(2000);
  await page.locator('[data-botao-enviar]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Recebido, Ana.' })).toBeVisible();
  expect(pedidos).toHaveLength(1);
});

test('falha do servidor não dispara lead_enviado', async ({ page }) => {
  await abrir(page);
  await interceptar(page, (route) => route.fulfill({ status: 503, body: '' }));
  const eventos: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/e')) eventos.push(r.postData() ?? '');
  });
  await preencherMinimo(page);
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#contato-falha')).toBeVisible();
  expect(eventos.some((e) => e.includes('lead_enviado'))).toBe(false);
});

test('envio antes de 1,2 s é tratado como robô e não sai', async ({ page }) => {
  // A entrada em cascata do hero (spec 15.3) move o cartão do formulário por até 850 ms, e o Playwright
  // espera o campo parar antes de preencher. Com menos movimento o cartão nasce no lugar e o teste
  // preenche na hora, como um robô que não espera nada.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await preencherMinimo(page);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Recebido, Ana.' })).toBeVisible();
  expect(pedidos).toHaveLength(0);
});

test('recusa 422 do servidor marca o campo, sem cair no estado de falha', async ({ page }) => {
  await abrir(page);
  await interceptar(page, (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, erro: 'validacao', campos: ['telefone'] }) }),
  );
  await preencherMinimo(page);
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#e-tel')).toBeVisible();
  await expect(page.locator('#f-tel')).toBeFocused();
  await expect(page.locator('#contato-falha')).toBeHidden();
});

test('a mensagem de erro só descreve o campo enquanto aparece', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('#f-nome')).not.toHaveAttribute('aria-describedby', /e-nome/);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#f-nome')).toHaveAttribute('aria-describedby', /e-nome/);
  await page.getByLabel('Seu nome').fill('Ana');
  await expect(page.locator('#f-nome')).not.toHaveAttribute('aria-describedby', /e-nome/);
});

test('se o módulo de envio não carregar, nada é enviado e nenhum dado vai para a URL', async ({ page }) => {
  await page.route('**/assets/site/lib/enviar.js*', (rota) => rota.abort());
  const resposta = await page.goto('/contato/');
  expect(resposta?.status()).toBe(200);
  await page.getByLabel('Seu nome').fill('Maria Teste');
  await page.locator('#f-tel').fill('34991234567');
  await page.locator('#f-politica').check();
  await expect(page.locator('[data-botao-enviar]')).toBeDisabled();
  await page.locator('#f-tel').press('Enter');
  await page.waitForTimeout(300);
  expect(page.url()).not.toContain('?');
  expect(page.url()).not.toContain('Maria');
});
