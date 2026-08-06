import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
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
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Nepodporovaný typ souboru — povoleny jsou JPEG, PNG, WebP, GIF." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 12);
  const filename = `${Date.now()}-${hash}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);

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
