const SP_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje no fuso de negócio (America/Sao_Paulo), `YYYY-MM-DD`. */
export function todaySP(now: Date = new Date()): string {
  return SP_DATE.format(now);
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`; vazio → "—". */
export function formatDateBR(d: string | null | undefined): string {
  return d ? d.split("-").reverse().join("/") : "—";
}

const SP_DATETIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

/** Timestamp ISO (UTC) exibido no horário de São Paulo. */
export function formatDateTimeBR(iso: string | null | undefined): string {
  return iso ? SP_DATETIME.format(new Date(iso)) : "—";
}
