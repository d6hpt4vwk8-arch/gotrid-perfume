"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Něco se nepodařilo, zkuste to prosím znovu.");
        setSubmitting(false);
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Něco se nepodařilo, zkuste to prosím znovu.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold text-ink">Zapomenuté heslo</h1>

      {message ? (
        <p className="text-sm text-ok">{message}</p>
      ) : (
        <>
          <p className="text-sm text-accent-2">
            Zadejte e-mail, na který jsme vám poslali odkaz pro nastavení nového hesla.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              required
              type="email"
              autoFocus
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
            >
              {submitting ? "Odesílám…" : "Odeslat odkaz"}
            </button>
          </form>
        </>
      )}

      <Link href="/prihlaseni" className="text-sm text-accent-2 hover:text-accent hover:underline">
        Zpět na přihlášení
      </Link>
    </main>
  );
}
