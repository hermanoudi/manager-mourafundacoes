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
