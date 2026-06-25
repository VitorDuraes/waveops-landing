# WaveOps Portal — V2

Junho de 2026. Resumo das mudanças desta versão. A V2 amadurece o pós-venda: onboarding do cliente, proteção comercial da oferta, suporte enxuto e integração com o CRM próprio.

## 1. Onboarding pós-pagamento

- Pagamento confirmado dispara o e-mail de ativação da conta. O cliente entra com o e-mail da compra, recebe um código e cria a senha.
- No mesmo momento, a equipe é avisada (Discord e e-mail) com os dados do cliente e um link de WhatsApp já preenchido, para o primeiro contato ser pessoal. Ainda não há disparo automático ao cliente: o contato é manual, por escolha.
- Na primeira visita à área do cliente, um formulário de briefing capta o projeto: o que automatizar, ferramenta atual, dor principal e volume. O briefing fica visível para a equipe no painel do admin.

## 2. Proteção comercial da página de planos

- Promessas amplas demais saíram. O termo "ilimitado" foi removido; o plano Empresarial passou a "automações, sistemas e agentes dimensionados com você".
- "Conserto quando a API quebra" virou "Conserto das integrações ativas".
- O bloco de conserto agora delimita o escopo: a correção está inclusa quando uma API que mantemos muda. Reconstruções grandes ou integrações novas entram como projeto à parte.
- Nova linha de transparência abaixo dos planos: "Escopo, volume e prazos de cada plano são combinados na ativação."
- A comparação de preço deixou de citar "o custo de 1 contratação" e passou a "custa menos que manter essa tarefa no manual".

## 3. Suporte

- O cliente fala com a empresa somente pelo WhatsApp. A abertura de chamado pelo portal foi removida.
- Upgrade e cancelamento de plano também passam pelo WhatsApp.
- Os chamados viraram ferramenta interna: o admin registra e acompanha cada chamado dentro do detalhe do cliente.

## 4. CRM próprio (Twenty) no lugar do Trello

- Toda a sincronização migrou do Trello para o WaveOps CRM (Twenty): empresa, contato, chamado, assinatura, fatura e follow-up.
- Quando o cliente escolhe um plano e paga, abre-se uma oportunidade no pipeline do CRM. Isso acontece apenas no primeiro pagamento; a mensalidade recorrente não cria oportunidade nova.
- O briefing do projeto e a pausa por inadimplência também passaram a registrar no CRM.

## 5. Painel do admin

- A busca de clientes passou a funcionar: por nome, empresa, e-mail, documento ou telefone, combinada com os filtros de status.

## Decisões de infraestrutura

- Hospedagem recomendada: Railway, cerca de US$ 5 por mês. Roda o aplicativo, o banco, o agendamento de cobrança e o webhook em um só lugar, sem a restrição de uso não comercial do plano gratuito da Vercel.
- Enquanto não houver clientes pagantes, a operação roda em ambiente local e a venda acontece pelo WhatsApp, com link de pagamento gerado no painel do Mercado Pago.

## Qualidade

- Verificação de tipos (TypeScript) sem erros e testes de ponta a ponta (Playwright) passando.
- Nenhum segredo versionado no repositório. As credenciais ficam apenas nos arquivos de ambiente locais.
