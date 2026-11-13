"use client";

import { formatDocument } from "@/lib/documents";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/** CPF/CNPJ com máscara; CNPJ pode ter letras, então o teclado é de texto em maiúsculas. */
export function DocumentInput({ value, onChange, className, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      value={formatDocument(value)}
      onChange={(e) => onChange(formatDocument(e.target.value))}
      className={
        className ??
        "mt-1.5 block min-h-11 w-full rounded-lg border border-stone-400 bg-white px-3 text-base"
      }
    />
  );
}
