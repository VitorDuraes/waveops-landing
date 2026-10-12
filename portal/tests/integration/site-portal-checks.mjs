import assert from 'node:assert/strict';

const itens = (valor) => (valor ?? '').toLowerCase().split(',').map((item) => item.trim());

export function verificarPrismaSemEnv(caminhos) {
  assert.ok(caminhos && typeof caminhos === 'object' && !Array.isArray(caminhos));
  assert.ok(Object.values(caminhos).every((valor) => valor === null || valor === undefined),
    'O Prisma usado no teste não pode carregar .env do checkout original.');
}

export function verificarPreflight(resposta, origem) {
  assert.equal(resposta.status, 204);
  assert.equal(resposta.headers.get('access-control-allow-origin'), origem);
  const metodos = itens(resposta.headers.get('access-control-allow-methods'));
  assert.ok(metodos.includes('post') && metodos.includes('options'), 'Preflight sem POST e OPTIONS.');
  assert.ok(itens(resposta.headers.get('access-control-allow-headers')).includes('content-type'),
    'Preflight não permite o Content-Type usado pelo site.');
}

export function verificarRespostaPublica(resposta, origem) {
  assert.equal(resposta.headers.get('access-control-allow-origin'), origem, 'Resposta pública sem CORS.');
  assert.ok(itens(resposta.headers.get('vary')).includes('origin'));
  assert.equal(resposta.headers.get('cache-control'), 'no-store');
}

function texto(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function verificarFunilRenderizado(html, valores) {
  const visivel = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const rotulos = [...visivel.matchAll(/<div\s+class="flabel"[^>]*>([\s\S]*?)<\/div>/g)];
  for (const valor of valores) {
    const indice = rotulos.findIndex((match) => texto(match[1]) === valor.rotulo);
    assert.ok(indice >= 0, `Rótulo ausente: ${valor.rotulo}.`);
    const atual = rotulos[indice];
    const trecho = visivel.slice(atual.index + atual[0].length, rotulos[indice + 1]?.index ?? visivel.length);
    const contador = trecho.match(/<div class="(?:fqtd|fv)"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(contador, `Contagem ausente: ${valor.rotulo}.`);
    assert.equal(texto(contador[1]).split('·')[0].trim(), valor.visitantes.toLocaleString('pt-BR'),
      `Contagem incorreta: ${valor.rotulo}.`);
    if (valor.eventos !== undefined) {
      const eventos = trecho.match(/<div class="fsub"[^>]*>([\s\S]*?)<\/div>/);
      assert.ok(eventos, `Quantidade de eventos ausente: ${valor.rotulo}.`);
      assert.equal(texto(eventos[1]), `${valor.eventos.toLocaleString('pt-BR')} ${valor.eventos === 1 ? 'evento' : 'eventos'}`);
    }
  }
}

export function encerrarContainerProprio(nome, execucao, chamarDocker) {
  assert.match(nome, /^waveops-h5-[a-z0-9-]+$/);
  const consulta = chamarDocker(['inspect', '--format', '{{json .Config.Labels}}', nome]);
  if (consulta.error) throw consulta.error;
  if (consulta.status !== 0) {
    const ausente = (consulta.stderr ?? '').trim().match(/^(?:Error response from daemon: |Error: )?No such (?:object|container): ([a-z0-9-]+)$/);
    if (ausente?.[1] === nome) return;
    throw new Error(`Não foi possível conferir o contêiner próprio: ${consulta.stderr}`);
  }
  const etiquetas = JSON.parse(consulta.stdout);
  assert.equal(etiquetas['com.waveops.qa'], 'h5-local', 'Recusada limpeza de contêiner fora da suíte.');
  assert.equal(etiquetas['com.waveops.qa.run'], execucao, 'Recusada limpeza de contêiner de outra execução.');
  const parada = chamarDocker(['stop', '--time', '2', nome]);
  if (parada.error) throw parada.error;
  assert.equal(parada.status, 0, `Falha ao encerrar o contêiner próprio: ${parada.stderr}`);
}

export async function encerrarProcessoProprio(filho, { plataforma = process.platform, prazoMs = 2000, terminarArvore } = {}) {
  if (!filho?.pid || filho.exitCode !== null || filho.signalCode !== null) return;
  if (plataforma === 'win32') {
    assert.equal(typeof terminarArvore, 'function');
    terminarArvore(filho.pid);
    return;
  }
  async function saiuNoPrazo() {
    if (filho.exitCode !== null || filho.signalCode !== null) return true;
    return new Promise((resolve) => {
      const aoSair = () => { clearTimeout(relogio); resolve(true); };
      const relogio = setTimeout(() => { filho.off('exit', aoSair); resolve(false); }, prazoMs);
      filho.once('exit', aoSair);
    });
  }
  filho.kill('SIGTERM');
  if (await saiuNoPrazo()) return;
  filho.kill('SIGKILL');
  assert.equal(await saiuNoPrazo(), true, 'O processo próprio não encerrou dentro do prazo.');
}
