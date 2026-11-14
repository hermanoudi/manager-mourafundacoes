/** Só os dígitos do telefone (DDD + número), como vai para a API. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

/** Máscara progressiva: fixo "(34) 3210-1234", celular "(34) 99999-0000". */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const split = d.length === 11 ? 7 : 6;
  const head = `(${d.slice(0, 2)}) ${d.slice(2, split)}`;
  return d.length > split ? `${head}-${d.slice(split)}` : head;
}

export function isValidPhone(raw: string): boolean {
  const n = raw.replace(/\D/g, "").length;
  return n === 0 || n === 10 || n === 11;
}

/** Exibição: formata telefones com 10/11 dígitos; texto legado fica como foi gravado. */
export function displayPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const n = raw.replace(/\D/g, "").length;
  return n === 10 || n === 11 ? formatPhone(raw) : raw;
}
