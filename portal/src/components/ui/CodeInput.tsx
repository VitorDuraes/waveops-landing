"use client";
// Campo de codigo OTP de N digitos (default 6). Cada digito num input proprio,
// com foco gerenciado: digitar avanca para o proximo, Backspace volta, setas
// navegam, e colar o codigo inteiro preenche todos os campos de uma vez.
import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";

type Props = {
  // Estado controlado: array de digitos ("" para vazio). O length define quantos campos.
  value: string[];
  onChange: (next: string[]) => void;
  // Disparado quando todos os campos ficam preenchidos (ex.: para auto-submeter).
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
};

export function CodeInput({ value, onChange, onComplete, autoFocus, disabled }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const len = value.length;

  function focus(i: number) {
    const el = refs.current[Math.max(0, Math.min(len - 1, i))];
    el?.focus();
    el?.select();
  }

  function emit(next: string[]) {
    onChange(next);
    if (next.every((d) => d !== "")) onComplete?.(next.join(""));
  }

  // Distribui uma sequencia de digitos a partir do campo i. Retorna o indice do
  // proximo campo a focar (o primeiro vazio depois do ultimo preenchido).
  function fill(start: number, digits: string): number {
    const next = [...value];
    let idx = start;
    for (const ch of digits) {
      if (idx >= len) break;
      next[idx] = ch;
      idx++;
    }
    emit(next);
    return Math.min(idx, len - 1);
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      // Campo foi apagado (Delete ou apagar via menu): limpa so este.
      onChange(value.map((c, idx) => (idx === i ? "" : c)));
      return;
    }
    // digits pode ter 1 (digitacao) ou varios (autofill que cai num campo so).
    focus(fill(i, digits));
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) {
        onChange(value.map((c, idx) => (idx === i ? "" : c)));
      } else if (i > 0) {
        onChange(value.map((c, idx) => (idx === i - 1 ? "" : c)));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    focus(fill(i, digits));
  }

  return (
    <div className="code-inputs">
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          maxLength={1}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Dígito ${i + 1} de ${len}`}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
