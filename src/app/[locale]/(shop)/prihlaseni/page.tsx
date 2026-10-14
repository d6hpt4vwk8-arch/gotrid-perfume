"use client";

import { useTr, useIsSk } from "@/i18n/use-tr";
import { Link } from "@/i18n/navigation";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { OAuthLoginButton } from "@/components/oauth-login-button";
import { SeznamIcon, FacebookIcon } from "@/components/oauth-icons";

function LoginForm() {
  const tr = useTr();
  const isSk = useIsSk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const oauthError = searchParams.get("error");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nextParam = searchParams.get("next");
  const seznamHref = `/api/auth/seznam${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;
  const facebookHref = `/api/auth/facebook${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;

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
        setError(tr(data.error ?? "Přihlášení se nezdařilo."));
        setSubmitting(false);
        return;
      }
      router.push(getSafeRedirectPath(searchParams.get("next"), "/muj-ucet"));
      router.refresh();
    } catch {
      setError(tr("Přihlášení se nezdařilo, zkuste to prosím znovu."));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold text-ink">{tr("Přihlášení")}</h1>
      <p className="text-sm text-accent-2">
        {tr("Nemáte účet?")}{" "}
        <Link href="/registrace" className="text-ink underline hover:text-accent">
          {tr("Zaregistrujte se")}
        </Link>
        .
      </p>
      {oauthError && <p className="text-sm text-red-600">{tr(oauthError)}</p>}
      <div className="flex flex-col gap-2">
        {!isSk && <OAuthLoginButton href={seznamHref} icon={<SeznamIcon className="h-5 w-5" />} label={tr("Přihlásit se přes Seznam")} />}
        <OAuthLoginButton href={facebookHref} icon={<FacebookIcon className="h-5 w-5" />} label={tr("Přihlásit se přes Facebook")} />
      </div>
      <div className="flex items-center gap-3 text-xs text-accent-2">
        <span className="h-px flex-1 bg-line" />
        {tr("nebo e-mailem")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          type="email"
          autoFocus
          placeholder={tr("E-mail")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        <input
          required
          type="password"
          placeholder={tr("Heslo")}
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
          {submitting ? tr("Přihlašuji…") : tr("Přihlásit se")}
        </button>
      </form>
      <Link href="/zapomenute-heslo" className="text-sm text-accent-2 hover:text-accent hover:underline">
        {tr("Zapomenuté heslo?")}
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
