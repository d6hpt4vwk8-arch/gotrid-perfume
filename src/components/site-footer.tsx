import Link from "next/link";

const INFO_LINKS = [
  { href: "/o-nas", label: "O nás" },
  { href: "/garance-originality-produktu", label: "Garance originality produktů" },
  { href: "/doprava-a-platba", label: "Doprava a platba" },
  { href: "/obchodni-podminky", label: "Obchodní podmínky" },
  { href: "/podminky-vraceni-zbozi", label: "Podmínky vrácení zboží" },
  { href: "/podminky-ochrany-osobnich-udaju", label: "Ochrana osobních údajů" },
  { href: "/kontakty", label: "Kontakty" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Garance originality</h3>
          <p className="mt-2 text-sm text-white/65">
            Veškeré produkty jsou 100% originální značkové zboží, nakupované přímo od
            distributorů — žádné kopie, žádné padělky.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Informace</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-white/65">
            {INFO_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Kontakt</h3>
          <p className="mt-2 text-sm text-white/65">
            Pavlo Hrytsan, IČO 19296037
            <br />
            Na Jarově 2425/4, 130 00 Praha 3
            <br />
            <a href="mailto:pavlohrytsan@gmail.com" className="hover:text-white hover:underline">
              pavlohrytsan@gmail.com
            </a>
            <br />
            +420 735 583 527
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Gotrid Perfume
      </div>
    </footer>
  );
}
