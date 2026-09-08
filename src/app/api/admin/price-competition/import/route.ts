import { NextRequest, NextResponse } from "next/server";
import { importPriceCompetitionReport } from "@/lib/price-competition/import-report.server";

// The real report tops out around 2 800 rows for this catalog — a guard
// against a runaway upload, not a realistic ceiling.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Gated behind admin auth via src/middleware.ts (matches /api/admin/:path*).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const periodLabel = formData.get("periodLabel");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor 'file' (multipart/form-data)." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Soubor je příliš velký (max. 25 MB)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await importPriceCompetitionReport(
      buffer,
      typeof periodLabel === "string" && periodLabel.trim() ? periodLabel.trim() : null,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import se nezdařil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
