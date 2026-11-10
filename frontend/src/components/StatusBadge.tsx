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
  planned: "bg-stone-100 text-stone-700",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  draft: "bg-stone-100 text-stone-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
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
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[props.status]}`}
    >
      {label}
    </span>
  );
}
