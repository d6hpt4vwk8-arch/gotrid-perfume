import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "products");
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB guard against runaway downloads

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extensionFromUrl(url: string): string | null {
  const match = /\.([a-z0-9]{2,4})(?:\?.*)?$/i.exec(url);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Downloads a comma-separated list of image URLs (TZ §6.2) and stores them
 * locally under public/uploads/products/<code>/, returning site-relative URLs
 * in the same order. Individual failures are reported but don't abort the row.
 */
export async function downloadProductImages(
  productCode: string,
  imageField: string,
): Promise<{ urls: string[]; errors: string[] }> {
  const sourceUrls = imageField
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sourceUrls.length === 0) return { urls: [], errors: [] };

  const dir = path.join(UPLOAD_ROOT, encodeURIComponent(productCode));
  await mkdir(dir, { recursive: true });

  const urls: string[] = [];
  const errors: string[] = [];

  for (const [index, sourceUrl] of sourceUrls.entries()) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push(`Obrázek ${index + 1}: nepodporované schéma URL (${parsed.protocol})`);
        continue;
      }

      const res = await fetch(parsed.toString());
      if (!res.ok || !res.body) {
        errors.push(`Obrázek ${index + 1}: stažení selhalo (HTTP ${res.status})`);
        continue;
      }

      const contentLength = Number(res.headers.get("content-length") ?? "0");
      if (contentLength > MAX_IMAGE_BYTES) {
        errors.push(`Obrázek ${index + 1}: soubor je příliš velký`);
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
        errors.push(`Obrázek ${index + 1}: soubor je příliš velký`);
        continue;
      }

      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim();
      const ext =
        (contentType && EXT_BY_CONTENT_TYPE[contentType]) ??
        extensionFromUrl(parsed.pathname) ??
        "jpg";

      const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
      const filename = `${hash}-${index}.${ext}`;
      const filePath = path.join(dir, filename);

      await writeFile(filePath, Buffer.from(arrayBuffer));

      urls.push(`/uploads/products/${encodeURIComponent(productCode)}/${filename}`);
    } catch (err) {
      errors.push(
        `Obrázek ${index + 1}: ${err instanceof Error ? err.message : "neznámá chyba"}`,
      );
    }
  }

  return { urls, errors };
}
