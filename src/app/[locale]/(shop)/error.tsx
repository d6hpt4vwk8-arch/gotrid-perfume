"use client";

import { useTr } from "@/i18n/use-tr";
import { Link } from "@/i18n/navigation";
import { useEffect } from "react";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tr = useTr();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="text-sm font-semibold tracking-wide text-accent-2 uppercase">{tr("Chyba")}</span>
      <h1 className="text-2xl font-bold text-ink">{tr("Něco se pokazilo")}</h1>
      <p className="text-accent-2">
        {tr("Omlouváme se, načtení stránky se nepodařilo. Zkuste to prosím znovu.")}
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
        >
          {tr("Zkusit znovu")}
        </button>
        <Link
          href="/"
          className="rounded-sm border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
        >
          {tr("Zpět na úvod")}
        </Link>
      </div>
    </main>
  );
}
