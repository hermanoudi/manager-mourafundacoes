export function normalizeDocument(raw: string): string {
  return raw.replace(/[.\-/\s]/g, "").toUpperCase();
}

function applyMask(value: string, mask: string): string {
  let out = "";
  let i = 0;
  for (const m of mask) {
    if (i >= value.length) break;
    if (m === "#") out += value[i++];
    else out += m;
  }
  return out;
}

const CPF_MASK = "###.###.###-##";
const CNPJ_MASK = "##.###.###/####-##";

/** Máscara progressiva de CPF (11 dígitos) ou CNPJ (14, numérico ou alfanumérico). */
export function formatDocument(raw: string): string {
  const doc = normalizeDocument(raw).slice(0, 14);
  const isCpf = doc.length <= 11 && /^\d*$/.test(doc);
  return applyMask(doc, isCpf ? CPF_MASK : CNPJ_MASK);
}

function dv(values: number[], weights: number[]): number {
  const rest = values.reduce((s, v, i) => s + v * weights[i], 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function validCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || new Set(d).size === 1) return false;
  const n = [...d].map(Number);
  const d1 = dv(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n[9] === d1 && n[10] === d2;
}

function validCnpj(d: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || new Set(d).size === 1) return false;
  const v = [...d.slice(0, 12)].map((c) => c.charCodeAt(0) - 48);
  const d1 = dv(v, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...v, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.slice(12) === `${d1}${d2}`;
}

/** Espelha a validação da API (CPF, CNPJ numérico e alfanumérico); a API continua sendo a fonte da verdade. */
export function isValidDocument(raw: string): boolean {
  const d = normalizeDocument(raw);
  return validCpf(d) || validCnpj(d);
}
