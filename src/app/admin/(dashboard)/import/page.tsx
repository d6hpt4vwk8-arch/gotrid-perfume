"use client";

import { useState } from "react";

interface ImportReport {
  created: number;
  updated: number;
  errors: { row: number; code?: string; message: string }[];
}

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setReport(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import se nezdařil.");
      } else {
        setReport(data);
      }
    } catch {
      setError("Import se nezdařil, zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Import XLSX</h1>
      <p className="text-sm text-accent-2">
        Formát sloupců: code, pairCode, name, ean, manufacturer, purchasePrice, price, vatRate,
        description, image, categoryText, filteringProperty:Značka, stock. Upsert probíhá podle{" "}
        <code>code</code>.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || submitting}
          className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:bg-accent-2"
        >
          {submitting ? "Importuji…" : "Nahrát a importovat"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        <div className="rounded-sm border border-line bg-white p-4 text-sm">
          <p>Vytvořeno: {report.created}</p>
          <p>Aktualizováno: {report.updated}</p>
          <p>Chyby/varování: {report.errors.length}</p>
          {report.errors.length > 0 && (
            <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-xs text-accent-2">
              {report.errors.map((err, i) => (
                <li key={i}>
                  Řádek {err.row} ({err.code ?? "-"}): {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
