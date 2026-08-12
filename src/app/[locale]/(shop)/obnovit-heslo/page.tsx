"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-20">
        <h1 className="text-2xl font-bold text-ink">Neplatný odkaz</h1>
        <p className="text-sm text-accent-2">
          Odkaz pro obnovení hesla chybí nebo je neplatný.
        </p>
        <Link href="/zapomenute-heslo" className="text-sm text-ink underline hover:text-accent">
          Požádat o nový odkaz
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Heslo se nepodařilo nastavit.");
        setSubmitting(false);
        return;
      }
      router.push("/muj-ucet");
      router.refresh();
    } catch {
      setError("Heslo se nepodařilo nastavit, zkuste to prosím znovu.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold text-ink">Nové heslo</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          type="password"
          autoFocus
          placeholder="Nové heslo (alespoň 8 znaků)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
        >
          {submitting ? "Ukládám…" : "Nastavit heslo"}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
