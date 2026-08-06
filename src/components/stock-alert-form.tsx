"use client";

import { useState } from "react";

export function StockAlertForm({ productId }: { productId: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "done") {
    return (
      <p className="text-sm text-green-700">
        Díky! Ozveme se e-mailem, jakmile bude produkt skladem.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("submitting");
        setError(null);
        try {
          const res = await fetch("/api/stock-alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, email }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "Nepodařilo se uložit e-mail.");
            setStatus("error");
            return;
          }
          setStatus("done");
        } catch {
          setError("Nepodařilo se uložit e-mail.");
          setStatus("error");
        }
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-sm text-neutral-600">Chcete vědět, až bude opět skladem?</p>
      <div className="flex gap-2">
        <input
          required
          type="email"
          placeholder="Váš e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-md border border-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" ? "Odesílám…" : "Upozornit mě"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
