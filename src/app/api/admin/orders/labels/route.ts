import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import type { ShippingMethod } from "@prisma/client";
import { GET as packetaLabel } from "@/app/api/admin/orders/[id]/label/route";
import { GET as balikovnaLabel } from "@/app/api/admin/orders/[id]/balikovna-label/route";
import { GET as glsLabel } from "@/app/api/admin/orders/[id]/gls-label/route";

export const dynamic = "force-dynamic";
// Each label is a carrier API round trip (and creates the parcel the first time), done one after another.
export const maxDuration = 60;

type LabelHandler = typeof packetaLabel;

// Reuses the single-order label routes as they are (they create the parcel on first use and re-serve the saved
// label afterwards), so a bulk print behaves exactly like clicking the button on each order.
const CARRIERS: { methods: ShippingMethod[]; handler: LabelHandler }[] = [
  { methods: ["ZASILKOVNA", "ZASILKOVNA_HD"], handler: packetaLabel },
  { methods: ["GLS", "GLS_MISTO"], handler: glsLabel },
  { methods: ["BALIKOVNA"], handler: balikovnaLabel },
];

const MAX_ORDERS = 40;

// The standard PDF fonts only cover WinAnsi, so the error page is written without diacritics.
function ascii(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
}

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const ids = String(form.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ORDERS);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Nejsou vybrané žádné objednávky." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "asc" },
    select: { id: true, number: true, shippingMethod: true },
  });

  const merged = await PDFDocument.create();
  const problems: string[] = [];
  let pages = 0;

  for (const carrier of CARRIERS) {
    for (const order of orders.filter((o) => carrier.methods.includes(o.shippingMethod))) {
      try {
        const res = await carrier.handler(req, { params: Promise.resolve({ id: order.id }) });
        if (!res.headers.get("content-type")?.includes("application/pdf")) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          problems.push(`${order.number}: ${body?.error ?? "štítek se nepodařilo vytvořit."}`);
          continue;
        }
        const src = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true });
        for (const page of await merged.copyPages(src, src.getPageIndices())) {
          merged.addPage(page);
          pages++;
        }
      } catch (err) {
        problems.push(`${order.number}: ${err instanceof Error ? err.message : "štítek se nepodařilo vytvořit."}`);
      }
    }
  }
  for (const order of orders.filter((o) => !CARRIERS.some((c) => c.methods.includes(o.shippingMethod)))) {
    problems.push(`${order.number}: tento způsob dopravy nemá štítek.`);
  }
  for (const id of ids) {
    if (!orders.some((o) => o.id === id)) problems.push(`${id}: objednávka nenalezena.`);
  }

  if (pages === 0) {
    return NextResponse.json({ error: problems.join("\n") || "Žádný štítek se nevytvořil." }, { status: 502 });
  }

  if (problems.length > 0) {
    const page = merged.addPage([595, 842]);
    const font = await merged.embedFont(StandardFonts.Helvetica);
    page.drawText("Tyto objednavky nemaji stitek (v tomto PDF chybi):", { x: 40, y: 790, size: 13, font, color: rgb(0.7, 0, 0) });
    let y = 765;
    for (const problem of problems) {
      for (const line of wrap(ascii(problem), 90)) {
        page.drawText(line, { x: 40, y, size: 10, font });
        y -= 14;
      }
      y -= 4;
    }
  }

  return new NextResponse(new Uint8Array(await merged.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="stitky.pdf"',
    },
  });
}
