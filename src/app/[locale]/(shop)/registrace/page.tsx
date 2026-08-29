"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OAuthLoginButton } from "@/components/oauth-login-button";
import { SeznamIcon, FacebookIcon } from "@/components/oauth-icons";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone: phone || undefined,
          marketingOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registraci se nepodařilo dokončit.");
        setSubmitting(false);
        return;
      }
      router.push("/muj-ucet");
      router.refresh();
    } catch {
      setError("Registraci se nepodařilo dokončit, zkuste to prosím znovu.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold text-ink">Vytvořit účet</h1>
      <p className="text-sm text-accent-2">
        Nakupovat můžete i bez registrace jako host.{" "}
        <Link href="/prihlaseni" className="text-ink underline hover:text-accent">
          Už máte účet? Přihlaste se
        </Link>
        .
      </p>
      <div className="flex flex-col gap-2">
        <OAuthLoginButton href="/api/auth/seznam" icon={<SeznamIcon className="h-5 w-5" />} label="Pokračovat přes Seznam" />
        <OAuthLoginButton href="/api/auth/facebook" icon={<FacebookIcon className="h-5 w-5" />} label="Pokračovat přes Facebook" />
      </div>
      <div className="flex items-center gap-3 text-xs text-accent-2">
        <span className="h-px flex-1 bg-line" />
        nebo e-mailem
        <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            required
            placeholder="Jméno"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
          />
          <input
            required
            placeholder="Příjmení"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
          />
        </div>
        <input
          required
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        <input
          type="tel"
          placeholder="Telefon (nepovinné)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        <input
          required
          type="password"
          placeholder="Heslo (alespoň 8 znaků)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        <label className="flex items-start gap-2 text-sm text-accent-2">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5"
          />
          Chci dostávat novinky a slevy e-mailem.
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
        >
          {submitting ? "Vytvářím účet…" : "Vytvořit účet"}
        </button>
      </form>
    </main>
  );
}
