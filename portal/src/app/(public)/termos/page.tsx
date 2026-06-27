import type { Metadata } from "next";
import { LegalDoc } from "@/components/public/LegalDoc";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Termos de Uso · WaveOps",
  description: "Termos de Uso dos serviços de automação, desenvolvimento e IA da WaveOps.",
};

// Termos de Uso. Rascunho juridico adaptado a WaveOps (assinatura mensal, add-ons,
// infra por conta da WaveOps, arrependimento de 7 dias). Revisar com advogado e
// preencher a razao social e o CNPJ antes de considerar definitivo.
export default function TermosPage() {
  return (
    <LegalDoc title="Termos de Uso" updatedAt="26 de junho de 2026">
      <p>
        Estes Termos de Uso regem a contratação e o uso dos serviços de{" "}
        <strong>{EMPRESA.razaoSocial}</strong>, inscrita no CNPJ sob o nº {EMPRESA.cnpj}, que opera a marca{" "}
        {EMPRESA.marca} (doravante &quot;{EMPRESA.marca}&quot;, &quot;nós&quot; ou &quot;contratada&quot;). Ao
        contratar um plano, criar uma conta ou utilizar a área do cliente, você (&quot;cliente&quot; ou
        &quot;contratante&quot;) declara que leu, entendeu e concorda com estes Termos.
      </p>

      <h2>1. O que a WaveOps oferece</h2>
      <p>
        A WaveOps presta serviços de automação de processos, desenvolvimento e agentes de inteligência
        artificial supervisionados, no modelo de assinatura mensal. O escopo de cada plano (número de
        automações, nível de suporte e recursos inclusos) está descrito na página de planos e no resumo do
        checkout no momento da contratação.
      </p>
      <p>
        A infraestrutura necessária para operar as automações contratadas (servidores, execução de fluxos e
        manutenção) fica por conta da WaveOps, dentro dos limites de uso justo descritos no item 5.
      </p>

      <h2>2. Conta e acesso</h2>
      <p>
        Após a confirmação do pagamento, o cliente ativa sua conta informando o e-mail usado na compra,
        validando um código enviado por e-mail e criando uma senha de acesso. O cliente é responsável por
        manter a confidencialidade da senha e por toda atividade realizada na conta. Avise a WaveOps em caso de
        uso não autorizado.
      </p>

      <h2>3. Planos, add-ons e cobrança</h2>
      <ul>
        <li>A assinatura é mensal e recorrente, renovada automaticamente a cada ciclo.</li>
        <li>
          Os pagamentos são processados pela <strong>Mercado Pago</strong>. A WaveOps não armazena dados de
          cartão.
        </li>
        <li>
          Add-ons (como números de WhatsApp adicionais, créditos de modelos de IA ou serviços de marketing)
          são cobrados separadamente, conforme contratados, e somados à mensalidade.
        </li>
        <li>
          Os valores vigentes são os exibidos no checkout no ato da contratação. Reajustes futuros são
          comunicados com antecedência mínima de 30 dias e valem a partir do ciclo seguinte.
        </li>
      </ul>

      <h2>4. Direito de arrependimento</h2>
      <p>
        Por se tratar de contratação fora do estabelecimento comercial, o cliente pode desistir em até{" "}
        <strong>7 (sete) dias corridos</strong> a contar da confirmação do primeiro pagamento, nos termos do
        art. 49 do Código de Defesa do Consumidor. Nesse caso, o valor pago é devolvido integralmente. Para
        exercer o direito, basta solicitar por <a href="mailto:contato@waveops.com.br">contato@waveops.com.br</a>.
      </p>

      <h2>5. Uso justo</h2>
      <p>
        Como a infraestrutura fica por conta da WaveOps, cada plano contempla um volume de uso compatível com o
        escopo contratado (execuções, integrações e recursos de processamento). Picos pontuais são absorvidos
        sem custo. Uso recorrente acima do previsto pode demandar a migração para um plano superior ou a
        contratação de add-ons, sempre comunicada e acordada antes de qualquer cobrança adicional.
      </p>

      <h2>6. Cancelamento</h2>
      <p>
        O cliente pode cancelar a assinatura a qualquer momento, sem multa, por{" "}
        <a href="mailto:contato@waveops.com.br">contato@waveops.com.br</a> ou pela área do cliente. O
        cancelamento encerra a renovação automática. O serviço permanece ativo até o fim do ciclo já pago, sem
        cobrança do ciclo seguinte. Fora da janela de arrependimento (item 4), não há devolução proporcional do
        ciclo em curso.
      </p>

      <h2>7. Reembolso</h2>
      <p>
        Além do direito de arrependimento, reembolsos podem ser concedidos quando houver falha comprovada na
        prestação do serviço não sanada em prazo razoável após a comunicação. O reembolso é processado pelo
        mesmo meio de pagamento da compra, via Mercado Pago, e o prazo de crédito depende do meio utilizado
        (Pix, cartão ou boleto).
      </p>

      <h2>8. Responsabilidades do cliente</h2>
      <ul>
        <li>Fornecer informações corretas e os acessos necessários para a execução dos serviços.</li>
        <li>Usar os serviços conforme a lei, sem finalidade ilícita, fraudulenta ou que viole direitos de terceiros.</li>
        <li>Não revender, sublicenciar ou explorar os serviços fora do escopo contratado sem autorização.</li>
      </ul>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        A WaveOps emprega esforços técnicos para manter as automações disponíveis e funcionando, mas parte da
        operação depende de serviços de terceiros (provedores de mensageria, gateways, APIs e infraestrutura de
        nuvem). A WaveOps não se responsabiliza por indisponibilidades ou falhas causadas por esses terceiros,
        por força maior ou por uso indevido pelo cliente. A responsabilidade da WaveOps, quando cabível, limita-se
        ao valor pago pelo cliente nos 3 (três) meses anteriores ao evento.
      </p>

      <h2>10. Propriedade intelectual</h2>
      <p>
        As automações, fluxos e configurações entregues no contexto da assinatura podem ser utilizados pelo
        cliente enquanto o contrato estiver vigente. Métodos, modelos e componentes reutilizáveis desenvolvidos
        pela WaveOps permanecem de sua titularidade. Os dados do cliente são e continuam sendo do cliente.
      </p>

      <h2>11. Proteção de dados</h2>
      <p>
        O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e está
        detalhado na nossa <a href="/privacidade">Política de Privacidade</a>, que integra estes Termos.
      </p>

      <h2>12. Alterações destes Termos</h2>
      <p>
        Estes Termos podem ser atualizados a qualquer momento. Mudanças relevantes são comunicadas por e-mail ou
        na área do cliente. O uso continuado após a vigência da nova versão implica concordância.
      </p>

      <h2>13. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor para
        dirimir eventuais controvérsias, conforme o Código de Defesa do Consumidor.
      </p>
    </LegalDoc>
  );
}
