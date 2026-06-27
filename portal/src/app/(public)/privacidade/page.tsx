import type { Metadata } from "next";
import { LegalDoc } from "@/components/public/LegalDoc";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de Privacidade · WaveOps",
  description: "Como a WaveOps coleta, usa e protege dados pessoais, conforme a LGPD.",
};

// Politica de Privacidade (LGPD). Rascunho adaptado a WaveOps com os sub-processadores
// reais usados pelo portal. Revisar com advogado e preencher a razao social, o CNPJ e o
// encarregado (DPO) antes de considerar definitiva.
export default function PrivacidadePage() {
  return (
    <LegalDoc title="Política de Privacidade" updatedAt="26 de junho de 2026">
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
          <strong>Dados de navegação:</strong> métricas agregadas e anônimas de visita ao site, via Plausible
          Analytics, que não usa cookies nem identifica pessoas.
        </li>
      </ul>

      <h2>2. Cookies</h2>
      <p>
        O portal usa apenas um cookie de sessão estritamente necessário, para manter o cliente autenticado após
        o login. Não usamos cookies de publicidade ou de rastreamento entre sites.
      </p>

      <h2>3. Para que usamos os dados e com qual base legal</h2>
      <ul>
        <li>
          <strong>Prestar o serviço, cobrar e dar suporte:</strong> execução do contrato (art. 7º, V, da LGPD).
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
          <strong>Supabase</strong>: banco de dados que armazena os dados da conta.
        </li>
        <li>
          <strong>Netlify</strong>: hospedagem da aplicação.
        </li>
        <li>
          <strong>WaveOps CRM (Twenty)</strong>: gestão de clientes, quando ativo.
        </li>
        <li>
          <strong>Ferramentas internas da equipe</strong> (Discord): alertas operacionais sobre novos clientes
          e cobrança.
        </li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <h2>5. Transferência internacional</h2>
      <p>
        Alguns prestadores (como Resend e Netlify) operam servidores fora do Brasil. Nesses casos, a
        transferência observa o art. 33 da LGPD e adota garantias contratuais e técnicas adequadas de proteção.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário para cumprir obrigações legais
        e fiscais (em regra, até 5 anos após o encerramento, para registros financeiros). Encerrado o
        tratamento, os dados são eliminados ou anonimizados.
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
        compartilhamos e revogação de consentimento. Para exercer, escreva para{" "}
        <a href="mailto:contato@waveops.com.br">contato@waveops.com.br</a>.
      </p>

      <h2>9. Encarregado (DPO)</h2>
      <p>
        O contato do encarregado pelo tratamento de dados da WaveOps é{" "}
        <a href="mailto:contato@waveops.com.br">contato@waveops.com.br</a>.
      </p>

      <h2>10. Alterações desta Política</h2>
      <p>
        Esta Política pode ser atualizada. Mudanças relevantes são comunicadas por e-mail ou na área do cliente,
        e a data de &quot;Última atualização&quot; no topo é revisada a cada versão.
      </p>
    </LegalDoc>
  );
}
