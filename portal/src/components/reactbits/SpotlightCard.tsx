"use client";
/**
 * SpotlightCard - React Bits (https://reactbits.dev), MIT. Adaptado para o portal:
 *  - sem CSS proprio: usa as classes e os tokens do design system (.card/.metric),
 *    entao o cartao continua igual em tema claro e escuro;
 *  - o brilho segue o cursor via variaveis CSS (--mouse-x/--mouse-y), sem re-render.
 *
 * Efeito discreto de destaque no cartao sob o cursor. Aplicado nos cards de metrica.
 */
import { useRef, type PropsWithChildren, type MouseEvent } from "react";

interface SpotlightCardProps extends PropsWithChildren {
  className?: string;
  /** Cor do brilho. Padrao: o accent do tema, com alfa baixo. */
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(var(--accent-glow), 0.16)",
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spotlight-color", spotlightColor);
  }

  return (
    <div ref={ref} onMouseMove={onMouseMove} className={"spotlight " + className}>
      {children}
    </div>
  );
}
