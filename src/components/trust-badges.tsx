const ITEMS = ["100 % originální produkty", "Vrácení zboží do 14 dnů", "Zabezpečená platba"];

export function TrustBadges() {
  return (
    <ul className="flex flex-col gap-1.5 text-xs text-accent-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
      {ITEMS.map((item) => (
        <li key={item} className="flex items-center gap-1.5">
          <span className="text-ok" aria-hidden>
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
