import Link from "next/link";
import { BrandMark } from "@/components/icons";

// Navegação das páginas públicas do portal. A marca volta para a Home do site,
// e "Como funciona o preço" abre os modelos de contratação diretamente.
// As URLs são absolutas porque a raiz relativa pertence ao portal e leva ao login.
export function PublicNav() {
  return (
    <nav className="pub-nav">
      <Link className="brand" href="https://waveops.com.br/">
        <BrandMark size={32} />{" "}
        <span>
          Wave<span className="v">Ops</span>
        </span>
      </Link>
      <div className="sp" />
      <Link className="btn btn-quiet" href="https://waveops.com.br/projetos-sob-medida/#modelos">
        Como funciona o preço
      </Link>
      <Link className="btn btn-primary" href="/cliente/login">
        Já sou cliente
      </Link>
    </nav>
  );
}
