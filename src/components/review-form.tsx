"use client";

import { useState } from "react";
import { StarRatingInput } from "@/components/star-rating-input";

export function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "done") {
    return (
      <p className="text-sm text-ok">
        Děkujeme za recenzi! Zobrazí se po schválení.
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
          const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, rating, authorName, text }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "Recenzi se nepodařilo odeslat.");
            setStatus("error");
            return;
          }
          setStatus("done");
        } catch {
          setError("Recenzi se nepodařilo odeslat, zkuste to prosím znovu.");
          setStatus("error");
        }
      }}
      className="flex flex-col gap-3 border border-line p-4"
    >
      <span className="text-sm font-semibold text-ink">Napsat recenzi</span>

      <div className="flex flex-col gap-1 text-sm text-ink">
        Hodnocení
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Jméno (nepovinné)
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={100}
          className="rounded-sm border border-line px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Recenze (nepovinná)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={3}
          className="rounded-sm border border-line px-2 py-1.5 text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-fit rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
      >
        {status === "submitting" ? "Odesílám…" : "Odeslat recenzi"}
      </button>
    </form>
  );
}
