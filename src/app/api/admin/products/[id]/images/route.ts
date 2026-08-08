import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp, { type FormatEnum } from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const EXT_BY_FORMAT: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { code: true } });
  if (!product) {
    return NextResponse.json({ error: "Produkt nenalezen." }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Soubor je příliš velký (max 15 MB)." }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // The client-supplied Content-Type on a multipart part is just a string
  // the request author picked — trusting it (as this used to) lets a
  // renamed/relabeled file through with whatever extension it claims
  // (security audit finding). Decoding with sharp reads the real format
  // from the file's own bytes, and re-encoding through it strips anything
  // a polyglot file smuggled in alongside valid image data, plus metadata.
  let format: string;
  let outputBuffer: Buffer;
  try {
    const image = sharp(rawBuffer, { animated: true });
    const metadata = await image.metadata();
    format = metadata.format ?? "";
    if (!EXT_BY_FORMAT[format]) {
      return NextResponse.json(
        { error: "Nepodporovaný typ souboru — povoleny jsou JPEG, PNG, WebP, GIF." },
        { status: 400 },
      );
    }
    outputBuffer = await image.toFormat(format as keyof FormatEnum).toBuffer();
  } catch {
    return NextResponse.json({ error: "Soubor není platný obrázek." }, { status: 400 });
  }

  const ext = EXT_BY_FORMAT[format];
  const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha1").update(outputBuffer).digest("hex").slice(0, 12);
  const filename = `${Date.now()}-${hash}.${ext}`;
  await writeFile(path.join(dir, filename), outputBuffer);

  const url = `/uploads/products/${encodeURIComponent(product.code)}/${filename}`;
  const maxSortOrder = await prisma.productImage.aggregate({
    where: { productId: id },
    _max: { sortOrder: true },
  });

  const image = await prisma.productImage.create({
    data: { productId: id, url, sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1 },
  });

  return NextResponse.json({ image });
}
