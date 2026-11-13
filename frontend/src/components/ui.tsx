/** Peças visuais compartilhadas pelas telas: cabeçalhos, indicadores, painéis, filtros e botões. */

/** Seção: caixa reta com a régua da marca no topo. */
export const panel = "border border-t-2 border-t-brand bg-white";

export const btnPrimary =
  "btn-label inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-white hover:bg-brand-dark disabled:opacity-60";
export const btnSecondary =
  "btn-label inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand bg-white px-5 text-brand hover:bg-brand-soft disabled:opacity-60";
export const btnQuiet =
  "btn-label inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-400 bg-white px-4 text-secondary-dark hover:bg-stone-50 disabled:opacity-60";
export const btnDanger =
  "btn-label inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-700 bg-white px-5 text-red-700 hover:bg-red-50 disabled:opacity-60";

/** Cabeçalho de páginas de lista e formulários. */
export function PageHeader({
  title, description, actions,
}: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="break-words text-3xl font-extrabold leading-none md:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">{actions}</div>}
    </div>
  );
}

/** Cabeçalho das telas de uma entidade (obra, medição, cliente…) e do início. */
export function EntityHeader({
  title, meta, actions, children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Indicadores (`<KpiGrid>`) ou notas que ocupam a largura toda, abaixo do título. */
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="break-words text-3xl font-extrabold leading-none md:text-4xl">{title}</h1>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-stone-600">{meta}</div>
          )}
        </div>
        {actions && <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Indicadores em linhas: rótulo à esquerda, número à direita, régua embaixo. */
export function KpiGrid({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <dl
      aria-busy={busy}
      className={`${panel} grid gap-x-10 px-4 pb-4 pt-1 sm:grid-cols-2 md:px-6 2xl:grid-flow-col 2xl:auto-cols-fr 2xl:grid-cols-none`}
    >
      {children}
    </dl>
  );
}

export function Kpi({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-brand-tint py-3">
      <dt className="text-stone-700">{label}</dt>
      <dd className="shrink-0 font-display text-2xl font-bold tabular-nums leading-none text-secondary-dark">
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-stone-600">{unit}</span>}
      </dd>
    </div>
  );
}

export function SectionHead({
  title, action, id, level = 2,
}: { title: string; action?: React.ReactNode; id?: string; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <H id={id} className={level === 2 ? "text-xl" : "text-lg"}>{title}</H>
      {action}
    </div>
  );
}

export function EmptyPanel({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-stone-600">{children}</p>;
}

/** Lista de fatos rótulo/valor num painel. */
export function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className={`${panel} divide-y px-4 text-sm`}>
      {items.map(([k, v]) => (
        <div key={k} className="py-3">
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-1 break-words text-base">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Filtro de escolha única em botões (substitui o select de status): um toque, sempre visível. */
export function FilterChips<V extends string>({
  label, options, value, onChange, disabled,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`btn-label min-h-11 shrink-0 rounded-lg border px-4 text-sm transition-colors disabled:opacity-60 ${
              on
                ? "border-brand bg-brand-soft text-brand"
                : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13l1-4 7-7 3 3-7 7zM10 4l3 3" />
    </svg>
  );
}

/** Selo para estados que não são de obra/medição (papel, situação, status da máquina). */
export function Pill({ tone = "neutral", children }: {
  tone?: "neutral" | "good" | "warn" | "bad"; children: React.ReactNode;
}) {
  const cls = {
    neutral: "bg-stone-100 text-stone-800",
    good: "bg-green-100 text-green-900",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-red-100 text-red-900",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-display text-sm font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}
