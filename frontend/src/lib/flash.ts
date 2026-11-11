import type { MeasurementStatus } from "@/components/StatusBadge";

/**
 * Recado de uma tela para a seguinte ("medição enviada"): vai por sessionStorage porque a URL do
 * detalhe não pode mudar. Lido sem apagar (o React pode renderizar duas vezes) e apagado num efeito; sem storage, simplesmente não aparece.
 */
export type SentFlash = { id: number; status: MeasurementStatus; piles: number; total_m: string };

const KEY = "mg_flash_sent";

export function flashSent(id: number, status: MeasurementStatus, piles: number, total_m: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ id, status, piles, total_m } satisfies SentFlash));
  } catch {
    /* sem sessionStorage: a medição já está salva, só falta o recado */
  }
}

export function peekSentFlash(id: number): SentFlash | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const flash = JSON.parse(raw) as SentFlash;
    return flash.id === id ? flash : null;
  } catch {
    return null;
  }
}

export function clearSentFlash(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nada a limpar */
  }
}
