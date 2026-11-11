import type { MeasurementIn } from "./measurements";

/** Rascunho guardado no aparelho; `submit: true` = o envio foi tentado e não confirmado. */
export type MeasurementDraft = MeasurementIn & { saved_at: string };

const PREFIX = "mg_draft:";

// localStorage pode não existir (SSR) ou lançar (modo privado, cota, bloqueio): nunca propaga erro.

export function saveDraft(d: MeasurementDraft): void {
  try {
    localStorage.setItem(PREFIX + d.client_key, JSON.stringify(d));
  } catch {
    /* sem armazenamento local: segue só com o servidor */
  }
}

export function loadDraft(clientKey: string): MeasurementDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + clientKey);
    return raw ? (JSON.parse(raw) as MeasurementDraft) : null;
  } catch {
    return null;
  }
}

export function listDrafts(jobId?: number): MeasurementDraft[] {
  const out: MeasurementDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const d = loadDraft(key.slice(PREFIX.length));
      if (d && (jobId === undefined || d.job_id === jobId)) out.push(d);
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export function clearDraft(clientKey: string): void {
  try {
    localStorage.removeItem(PREFIX + clientKey);
  } catch {
    /* nada a limpar */
  }
}
