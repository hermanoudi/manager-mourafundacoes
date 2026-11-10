/** Formata um decimal da API (string) como moeda pt-BR sem passar por float: "1234.5" → "R$ 1.234,50". */
export function formatMoneyBR(s: string): string {
  const [int = "0", frac = ""] = s.trim().split(".");
  const negative = int.startsWith("-");
  const digits = int.replace(/\D/g, "") || "0";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = (frac + "00").slice(0, 2);
  return `${negative ? "-" : ""}R$ ${grouped},${cents}`;
}
