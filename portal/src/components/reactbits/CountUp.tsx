"use client";
/**
 * CountUp - React Bits (https://reactbits.dev), MIT. Adaptado para o portal:
 *  - import de "framer-motion" (o projeto ja usa a v12) no lugar de "motion/react";
 *  - formatacao em pt-BR com prefixo/sufixo, para o numero animado sair "R$ 4.636";
 *  - respeita prefers-reduced-motion: sem animacao, escreve o valor final direto.
 *
 * Anima o numero de `from` ate `to` quando entra na viewport. Usado nos cards de
 * metrica do admin, onde o valor e o elemento principal da tela.
 */
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";

interface CountUpProps {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 1.1,
  className = "",
  prefix = "",
  suffix = "",
  decimals = 0,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const format = useCallback(
    (n: number) =>
      prefix +
      n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
      suffix,
    [prefix, suffix, decimals]
  );

  useEffect(() => {
    if (ref.current) ref.current.textContent = format(prefersReducedMotion() ? to : from);
  }, [from, to, format]);

  useEffect(() => {
    if (!isInView || prefersReducedMotion()) return;
    const id = setTimeout(() => motionValue.set(to), delay * 1000);
    return () => clearTimeout(id);
  }, [isInView, motionValue, to, delay]);

  useEffect(() => {
    return springValue.on("change", (latest: number) => {
      if (ref.current) ref.current.textContent = format(latest);
    });
  }, [springValue, format]);

  // O valor final fica no aria-label: leitor de tela nao acompanha a contagem.
  return <span className={className} ref={ref} aria-label={format(to)} />;
}
