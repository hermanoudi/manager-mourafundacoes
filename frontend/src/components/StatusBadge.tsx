export const JOB_STATUS_LABEL = {
  planned: "Planejada",
  in_progress: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
} as const;

export const MEASUREMENT_STATUS_LABEL = {
  draft: "Rascunho",
  submitted: "Enviada",
  approved: "Aprovada",
  rejected: "Rejeitada",
} as const;

export type JobStatus = keyof typeof JOB_STATUS_LABEL;
export type MeasurementStatus = keyof typeof MEASUREMENT_STATUS_LABEL;

const TONE: Record<string, string> = {
  planned: "bg-stone-100 text-stone-800",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
  draft: "bg-stone-100 text-stone-800",
  submitted: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

/** Um desenho por estado: o significado não depende só da cor. Traço único de 2px, 16×16. */
const GLYPH: Record<string, string> = {
  planned: "M8 3v5l3 2", // relógio
  draft: "M3 13l1-4 7-7 3 3-7 7zM10 4l3 3", // lápis
  in_progress: "M3 8h8M8 4l4 4-4 4", // seta
  submitted: "M3 8l10-5-3 10-2-4z", // enviado
  completed: "M3 8.5l3.5 3.5L13 4.5", // check
  approved: "M3 8.5l3.5 3.5L13 4.5", // check
  cancelled: "M4 4l8 8M12 4l-8 8", // x
  rejected: "M4 4l8 8M12 4l-8 8", // x
};

type Props =
  | { kind: "job"; status: JobStatus }
  | { kind: "measurement"; status: MeasurementStatus };

export function StatusBadge(props: Props) {
  const label =
    props.kind === "job" ? JOB_STATUS_LABEL[props.status] : MEASUREMENT_STATUS_LABEL[props.status];
  return (
    <span
      data-testid={`${props.kind}-status`}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-sm font-semibold uppercase tracking-wide ${TONE[props.status]}`}
    >
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={GLYPH[props.status]} />
      </svg>
      {label}
    </span>
  );
}
