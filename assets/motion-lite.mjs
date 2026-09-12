/* WaveOps: substituto próprio de useScroll/useTransform/useInView do framer-motion.

   O ImageSequence (assets/image-sequence.mjs) usa só esses três hooks, todos rasos.
   O framer-motion inteiro custa 48,7 KB gzip a mais o emotion-is-prop-valid, e a
   página de captação não precisa carregar isso para três primitivas. Este módulo
   reproduz a assinatura e a semântica exatas que o ImageSequence consome, nada além
   disso: sem layout animations, sem spring, sem parser genérico de offset.

   A parte matemática (mapRange, progressFromRect, pageProgress, createMotionValue)
   é pura: recebe número ou retângulo por parâmetro, nunca lê window por dentro. Só
   os hooks (useScroll, useTransform, useInView) tocam DOM, e só dentro de efeito.
   Mesmo padrão de assets/scroll-signal.mjs: injeta o leitor, não embute o leitor. */

import { useEffect, useRef, useState } from './vendor/react.mjs';

/** Satura um número no intervalo [0, 1]. */
export function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Mapa linear de um intervalo de entrada para um intervalo de saída, saturando
 * fora do intervalo de entrada. Suporta só o caso ascendente de 2 pontos, que é
 * o único usado pelo ImageSequence (useTransform(x, [0,1], [0,N])).
 */
export function mapRange(value, inputRange, outputRange) {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;
  if (inMax === inMin) return outMin;
  const t = clamp01((value - inMin) / (inMax - inMin));
  return outMin + t * (outMax - outMin);
}

/**
 * Progresso de scroll de um alvo contra a viewport, para o offset
 * ["start end", "end start"]: 0 quando o topo do alvo encosta na base da
 * viewport, 1 quando a base do alvo encosta no topo da viewport. Satura fora
 * desse intervalo. `rect` é qualquer objeto com `top` e `bottom` em pixels,
 * relativo à viewport (o formato de DOMRect / getBoundingClientRect).
 */
export function progressFromRect(rect, viewportHeight) {
  const height = rect.bottom - rect.top;
  const total = viewportHeight + height;
  if (total <= 0) return rect.top <= 0 ? 1 : 0;
  const traveled = viewportHeight - rect.top;
  return clamp01(traveled / total);
}

/** Progresso de scroll da página inteira, de 0 a 1. */
export function pageProgress(scrollTop, scrollHeight, viewportHeight) {
  const max = scrollHeight - viewportHeight;
  if (max <= 0) return 0;
  return clamp01(scrollTop / max);
}

/**
 * Valor observável mínimo: `.get()` lê o valor atual, `.set()` grava e notifica
 * quem assinou (só quando o valor muda de fato), `.on("change", cb)` assina e
 * devolve a função de cancelar. É o contrato que o ImageSequence espera de
 * `scrollYProgress` e do retorno de `useTransform`.
 */
export function createMotionValue(initial) {
  let current = initial;
  const listeners = new Set();
  return {
    get() {
      return current;
    },
    set(next) {
      if (next === current) return;
      current = next;
      listeners.forEach((fn) => fn(current));
    },
    on(event, cb) {
      if (event !== 'change') return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/**
 * Liga um valor observável de origem a um derivado mapeado, sem depender de
 * React: o derivado nasce com o valor já mapeado (correto na primeira leitura,
 * sem esperar o primeiro evento) e se atualiza a cada "change" da origem.
 * Existe separado do hook `useTransform` para poder ser testado em node puro.
 * Devolve `{ value, unsubscribe }`.
 */
export function deriveTransform(source, inputRange, outputRange) {
  const value = createMotionValue(mapRange(source.get(), inputRange, outputRange));
  const unsubscribe = source.on('change', (latest) => {
    value.set(mapRange(latest, inputRange, outputRange));
  });
  return { value, unsubscribe };
}

/**
 * useTransform(origem, [a,b], [c,d]): devolve um valor observável derivado.
 * A ligação nasce uma única vez por instância de `origem` (guardada em ref,
 * não recriada a cada render) e é refeita no efeito de montagem para cobrir a
 * corrida em que `origem` já mudou de valor entre a criação e o efeito rodar
 * (é exatamente o que acontece aqui: useScroll ainda não tinha lido a posição
 * real do alvo quando useTransform leu `origem.get()` pela primeira vez).
 */
export function useTransform(source, inputRange, outputRange) {
  const linkRef = useRef(null);
  if (!linkRef.current || linkRef.current.source !== source) {
    if (linkRef.current) linkRef.current.unsubscribe();
    const { value, unsubscribe } = deriveTransform(source, inputRange, outputRange);
    linkRef.current = { source, value, unsubscribe };
  }

  useEffect(() => {
    const link = linkRef.current;
    link.value.set(mapRange(link.source.get(), inputRange, outputRange));
    return () => link.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return linkRef.current.value;
}

/**
 * useScroll(opts?): sem `opts`, acompanha o progresso da página inteira.
 * Com `{ target, offset: ["start end", "end start"] }`, acompanha o alvo
 * contra a viewport com a semântica de `progressFromRect`. Recalcula em
 * `scroll` e `resize`, com listener passivo, e cancela na limpeza.
 */
export function useScroll(options) {
  const target = options && options.target ? options.target : null;

  const read = () => {
    if (typeof window === 'undefined') return 0;
    if (target) {
      const node = target.current;
      if (!node) return 0;
      return progressFromRect(node.getBoundingClientRect(), window.innerHeight);
    }
    const doc = document.documentElement;
    return pageProgress(window.scrollY || doc.scrollTop || 0, doc.scrollHeight, window.innerHeight);
  };

  const valueRef = useRef(null);
  if (!valueRef.current) {
    valueRef.current = createMotionValue(read());
  }
  const scrollYProgress = valueRef.current;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => scrollYProgress.set(read());
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, scrollYProgress]);

  return { scrollYProgress };
}

/**
 * useInView(ref, { amount }): booleano, true quando ao menos `amount` (fração
 * de 0 a 1) do elemento está visível na viewport. `amount` vira o `threshold`
 * de um IntersectionObserver. Desconecta na limpeza. Sem a API disponível,
 * assume visível (mesma convenção de fallback de assets/main.js).
 */
export function useInView(ref, options) {
  const amount = options && typeof options.amount === 'number' ? options.amount : 0;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setInView(entry.intersectionRatio >= amount);
      },
      { threshold: amount }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, amount]);

  return inView;
}
