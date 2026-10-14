// Tiny UI-string translator. Source strings in the code are Czech and double
// as the dictionary key; messages/sk.json maps them to Slovak (messages/cs.json
// is empty, so Czech renders as written). Missing keys fall back to the Czech
// source — the shop never shows a blank or a raw key.
//
// Interpolation: write "{name}" in the key and pass { name } as vars.
export type Dict = Record<string, string>;
export type Tr = (key: string, vars?: Record<string, string | number>) => string;

// Server messages that embed runtime values (product names, amounts) can't be
// looked up verbatim; these patterns map them back to a templated dictionary key.
const DYNAMIC_MESSAGES: { re: RegExp; key: string; vars: string[] }[] = [
  { re: /^Slevový kód platí od objednávky (.+) Kč\.$/, key: "Slevový kód platí od objednávky {amount} Kč.", vars: ["amount"] },
  { re: /^Produkt "(.+)" není skladem v požadovaném množství\.$/, key: 'Produkt "{name}" není skladem v požadovaném množství.', vars: ["name"] },
  { re: /^Produkt "(.+)" mezitím vyprodán\.$/, key: 'Produkt "{name}" mezitím vyprodán.', vars: ["name"] },
  { re: /^Dárek "(.+)" mezitím vyprodán, zvolte prosím jiný\.$/, key: 'Dárek "{name}" mezitím vyprodán, zvolte prosím jiný.', vars: ["name"] },
  { re: /^Dobírka není dostupná pro objednávky nad (.+) Kč, zvolte prosím jiný způsob platby\.$/, key: "Dobírka není dostupná pro objednávky nad {amount} Kč, zvolte prosím jiný způsob platby.", vars: ["amount"] },
  { re: /^Produkt (.+) už není dostupný\.$/, key: "Produkt {name} už není dostupný.", vars: ["name"] },
];

export function makeTr(dict: Dict): Tr {
  return (key, vars) => {
    if (!vars && !(key in dict)) {
      for (const p of DYNAMIC_MESSAGES) {
        const m = key.match(p.re);
        if (m && dict[p.key]) {
          const v: Record<string, string> = {};
          p.vars.forEach((name, i) => (v[name] = m[i + 1]!));
          return dict[p.key]!.replace(/\{(\w+)\}/g, (x, n: string) => v[n] ?? x);
        }
      }
    }
    const text = dict[key] ?? key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in vars ? String(vars[name]) : m,
    );
  };
}
