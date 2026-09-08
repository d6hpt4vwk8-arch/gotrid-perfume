import { prisma } from "@/lib/prisma";
import { parsePriceCompetitionReport } from "./parse-report";

export async function importPriceCompetitionReport(buffer: Buffer, periodLabel: string | null) {
  const rows = parsePriceCompetitionReport(buffer);
  if (rows.length === 0) {
    throw new Error("V souboru nebyl nalezen žádný řádek s daty.");
  }

  const priceImport = await prisma.priceCompetitionImport.create({
    data: { periodLabel, rowCount: rows.length },
  });

  await prisma.priceCompetitionRow.createMany({
    data: rows.map((row) => ({ importId: priceImport.id, ...row })),
  });

  return { importId: priceImport.id, rowCount: rows.length };
}
