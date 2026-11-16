import type { MeasurementStatus } from "@/components/StatusBadge";

import { toApiDecimal } from "./format";

export type IdName = { id: number; name: string };

/**
 * Grupo como vai para a API: `quantity` estacas iguais. Num rascunho local quantidade e diâmetro
 * podem faltar (linha incompleta). `pile_code` só existe nas medições antigas (uma estaca por linha).
 */
export type MeasurementLineIn = {
  quantity: number | null;
  diameter_cm: number | null;
  depth_m: string;
  pile_code?: string | null;
};

export type MeasurementIn = {
  client_key: string;
  job_id: number;
  rig_id: number | null;
  work_date: string;
  lines: MeasurementLineIn[];
  notes: string | null;
  photo_id: string | null;
  submit: boolean;
  /** Só o admin envia: lança no nome deste operador (alocado na obra). */
  operator_id?: number | null;
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
  total_piles: number;
  totals_by_diameter: DiameterTotal[];
  uncontracted_diameters: number[];
  created_by: IdName;
  /** Quem digitou; difere de `created_by` quando o admin lançou no nome do operador. */
  entered_by: IdName;
  submitted_at: string | null;
  reviewed_by: IdName | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  photo_id: string | null;
  notes: string | null;
};

export type MeasurementOut = MeasurementSummary & {
  lines: { quantity: number; diameter_cm: number; depth_m: string; pile_code: string | null }[];
};

/** Linha lida da foto, já normalizada pelo servidor; `valid=false` traz o motivo em `error`. */
export type ExtractedLine = {
  quantity: number | null;
  diameter_cm: number | null;
  depth_m: string | null;
  valid: boolean;
  error: string | null;
};

export type Extraction = { lines: ExtractedLine[]; warnings: string[] };

export type PhotoUpload = {
  photo_id: string;
  extraction: Extraction | null;
  extraction_error: string | null;
};

export const MIN_DIAMETER_CM = 25;

export const QUANTITY_MAX = 999;

/** Quantidade válida: inteiro de 1 a 999. */
export const validQuantity = (q: number | null | undefined): q is number =>
  q != null && Number.isInteger(q) && q >= 1 && q <= QUANTITY_MAX;

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

/** Soma metragens da API em centésimos inteiros (sem float); valores inválidos são ignorados. */
export function sumHundredths(values: string[]): number {
  return values.reduce((acc, v) => acc + (toHundredths(v) ?? 0), 0);
}

/** Centésimos → "1.234,50" (milhar com ponto). */
export function formatHundredthsGrouped(h: number): string {
  const int = String(Math.floor(h / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${int},${String(h % 100).padStart(2, "0")}`;
}

/** Valor da API ("20.5"/"20.50") → "20,50 m". */
export function formatMeters(apiValue: string): string {
  const h = toHundredths(apiValue);
  return `${h === null ? apiValue : formatHundredthsGrouped(h)} m`;
}

type Comparable = { quantity?: number | null; diameter_cm: number | null; depth_m: string };

/** Rascunho salvo antes dos grupos não tem `quantity`: cada linha era uma estaca. */
const quantityOf = (l: Comparable) => (l.quantity === undefined ? 1 : l.quantity);
const lineSig = (l: Comparable) => `${quantityOf(l)}|${l.diameter_cm}|${toHundredths(l.depth_m)}`;
const linesSig = (lines: Comparable[]) => lines.map(lineSig).sort().join(";");

/** O que o servidor devolveu tem o mesmo conteúdo do payload enviado (grupos em qualquer ordem, profundidade em centésimos)? */
export function sameContent(payload: MeasurementIn, out: MeasurementOut): boolean {
  if (payload.lines.some((l) => !validQuantity(quantityOf(l)) || l.diameter_cm == null || toHundredths(l.depth_m) === null)) {
    return false;
  }
  return (
    (payload.operator_id == null || payload.operator_id === out.created_by.id) &&
    payload.rig_id === out.rig.id &&
    payload.work_date === out.work_date &&
    (payload.photo_id ?? null) === (out.photo_id ?? null) &&
    (payload.notes?.trim() || null) === (out.notes?.trim() || null) &&
    payload.lines.length === out.lines.length &&
    linesSig(payload.lines) === linesSig(out.lines)
  );
}

/** Servidor já tinha a medição enviada/aprovada com outro conteúdo: o reenvio não aplicou as alterações. */
export function editsDropped(payload: MeasurementIn, out: MeasurementOut): boolean {
  return (out.status === "submitted" || out.status === "approved") && !sameContent(payload, out);
}

/** Estacas de um rascunho: soma das quantidades válidas (linha antiga sem quantidade = 1). */
export function pilesIn(lines: Comparable[]): number {
  return lines.reduce((acc, l) => {
    const q = quantityOf(l);
    return acc + (validQuantity(q) ? q : 0);
  }, 0);
}

export const pilesLabel =(n: number) => `${n} ${n === 1 ? "estaca" : "estacas"}`;
