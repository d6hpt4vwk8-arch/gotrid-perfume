"use client";

import { useTr } from "@/i18n/use-tr";
import { useState } from "react";

export function NewsletterSignup() {
  const tr = useTr();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="border-t border-line bg-[#faf8f5]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-4">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="hidden shrink-0 text-accent-2 sm:block"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
          </svg>
          <div>
            <h2 className="text-lg font-bold text-ink">{tr("Nenechte si ujít novinky")}</h2>
            <p className="text-sm text-ink/70">
              {tr("Přihlaste se k odběru a jako první se dozvíte o novinkách a slevách.")}
            </p>
          </div>
        </div>

        {status === "done" ? (
          <p className="text-sm font-medium text-ok">{tr("Děkujeme, jste přihlášeni k odběru!")}</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setStatus("submitting");
              setError(null);
              try {
                const res = await fetch("/api/newsletter/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(tr(data.error ?? "Nepodařilo se přihlásit k odběru."));
                  setStatus("error");
                  return;
                }
                setStatus("done");
              } catch {
                setError(tr("Nepodařilo se přihlásit k odběru."));
                setStatus("error");
              }
            }}
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <input
              required
              type="email"
              placeholder={tr("Váš e-mail")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-sm border border-line bg-white px-3 py-2.5 text-sm text-ink"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="shrink-0 rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? tr("Odesílám…") : tr("Odebírat zpravodaj")}
            </button>
          </form>
        )}
      </div>
      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </section>
  );
}
