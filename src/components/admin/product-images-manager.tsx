"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProductImage, moveProductImage } from "@/lib/admin/actions/product-images";

interface ProductImageData {
  id: string;
  url: string;
}

export function ProductImagesManager({
  productId,
  images,
}: {
  productId: string;
  images: ProductImageData[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nahrání se nezdařilo.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Nahrání se nezdařilo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Obrázky</span>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((img, i) => (
            <div key={img.id} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-sm border border-line bg-line">
                <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
              </div>
              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveProductImage(img.id, "up").then(() => router.refresh())}
                  className="disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === images.length - 1}
                  onClick={() => moveProductImage(img.id, "down").then(() => router.refresh())}
                  className="disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Smazat tento obrázek?")) {
                      deleteProductImage(img.id).then(() => router.refresh());
                    }
                  }}
                  className="text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="w-fit cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm hover:border-accent-2">
        {uploading ? "Nahrávám…" : "+ Přidat obrázek"}
        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
