export function toApiDecimal(s: string): string {
  const t = s.trim();
  if (t.includes(",")) return t.replace(/\./g, "").replace(",", ".");
  return t;
}

export function formatDecimalBR(s: string): string {
  return s.replace(".", ",");
}

/** Dinheiro digitado em pt-BR: "1500", "1.500" ou "1.500,00" (milhar com ponto, até 2 casas). */
const MONEY_BR = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;

export function isMoneyBR(s: string): boolean {
  return MONEY_BR.test(s.trim());
}

/** Dinheiro pt-BR → API: o ponto é sempre milhar ("1.500" → "1500"). */
export function toApiMoney(s: string): string {
  return s.trim().replace(/\./g, "").replace(",", ".");
}

/** Decimal da API → campo de dinheiro pt-BR: "1500.00" → "1.500,00". */
export function formatMoneyInputBR(s: string): string {
  const [int = "0", frac = ""] = s.trim().split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${(frac + "00").slice(0, 2)}`;
}
