import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { OdstoupeniDocument } from "@/lib/pdf/odstoupeni";

export async function GET() {
  const buffer = await renderToBuffer(<OdstoupeniDocument />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="odstoupeni-od-smlouvy.pdf"`,
    },
  });
}
