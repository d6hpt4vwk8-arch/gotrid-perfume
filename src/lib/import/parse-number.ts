// Shoptet XLSX exports sometimes use a comma as decimal separator (cs-CZ locale).
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, "").replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function parseIntSafe(input: string): number | null {
  const trimmed = input.trim().replace("%", "");
  if (trimmed === "") return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) ? value : null;
}
