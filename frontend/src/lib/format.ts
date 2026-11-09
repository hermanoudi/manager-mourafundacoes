export function toApiDecimal(s: string): string {
  const t = s.trim();
  if (t.includes(",")) return t.replace(/\./g, "").replace(",", ".");
  return t;
}

export function formatDecimalBR(s: string): string {
  return s.replace(".", ",");
}
