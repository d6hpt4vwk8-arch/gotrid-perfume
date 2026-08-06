import { NextRequest, NextResponse } from "next/server";
import { runXlsxImport } from "@/lib/import/run-import";

// Gated behind admin auth via src/middleware.ts (matches /api/admin/:path*).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor 'file' (multipart/form-data)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const report = await runXlsxImport(buffer);

  return NextResponse.json(report);
}
