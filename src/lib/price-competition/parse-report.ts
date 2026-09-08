// Parses the "Statistiky položek (podrobný)" CSV from Sklik/Zboží's Centrum
// prodejce (Statistiky → Podrobné statistiky → Stáhnout CSV). It's Windows-1250
// encoded, semicolon-delimited, and RFC4180-quoted — a handful of product
// names carry an HTML entity like "L&#039;Oréal" whose semicolon would
// otherwise split the line in the wrong place, hence the quote-aware parser
// below rather than a plain String.split(";").
export interface ParsedPriceCompetitionRow {
  productCode: string;
  offerName: string;
  impressionsByPrice: number;
  avgPositionByPrice: number | null;
  impressionsRecommended: number;
  avgPositionRecommended: number | null;
  clicksTotal: number;
}

const COLUMNS = {
  offerName: "Název nabídky",
  impressionsByPrice: "Zobrazení (Produkt - dle ceny)",
  avgPositionByPrice: "Průměrná pozice (Produkt - dle ceny)",
  impressionsRecommended: "Zobrazení (Produkt - doporučené)",
  avgPositionRecommended: "Průměrná pozice (Produkt - doporučené)",
  clicksTotal: "Prokliky (celkem)",
  // Our own feed's <ITEM_ID> (= Product.code), not the neighboring "Produkt
  // Zboží.cz (poslední známý)" column — that one is Zboží's own matched
  // catalog product's display name, not an identifier we can join on.
  productCode: "ITEM_ID",
} as const;

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseCzechNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseCzechDecimalOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseCzechNumber(raw);
  return n === 0 ? null : n;
}

export function parsePriceCompetitionReport(buffer: Buffer): ParsedPriceCompetitionRow[] {
  const text = new TextDecoder("windows-1250").decode(buffer);
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]!, ";").map((h) => h.trim());
  const indexOf = (label: string) => header.indexOf(label);
  const idx = {
    offerName: indexOf(COLUMNS.offerName),
    impressionsByPrice: indexOf(COLUMNS.impressionsByPrice),
    avgPositionByPrice: indexOf(COLUMNS.avgPositionByPrice),
    impressionsRecommended: indexOf(COLUMNS.impressionsRecommended),
    avgPositionRecommended: indexOf(COLUMNS.avgPositionRecommended),
    clicksTotal: indexOf(COLUMNS.clicksTotal),
    productCode: indexOf(COLUMNS.productCode),
  };
  if (Object.values(idx).some((i) => i === -1)) {
    throw new Error("Neočekávaný formát CSV — chybí očekávaný sloupec.");
  }

  const rows: ParsedPriceCompetitionRow[] = [];
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line, ";");
    const productCode = fields[idx.productCode]?.trim();
    if (!productCode) continue;

    rows.push({
      productCode,
      offerName: fields[idx.offerName]?.trim() || productCode,
      impressionsByPrice: parseCzechNumber(fields[idx.impressionsByPrice]),
      avgPositionByPrice: parseCzechDecimalOrNull(fields[idx.avgPositionByPrice]),
      impressionsRecommended: parseCzechNumber(fields[idx.impressionsRecommended]),
      avgPositionRecommended: parseCzechDecimalOrNull(fields[idx.avgPositionRecommended]),
      clicksTotal: parseCzechNumber(fields[idx.clicksTotal]),
    });
  }
  return rows;
}
