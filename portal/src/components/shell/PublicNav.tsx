import Link from "next/link";
import { BrandMark } from "@/components/icons";

// Nav das paginas publicas do portal (hoje so o checkout).
// A landing nao tem mais grade de planos: escopo e valor saem do diagnostico.
// A marca volta para a home do site; "Como funciona o preco" leva a secao de
// precos da landing (o id #pacotes ficou, para nao quebrar link antigo).
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
      <Link className="btn btn-quiet" href="/#pacotes">
        Como funciona o preço
      </Link>
      <Link className="btn btn-primary" href="/cliente/login">
        Já sou cliente
      </Link>
    </nav>
  );
}
