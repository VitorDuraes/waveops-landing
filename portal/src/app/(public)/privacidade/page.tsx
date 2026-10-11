import type { Metadata } from "next";
import { LegalDoc } from "@/components/public/LegalDoc";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de Privacidade · WaveOps",
  description: "Como a WaveOps coleta, usa e protege dados pessoais, conforme a LGPD.",
};

// Política de Privacidade (LGPD). Rascunho adaptado à WaveOps com os operadores
// usados pelo portal. Revisar com advogado e preencher a razão social, o CNPJ e o
// encarregado (DPO) antes de considerar definitiva.
// Revisão factual de 11/10/2026: código diário relacionável aos dados de contato,
// tratado como dado pessoal. Não encerra a revisão H4. Mudou o texto, mude
// POLITICA_VERSAO em assets/site/config.js.
export default function PrivacidadePage() {
  return (
    <LegalDoc title="Política de Privacidade" updatedAt="11 de outubro de 2026">
      <p>
        Esta Política descreve como a <strong>{EMPRESA.razaoSocial}</strong> (CNPJ {EMPRESA.cnpj}), que opera a
        marca {EMPRESA.marca}, coleta, usa, compartilha e protege dados pessoais, em conformidade com a Lei
        Geral de Proteção de Dados (Lei nº 13.709/2018, &quot;LGPD&quot;). A {EMPRESA.marca} atua como
        controladora dos dados tratados na contratação e no uso dos seus serviços.
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> nome, e-mail, telefone/WhatsApp, CPF ou CNPJ e nome da empresa,
          informados no checkout e na ativação da conta.
        </li>
        <li>
          <strong>Dados de contato pelo site:</strong> no formulário de contato do site institucional
          (waveops.com.br), nome, empresa, e-mail, telefone ou WhatsApp, canal e horário preferidos para o
          retorno, assunto e mensagem; na lista de interesse da Plataforma, o e-mail. Junto, registramos a
          versão desta Política e dos textos de ciência e de consentimento exibidos, se você aceitou receber
          comunicações de marketing, a página do envio e a origem da visita (campanha e site de origem, sem
          os demais parâmetros do endereço).
        </li>
        <li>
          <strong>Dados de pagamento:</strong> processados diretamente pela Mercado Pago. A WaveOps recebe
          apenas o status e os identificadores da transação, nunca os dados do cartão.
        </li>
        <li>
          <strong>Dados do projeto:</strong> informações que você fornece sobre o que deseja automatizar
          (objetivo, ferramenta atual, dor e volume).
        </li>
        <li>
          <strong>Dados de uso e suporte:</strong> registros de acesso à conta, faturas, follow-ups e chamados.
        </li>
        <li>
          <strong>Dados de navegação:</strong> medição própria de funil, feita pela WaveOps no site e no
          portal, sem ferramenta de terceiro. Registramos o evento (visita, envio de formulário, clique no
          WhatsApp, abertura de checkout, pagamento, ativação), a página e a origem da visita. Para agrupar
          eventos ocorridos no mesmo dia, usamos um código derivado do seu IP e de informações do navegador.
          Esse código muda a cada dia. Se você enviar um formulário ou contratar um serviço, ele pode ficar
          associado aos seus dados de contato. Tratamos o código e os eventos associados como dados pessoais.
          Nos registros de contato, clientes e navegação, guardamos o código sem gravar o IP diretamente.
          Os registros de navegação são apagados após 180 dias. No site, a origem da visita fica guardada no
          armazenamento da sessão do
          navegador (sessionStorage), que é apagado quando você fecha a aba, para a mesma visita não ser
          contada duas vezes e para o formulário informar a campanha de origem.
        </li>
        <li>
          <strong>Publicidade:</strong> o site institucional e o portal não carregam o Meta Pixel nem outra
          ferramenta de publicidade ou rastreamento de terceiro.
        </li>
      </ul>

      <h2>2. Cookies</h2>
      <p>
        O portal usa apenas um cookie de sessão estritamente necessário, para manter o cliente autenticado após
        o login. Não usamos cookies de publicidade dentro do portal.
      </p>
      <p>
        O site institucional não grava cookies. A única informação que ele guarda no navegador é a origem da
        visita, no armazenamento da sessão, descrita no item 1.
      </p>

      <h2>3. Para que usamos os dados e com qual base legal</h2>
      <ul>
        <li>
          <strong>Prestar o serviço, cobrar e dar suporte:</strong> execução do contrato (art. 7º, V, da LGPD).
        </li>
        <li>
          <strong>Responder ao contato feito pelo site e avisar quando a Plataforma abrir</strong>, para quem
          entrou na lista de interesse: procedimentos preliminares a contrato, a pedido do titular (art. 7º, V).
        </li>
        <li>
          <strong>Enviar comunicações de marketing</strong>, só para quem marcou o aceite no formulário:
          consentimento (art. 7º, I), que pode ser revogado a qualquer momento. Antes do primeiro envio,
          confirmamos que o e-mail é de quem marcou o aceite.
        </li>
        <li>
          <strong>Enviar comunicações da conta</strong> (ativação, código de acesso, cobrança e avisos):
          execução do contrato.
        </li>
        <li>
          <strong>Cumprir obrigações legais e fiscais:</strong> cumprimento de obrigação legal (art. 7º, II).
        </li>
        <li>
          <strong>Prevenir fraudes e melhorar o serviço</strong> com métricas agregadas: legítimo interesse
          (art. 7º, IX).
        </li>
      </ul>

      <h2>4. Compartilhamento com terceiros</h2>
      <p>
        Compartilhamos dados apenas com prestadores necessários à operação, que tratam os dados conforme nossas
        instruções:
      </p>
      <ul>
        <li>
          <strong>Mercado Pago</strong>: processamento de pagamentos.
        </li>
        <li>
          <strong>Resend</strong>: envio de e-mails transacionais (ativação, código de acesso, cobrança).
        </li>
        <li>
          <strong>Railway</strong>: hospedagem do portal e do banco de dados, onde ficam os dados da conta e os
          contatos recebidos pelo site.
        </li>
        <li>
          <strong>Netlify</strong>: hospedagem do site institucional. Os formulários do site não passam pelo
          Netlify: vão direto para o portal.
        </li>
        <li>
          <strong>WaveOps CRM (Twenty)</strong>: gestão de clientes, quando ativo.
        </li>
        <li>
          <strong>Ferramentas internas da equipe</strong> (Discord): alertas operacionais sobre novos clientes,
          cobrança e novos contatos pelo site. O alerta de contato pelo site não leva dados pessoais.
        </li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <h2>5. Transferência internacional</h2>
      <p>
        Alguns prestadores (como Railway, Resend e Netlify) operam servidores fora do Brasil. Nesses casos, a
        transferência observa o art. 33 da LGPD e adota garantias contratuais e técnicas adequadas de proteção.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário para cumprir obrigações legais
        e fiscais (em regra, até 5 anos após o encerramento, para registros financeiros). Encerrado o
        tratamento, os dados são eliminados ou anonimizados.
      </p>
      <p>
        Contatos recebidos pelo site e inscrições na lista de interesse ficam guardados enquanto forem
        necessários para atender o pedido e acompanhar a conversa. Você pode pedir a exclusão a qualquer
        momento, pelo canal do item 8.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger os dados, como controle de acesso,
        criptografia de senhas e comunicação por canais seguros (HTTPS). Nenhum sistema é totalmente imune, mas
        trabalhamos para reduzir riscos de acesso não autorizado.
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        Como titular, você pode, a qualquer momento, solicitar: confirmação de tratamento, acesso, correção,
        anonimização ou eliminação de dados desnecessários, portabilidade, informação sobre com quem
        compartilhamos e revogação de consentimento. Para exercer, fale com a gente pelo WhatsApp{" "}
        <a href={EMPRESA.whatsappUrl} target="_blank" rel="noopener noreferrer">
          {EMPRESA.whatsapp}
        </a>
        . Clientes também podem pedir pela área do cliente.
      </p>

      <h2>9. Encarregado (DPO)</h2>
      <p>
        O encarregado pelo tratamento de dados da WaveOps atende pelo WhatsApp{" "}
        <a href={EMPRESA.whatsappUrl} target="_blank" rel="noopener noreferrer">
          {EMPRESA.whatsapp}
        </a>
        .
      </p>

      <h2>10. Alterações desta Política</h2>
      <p>
        Esta Política pode ser atualizada. Mudanças relevantes são comunicadas por e-mail ou na área do cliente,
        e a data de &quot;Última atualização&quot; no topo é revisada a cada versão.
      </p>
    </LegalDoc>
  );
}
