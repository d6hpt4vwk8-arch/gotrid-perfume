"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CategoryBannerManager({
  categoryId,
  bannerImage,
}: {
  categoryId: string;
  bannerImage: string | null;
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
      const res = await fetch(`/api/admin/categories/${categoryId}/banner`, {
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
      <span className="text-sm font-medium">Banner</span>

      {bannerImage && (
        <div className="relative aspect-[4/3] w-72 overflow-hidden rounded-sm border border-line bg-line">
          <Image src={bannerImage} alt="" fill sizes="288px" className="object-cover" />
        </div>
      )}

      <label className="w-fit cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm hover:border-accent-2">
        {uploading ? "Nahrávám…" : bannerImage ? "Nahradit obrázek" : "+ Přidat obrázek"}
        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
