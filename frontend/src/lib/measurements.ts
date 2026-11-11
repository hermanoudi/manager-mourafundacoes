import type { MeasurementStatus } from "@/components/StatusBadge";

import { toApiDecimal } from "./format";

export type IdName = { id: number; name: string };

/** Linha como vai para a API; num rascunho local o diâmetro pode faltar (linha incompleta). */
export type MeasurementLineIn = { pile_code: string; diameter_cm: number | null; depth_m: string };

export type MeasurementIn = {
  client_key: string;
  job_id: number;
  rig_id: number | null;
  work_date: string;
  lines: MeasurementLineIn[];
  notes: string | null;
  photo_id: string | null;
  submit: boolean;
};

export type DiameterTotal = { diameter_cm: number; piles: number; meters: string };

export type MeasurementSummary = {
  id: number;
  client_key: string;
  job: IdName;
  rig: IdName;
  work_date: string;
  status: MeasurementStatus;
  total_m: string;
  totals_by_diameter: DiameterTotal[];
  uncontracted_diameters: number[];
  created_by: IdName;
  submitted_at: string | null;
  reviewed_by: IdName | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  photo_id: string | null;
  notes: string | null;
};

export type MeasurementOut = MeasurementSummary & {
  lines: { pile_code: string; diameter_cm: number; depth_m: string }[];
};

export const MIN_DIAMETER_CM = 25;

/** Mesma chave do backend: só letras e dígitos, maiúsculos ("E-12" == "e 12"). */
export function pileKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Próximo código sugerido: incrementa o último número mantendo prefixo e zeros ("E-09" → "E-10"). */
export function nextPileCode(code: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(code.trim());
  if (!m) return "";
  const [, prefix, digits, suffix] = m;
  return `${prefix}${String(Number(digits) + 1).padStart(digits.length, "0")}${suffix}`;
}

/** Metragem (pt-BR "8,5" ou API "8.5") em centésimos inteiros; null se inválida ou com mais de 2 casas. */
export function toHundredths(value: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(toApiDecimal(value));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Centésimos → "20,50". */
export function formatHundredths(h: number): string {
  return `${Math.floor(h / 100)},${String(h % 100).padStart(2, "0")}`;
}

/** Valor da API ("20.5"/"20.50") → "20,50 m". */
export function formatMeters(apiValue: string): string {
  const h = toHundredths(apiValue);
  return `${h === null ? apiValue : formatHundredths(h)} m`;
}

export const pilesLabel = (n: number) => `${n} ${n === 1 ? "estaca" : "estacas"}`;
