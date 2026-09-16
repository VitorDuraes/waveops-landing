// Deteccao de robo por user-agent, para a medicao de funil.
//
// Por que no SERVIDOR e nao no beacon: assets/funil.js e codigo publico e o robo
// escolhe se roda. A decisao de contar ou nao contar tem que ficar do nosso lado.
//
// Por que DESCARTAR em vez de marcar: linha de robo guardada "para filtrar depois"
// vira decisao errada mais tarde, quando alguem esquecer o filtro. O numero na tela
// precisa ser gente.
//
// O que isso NAO resolve: robo que se disfarca de Chrome. Nenhuma lista resolve. A
// lista cobre o caso comum, que e robo honesto se identificando, e e o que mais
// polui: Googlebot executa JavaScript e dispararia visita igual a uma pessoa.

const PADRAO =
  /(bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discordbot|slackbot|preview|monitor|uptime|pingdom|lighthouse|headless|phantom|puppeteer|playwright|curl|wget|python-requests|axios|node-fetch|postman|go-http|java\/|okhttp|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity|applebot)/i;

export function ehRobo(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // navegador de verdade sempre manda user-agent
  return PADRAO.test(userAgent);
}
