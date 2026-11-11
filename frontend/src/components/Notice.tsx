type Tone = "error" | "warn" | "info";

const TONE: Record<Tone, string> = {
  error: "bg-red-50 text-red-900",
  warn: "bg-amber-50 text-amber-950",
  info: "bg-stone-100 text-stone-900",
};

/** Triângulo de alerta, círculo de erro, "i": o tipo do aviso aparece no desenho, não só na cor. */
const GLYPH: Record<Tone, string> = {
  error: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM8 5v3.5M8 11h.01",
  warn: "M8 2.5l6 10.5H2zM8 7v2.5M8 11.5h.01",
  info: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM8 7.5V11M8 5h.01",
};

type Props = {
  tone: Tone;
  children: React.ReactNode;
  role?: "alert" | "status" | "note";
  className?: string;
};

export function Notice({ tone, children, role, className = "" }: Props) {
  return (
    <div role={role} className={`flex gap-2 rounded-lg p-3 text-sm ${TONE[tone]} ${className}`}>
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <path d={GLYPH[tone]} />
      </svg>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}
