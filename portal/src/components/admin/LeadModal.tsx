"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useModal, useToast } from "@/components/providers";
import { CABECALHO_JSON, chamar } from "@/lib/leads-client";
import {
  avisoTitularApagado,
  confirmacaoDoTitular,
  formatarDataHora,
  formatarTelefone,
  linkWhatsappDoLead,
  resumoUtm,
  rotuloCanal,
  rotuloFinalidade,
  rotuloTipo,
  type CampoDoTitular,
  type LeadDto,
  type ListaLeads,
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

// Botão travado enquanto uma ação roda. O design system não tem estilo para :disabled.
const TRAVADO: CSSProperties = { opacity: 0.55, cursor: "not-allowed" };

// Modal com o registro completo do lead. Marcar atendido, reabrir e apagar um lead ficam
// nas ações da tabela. Aqui só se apaga o titular inteiro: todos os leads com o mesmo
// e-mail ou telefone, que é o que um pedido de exclusão (LGPD) pede. `onTitularApagado`
// recarrega a lista de quem abriu o modal.
export function LeadModalContent({ lead, onTitularApagado }: { lead: LeadDto; onTitularApagado?: () => void }) {
  const { closeModal } = useModal();
  const toast = useToast();
  // Campo cuja exclusão está em andamento. Trava os dois botões.
  const [ocupado, setOcupado] = useState<CampoDoTitular | null>(null);
  const wa = linkWhatsappDoLead(lead);
  const contato = lead.tipo === "contato";
  const utm = resumoUtm(lead);

  async function apagarTodos(campo: CampoDoTitular) {
    const valor = campo === "email" ? lead.email : lead.telefone;
    if (!valor || ocupado) return;
    setOcupado(campo);
    try {
      // A contagem do confirm vem da própria consulta: e-mail e telefone são buscas exatas, o
      // total dela é o número de linhas que a exclusão vai pegar. Vai no corpo de um POST: o
      // e-mail e o telefone do titular não podem ficar numa URL.
      const { total } = await chamar<ListaLeads>("/api/leads/consulta", {
        method: "POST",
        headers: CABECALHO_JSON,
        body: JSON.stringify({ busca: valor }),
      });
      if (total === 0) {
        toast("Nenhum lead encontrado com esse dado", "info");
        return;
      }
      if (!window.confirm(confirmacaoDoTitular(campo, valor, total))) return;
      const r = await chamar<{ quantidade: number }>("/api/leads/apagar-titular", {
        method: "POST",
        headers: CABECALHO_JSON,
        body: JSON.stringify({ [campo]: valor }),
      });
      closeModal();
      toast(avisoTitularApagado(r.quantidade));
      onTitularApagado?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível apagar os leads.", "info");
    } finally {
      setOcupado(null);
    }
  }

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

        {(lead.email || lead.telefone) && (
          <section style={{ marginTop: 22 }}>
            <h4 className="section-title">Apagar a pedido do titular</h4>
            <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
              Cada botão apaga todos os leads com o mesmo e-mail ou telefone, não só este. Você vê quantos são antes
              de confirmar. Não dá para desfazer.
            </p>
            <div className="flex gap8 wrap">
              {lead.email && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={ocupado !== null}
                  style={ocupado !== null ? TRAVADO : undefined}
                  onClick={() => void apagarTodos("email")}
                >
                  <Icon name="trash" /> {ocupado === "email" ? "Contando..." : "Apagar todos deste e-mail"}
                </button>
              )}
              {lead.telefone && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={ocupado !== null}
                  style={ocupado !== null ? TRAVADO : undefined}
                  onClick={() => void apagarTodos("telefone")}
                >
                  <Icon name="trash" /> {ocupado === "telefone" ? "Contando..." : "Apagar todos deste telefone"}
                </button>
              )}
            </div>
          </section>
        )}
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
