import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* axe em toda página, nas três larguras: zero violação séria ou crítica das regras
   WCAG 2.0, 2.1 e 2.2 nível A e AA. Violação moderada ou menor sai no anexo do teste
   para revisão, sem reprovar. */
for (const pagina of paginasJson.paginas) {
  test(`${pagina.url} sem violação séria ou crítica de acessibilidade`, async ({ page }, info) => {
    const resposta = await page.goto(pagina.url);
    test.skip(resposta?.status() === 404 && pagina.indexavel !== false, `${pagina.arquivo} ainda não existe`);
    await page.evaluate(() => document.fonts.ready);
    // Na primeira página da visita a entrada do site (Tarefa 13B, teste próprio em chegada.spec.ts)
    // recomeça a cascata quando o portal abre: espera a entrada acabar antes de pegar as animações.
    await page.waitForFunction(() => [undefined, 'feita'].includes(document.documentElement.dataset.chegada));
    // A entrada em cascata do hero (spec 15.3) acaba antes de 1 s: o axe mede a página já no lugar,
    // não um bloco no meio do esmaecimento.
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((animacao) => (animacao as CSSAnimation).animationName === 'wo-entrada')
      .map((animacao) => animacao.finished.catch(() => undefined))));
    const resultado = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const leves = resultado.violations.filter((v) => !graves.includes(v));
    if (leves.length) {
      await info.attach('violacoes-leves.json', { body: JSON.stringify(leves.map((v) => ({ id: v.id, impacto: v.impact, alvos: v.nodes.map((n) => n.target) })), null, 2), contentType: 'application/json' });
    }
    expect(
      graves.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}
