import { getTr } from "@/i18n/tr.server";
import { Link } from "@/i18n/navigation";

export default async function ShopNotFound() {
  const tr = await getTr();
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="text-sm font-semibold tracking-wide text-accent-2 uppercase">404</span>
      <h1 className="text-2xl font-bold text-ink">{tr("Stránku jsme nenašli")}</h1>
      <p className="text-accent-2">
        {tr("Produkt nebo kategorie, kterou hledáte, už možná neexistuje nebo byla přesunuta.")}
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          href="/"
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
        >
          {tr("Zpět na úvod")}
        </Link>
        <Link
          href="/hledat"
          className="rounded-sm border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
        >
          {tr("Vyhledat produkt")}
        </Link>
      </div>
    </main>
  );
}
