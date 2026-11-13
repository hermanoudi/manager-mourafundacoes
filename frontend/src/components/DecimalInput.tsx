"use client";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/** Campo numérico pt-BR: teclado decimal, aceita "," e ".", exibe sempre vírgula. */
export function DecimalInput({ value, onChange, className, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/\./g, ",").replace(/[^0-9,]/g, "");
        const [int, ...frac] = cleaned.split(",");
        onChange(frac.length ? `${int},${frac.join("")}` : int);
      }}
      className={
        className ??
        "mt-1.5 block min-h-11 w-full rounded-lg border border-stone-400 bg-white px-3 text-base"
      }
    />
  );
}
