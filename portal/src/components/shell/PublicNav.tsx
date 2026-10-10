import Link from "next/link";
import { BrandMark } from "@/components/icons";

// Nav das paginas publicas do portal (hoje so o checkout).
// A landing nao tem mais grade de planos: escopo e valor saem do diagnostico.
// A marca volta para a home do site; "Como funciona o preço" leva à página de
// modelos do site novo. A URL é absoluta de propósito: o portal é outra origem
// (portal.waveops.com.br), e um "/#pacotes" relativo cai na raiz do portal.
export function PublicNav() {
  return (
    <nav className="pub-nav">
      <Link className="brand" href="/">
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
