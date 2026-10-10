"use client";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useModal } from "@/components/providers";
import {
  formatarDataHora,
  formatarTelefone,
  linkWhatsappDoLead,
  resumoUtm,
  rotuloCanal,
  rotuloFinalidade,
  rotuloTipo,
  type LeadDto,
} from "@/lib/leads-admin";

interface Item {
  rotulo: string;
  valor: ReactNode;
  larga?: boolean;
}

const VAZIO = <span className="muted">Não informado</span>;

// .dd nasce com 15,5px em negrito, pensado para número curto. Aqui o valor é texto
// livre (URL, mensagem), então fica menor, em peso normal, e quebra em qualquer ponto.
const VALOR: CSSProperties = { fontSize: 14, fontWeight: 500, overflowWrap: "anywhere" };

const ou = (valor: string | null): ReactNode => (valor && valor.trim() ? valor : VAZIO);

// Bloco do detalhe. Item sozinho na última linha ocupa a largura toda: sem isso a
// grade de .dl deixaria uma célula vazia pintada com a cor da borda.
function Secao({ titulo, itens }: { titulo: string; itens: Item[] }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h4 className="section-title">{titulo}</h4>
      <dl className="dl">
        {itens.map((item, i) => {
          const larga = item.larga || (i === itens.length - 1 && itens.length % 2 === 1);
          return (
            <div key={item.rotulo} className="di" style={larga ? { gridColumn: "1 / -1" } : undefined}>
              <dt className="dt">{item.rotulo}</dt>
              <dd className="dd" style={VALOR}>
                {item.valor}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// Modal com o registro completo do lead. Só leitura: marcar atendido, reabrir e apagar
// ficam nas ações da tabela.
export function LeadModalContent({ lead }: { lead: LeadDto }) {
  const { closeModal } = useModal();
  const wa = linkWhatsappDoLead(lead);
  const contato = lead.tipo === "contato";
  const utm = resumoUtm(lead);

  const pessoa: Item[] = contato
    ? [
        { rotulo: "Nome", valor: ou(lead.nome) },
        { rotulo: "Empresa", valor: ou(lead.empresa) },
        { rotulo: "E-mail", valor: ou(lead.email) },
        { rotulo: "Telefone", valor: lead.telefone ? formatarTelefone(lead.telefone) : VAZIO },
        { rotulo: "Canal de retorno", valor: ou(rotuloCanal(lead.canalRetorno)) },
        { rotulo: "Melhor horário", valor: ou(lead.melhorHorario) },
        { rotulo: "O que procura", valor: ou(lead.procura) },
        { rotulo: "O que mais pesa", valor: ou(lead.dor) },
      ]
    : [
        { rotulo: "E-mail", valor: ou(lead.email) },
        { rotulo: "Finalidade", valor: ou(rotuloFinalidade(lead.finalidade)) },
      ];

  return (
    <>
      <div className="modal-head">
        <h3>{lead.nome || lead.email || "Lead"}</h3>
        <button type="button" className="act" onClick={closeModal} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <div className="flex gap8 wrap">
          <span className="badge neutral">{rotuloTipo(lead.tipo)}</span>
          <StatusBadge status={lead.status} />
        </div>

        <Secao titulo={contato ? "Contato" : "Inscrição"} itens={pessoa} />

        {contato && (
          <Secao
            titulo="Mensagem"
            itens={[
              {
                rotulo: "Texto enviado",
                // pre-wrap mantém as quebras de linha que a pessoa digitou.
                valor: lead.mensagem && lead.mensagem.trim() ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{lead.mensagem}</span>
                ) : (
                  VAZIO
                ),
              },
            ]}
          />
        )}

        <Secao
          titulo="Origem"
          itens={[
            { rotulo: "Primeira fonte", valor: ou(lead.primeiraFonte) },
            { rotulo: "Página", valor: ou(lead.pagina) },
            { rotulo: "UTM", valor: utm ? <span style={{ whiteSpace: "pre-line" }}>{utm}</span> : VAZIO, larga: true },
            { rotulo: "Referrer", valor: ou(lead.referrer), larga: true },
            { rotulo: "Página de entrada", valor: ou(lead.landingUrl), larga: true },
          ]}
        />

        <Secao
          titulo="Consentimento"
          itens={[
            { rotulo: "Versão da política", valor: lead.politicaVersao },
            { rotulo: "Versão do texto de ciência", valor: ou(lead.cienciaTextoVersao) },
            { rotulo: "Aceitou marketing", valor: lead.marketingAceito ? "Sim" : "Não" },
            { rotulo: "Versão do texto de marketing", valor: ou(lead.marketingTextoVersao) },
          ]}
        />

        <Secao
          titulo="Registro"
          itens={[
            { rotulo: "Recebido em", valor: formatarDataHora(lead.createdAt) },
            { rotulo: "Atendido em", valor: lead.atendidoEm ? formatarDataHora(lead.atendidoEm) : "Ainda não" },
          ]}
        />
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={closeModal}>
          Fechar
        </button>
        {wa && (
          <a className="btn btn-primary" href={wa} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" /> Chamar no WhatsApp
          </a>
        )}
      </div>
    </>
  );
}
