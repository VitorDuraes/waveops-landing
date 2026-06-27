import Link from "next/link";
import { Icon } from "@/components/icons";
import { PublicNav } from "@/components/shell/PublicNav";

// Casca compartilhada dos documentos legais (Termos de Uso e Politica de
// Privacidade): nav publica, titulo, data e rodape cruzando os dois documentos.
export function LegalDoc({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <div className="pub-wrap" style={{ maxWidth: 760 }}>
        <Link className="btn btn-quiet btn-sm" href="/" style={{ marginBottom: 18 }}>
          <Icon name="chevronLeft" /> Voltar ao site
        </Link>
        <h1 style={{ fontSize: 30, marginBottom: 6 }}>{title}</h1>
        <p className="muted" style={{ marginBottom: 28 }}>
          Última atualização: {updatedAt}
        </p>
        <div className="legal-body">{children}</div>
        <div className="legal-foot">
          <Link href="/termos">Termos de Uso</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacidade">Política de Privacidade</Link>
          <span aria-hidden="true">·</span>
          <a href="mailto:contato@waveops.com.br">contato@waveops.com.br</a>
        </div>
      </div>
    </>
  );
}
