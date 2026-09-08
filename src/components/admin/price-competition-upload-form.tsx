"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PriceCompetitionUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("periodLabel", periodLabel);
      const res = await fetch("/api/admin/price-competition/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import se nezdařil.");
      } else {
        setFile(null);
        setPeriodLabel("");
        router.refresh();
      }
    } catch {
      setError("Import se nezdařil, zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-accent-2">
          CSV report („Statistiky položek (podrobný)“ ze Sklik/Centrum prodejce)
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-accent-2">Období (nepovinné)</label>
        <input
          type="text"
          value={periodLabel}
          onChange={(e) => setPeriodLabel(e.target.value)}
          placeholder="např. 27.08.–31.08.2026"
          className="rounded-sm border border-line px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={!file || submitting}
        className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:bg-accent-2"
      >
        {submitting ? "Nahrávám…" : "Nahrát report"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
