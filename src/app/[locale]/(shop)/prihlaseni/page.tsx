"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const oauthError = searchParams.get("error");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nextParam = searchParams.get("next");
  const seznamHref = `/api/auth/seznam${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Přihlášení se nezdařilo.");
        setSubmitting(false);
        return;
      }
      router.push(getSafeRedirectPath(searchParams.get("next"), "/muj-ucet"));
      router.refresh();
    } catch {
      setError("Přihlášení se nezdařilo, zkuste to prosím znovu.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold text-ink">Přihlášení</h1>
      <p className="text-sm text-accent-2">
        Nemáte účet?{" "}
        <Link href="/registrace" className="text-ink underline hover:text-accent">
          Zaregistrujte se
        </Link>
        .
      </p>
      {oauthError && <p className="text-sm text-red-600">{oauthError}</p>}
      <Link
        href={seznamHref}
        className="flex items-center justify-center gap-2 rounded-sm border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
      >
        Přihlásit se přes Seznam
      </Link>
      <div className="flex items-center gap-3 text-xs text-accent-2">
        <span className="h-px flex-1 bg-line" />
        nebo e-mailem
        <span className="h-px flex-1 bg-line" />
      </div>
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
        <input
          required
          type="password"
          placeholder="Heslo"
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
          {submitting ? "Přihlašuji…" : "Přihlásit se"}
        </button>
      </form>
      <Link href="/zapomenute-heslo" className="text-sm text-accent-2 hover:text-accent hover:underline">
        Zapomenuté heslo?
      </Link>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
