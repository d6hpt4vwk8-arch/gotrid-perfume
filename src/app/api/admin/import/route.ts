import { NextRequest, NextResponse } from "next/server";
import { runXlsxImport } from "@/lib/import/run-import";

// Real supplier catalogs run a few thousand rows at most — this is a guard
// against a runaway upload tying up memory/CPU, not a realistic ceiling
// (security audit finding: import accepted an XLSX of any size).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Gated behind admin auth via src/middleware.ts (matches /api/admin/:path*).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor 'file' (multipart/form-data)." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Soubor je příliš velký (max. 25 MB)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const report = await runXlsxImport(buffer);

  return NextResponse.json(report);
}
