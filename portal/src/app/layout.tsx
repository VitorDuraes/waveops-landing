import type { Metadata } from "next";
import { Space_Grotesk, Hanken_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers, themeInitScript } from "@/components/providers";

// Space Grotesk e Hanken Grotesk sao fontes variaveis (sem weight fixo).
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken-grotesk", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap" });

export const metadata: Metadata = {
  title: "WaveOps · Portal",
  description: "Portal WaveOps · área do cliente e painel administrativo de assinaturas, cobrança e follow-up.",
  // Sem isto o navegador pedia /favicon.ico e levava 404 em toda pagina do portal.
  icons: {
    icon: [
      { url: "/assets/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/assets/apple-touch-icon.png",
  },
  // O portal e area logada: nao deve ser indexado.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      data-density="comfortable"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
