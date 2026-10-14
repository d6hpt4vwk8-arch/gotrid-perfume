import { Link } from "@/i18n/navigation";
import { getTr } from "@/i18n/tr.server";

export async function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  const tr = await getTr();
  return (
    <nav aria-label={tr("Drobečková navigace")} className="flex flex-wrap items-center gap-1.5 text-xs text-accent-2">
      <Link href="/" className="hover:text-ink hover:underline">
        {tr("Domů")}
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span aria-hidden>/</span>
          {item.href ? (
            <Link href={item.href} className="hover:text-ink hover:underline">
              {item.name}
            </Link>
          ) : (
            <span className="text-ink" aria-current="page">
              {item.name}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
