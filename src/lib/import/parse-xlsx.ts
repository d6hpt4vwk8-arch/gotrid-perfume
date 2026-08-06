import ExcelJS from "exceljs";
import type { ImportRawRow } from "./types";

// Maps the known Shoptet export header spellings (TZ §6.2) to our internal field names.
const HEADER_ALIASES: Record<string, keyof ImportRawRow> = {
  code: "code",
  paircode: "pairCode",
  name: "name",
  ean: "ean",
  manufacturer: "manufacturer",
  purchaseprice: "purchasePrice",
  price: "price",
  vatrate: "vatRate",
  description: "description",
  image: "image",
  categorytext: "categoryText",
  "filteringproperty:znacka": "znacka",
  "filteringproperty:značka": "znacka",
  stock: "stock",
};

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: unknown }).text ?? "");
  }
  if (typeof value === "object" && "result" in (value as object)) {
    return String((value as { result: unknown }).result ?? "");
  }
  return String(value).trim();
}

export async function parseXlsxRows(buffer: Buffer): Promise<{
  rows: ImportRawRow[];
  headerRowNumber: number;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("XLSX soubor neobsahuje žádný list.");
  }

  const headerRow = sheet.getRow(1);
  const columnIndexToField = new Map<number, keyof ImportRawRow>();
  headerRow.eachCell((cell, colNumber) => {
    const raw = cellToString(cell.value).toLowerCase().trim();
    const field = HEADER_ALIASES[raw];
    if (field) columnIndexToField.set(colNumber, field);
  });

  if (columnIndexToField.size === 0) {
    throw new Error("V prvním řádku nebyly rozpoznány žádné očekávané sloupce.");
  }

  const rows: ImportRawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const isEmpty = row.cellCount === 0;
    if (isEmpty) return;

    const record: Partial<ImportRawRow> = {};
    columnIndexToField.forEach((field, colNumber) => {
      record[field] = cellToString(row.getCell(colNumber).value);
    });

    // Skip fully blank rows.
    const hasAnyValue = Object.values(record).some((v) => v && v.length > 0);
    if (!hasAnyValue) return;

    rows.push({
      code: record.code ?? "",
      pairCode: record.pairCode ?? "",
      name: record.name ?? "",
      ean: record.ean ?? "",
      manufacturer: record.manufacturer ?? "",
      purchasePrice: record.purchasePrice ?? "",
      price: record.price ?? "",
      vatRate: record.vatRate ?? "",
      description: record.description ?? "",
      image: record.image ?? "",
      categoryText: record.categoryText ?? "",
      znacka: record.znacka ?? "",
      stock: record.stock ?? "",
    });
  });

  return { rows, headerRowNumber: 1 };
}
