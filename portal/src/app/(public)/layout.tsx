// Grupo publico (/checkout): sem shell, a propria tela traz a nav.
// A pagina publica de preco fica na landing (index.html), nao no portal. O
// checkout aqui atende so o plano de entrada, por link direto.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
