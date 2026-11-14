"use client";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  /** Dinheiro: o ponto fica como separador de milhar ("1.500,00") em vez de virar vírgula. */
  grouping?: boolean;
};

function clean(raw: string, grouping: boolean): string {
  const cleaned = grouping
    ? raw.replace(/[^0-9.,]/g, "")
    : raw.replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const [int, ...frac] = cleaned.split(",");
  return frac.length ? `${int},${frac.join("").replace(/\./g, "")}` : int;
}

/** Campo numérico pt-BR: teclado decimal, aceita "," e ".", exibe sempre vírgula decimal. */
export function DecimalInput({ value, onChange, className, grouping = false, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(clean(e.target.value, grouping))}
      className={
        className ??
        "mt-1.5 block min-h-11 w-full rounded-lg border border-stone-400 bg-white px-3 text-base"
      }
    />
  );
}
