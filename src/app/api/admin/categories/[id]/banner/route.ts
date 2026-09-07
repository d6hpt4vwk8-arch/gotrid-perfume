import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp, { type FormatEnum } from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Mirrors src/app/api/admin/products/[id]/images/route.ts — same
// re-encode-through-sharp defense (never trust the client's Content-Type),
// but a category has exactly one banner, so this overwrites bannerImage
// directly instead of appending to a ProductImage-style list.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const EXT_BY_FORMAT: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id }, select: { fullSlug: true } });
  if (!category) {
    return NextResponse.json({ error: "Kategorie nenalezena." }, { status: 404 });
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
    outputBuffer = await image.rotate().toFormat(format as keyof FormatEnum).toBuffer();
  } catch {
    return NextResponse.json({ error: "Soubor není platný obrázek." }, { status: 400 });
  }

  const ext = EXT_BY_FORMAT[format];
  const safeSlug = encodeURIComponent(category.fullSlug.replace(/\//g, "-"));
  const dir = path.join(process.cwd(), "public", "uploads", "categories");
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha1").update(outputBuffer).digest("hex").slice(0, 12);
  const filename = `${safeSlug}-${Date.now()}-${hash}.${ext}`;
  await writeFile(path.join(dir, filename), outputBuffer);

  const url = `/uploads/categories/${filename}`;
  await prisma.category.update({ where: { id }, data: { bannerImage: url } });

  revalidatePath(`/admin/kategorie/${id}`);
  revalidatePath(`/kategorie/${category.fullSlug}`);

  return NextResponse.json({ url });
}
