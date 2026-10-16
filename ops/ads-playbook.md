# Reklama: pravidla (Heureka + Zboží.cz/Sklik)

Zavedeno 2026-10-16. Cíl: nekupovat reklamu naslepo — každý kanál a každý segment musí po odečtení reklamy, nákupu a dopravy vydělávat.

## 1. Metriky a vzorce
- **Hrubý zisk** = obrat − nákupní cena × 1,21 (nejsme plátci DPH, DPH z nákupu je náklad).
- **Zisk po reklamě** = hrubý zisk − náklady na reklamu − 30 Kč/obj. (doprava + poplatky; upřesnit po prvních fakturách Zásilkovny).
- **PNO** = náklady na reklamu / obrat.
- **Konverze kliku** = objednávky / kliky.
- **Max. CPC (break-even)** = (hrubý zisk na objednávku − 30 Kč) × konverze kliku. Za klik nad touto cenou ztrácíme.

## 2. Cílové PNO
Cílové PNO segmentu = **60 % jeho hrubé marže** (zbytek je rezerva na dopravu, poplatky a chyby). Pevná hranice: PNO nad hrubou marží = ztráta.
Výchozí hodnoty (17.9.–16.10.2026): parfémy marže ≈ 7 % → cíl ≈ 4 %; kosmetika ≈ 25 % → cíl ≈ 15 %; drogerie ≈ 28 % → cíl ≈ 17 %. Přepočítává se v týdenním reportu.

## 3. Pravidla změn
1. **Max. 2 změny týdně**, vždy jen jedna změna na segment/skupinu.
2. **Vyhodnocení po 14 dnech** od změny. Dřív nic neměnit znovu.
3. **Minimální vzorek:** skupinu hodnotit až od 100 kliků; závěr o konverzi až od 8 objednávek.
4. **Krok ceny max. ±20 %** najednou.
5. **Pozastavit** skupinu jen po 100 klicích bez objednávky, nebo když PNO > hrubá marže dva týdny po sobě.
6. **Rozpočet nezvyšovat**, dokud kanál není 2 týdny po sobě v kladném zisku po reklamě.
7. **Po změně feedu nebo cen** (hromadná úprava, přepočet marží) 7 dní nic na reklamě neměnit.
8. **Každou změnu zapsat** do `ops/ads/change-log.md` (datum, kanál, skupina, změna, hypotéza, datum vyhodnocení).
9. Listopad–prosinec: sezónní nárůst — žádná velká změna bez porovnání s předchozím týdnem.

## 4. Týdenní rutina (pondělí)
1. Heureka → Statistiky → rozklad po kategoriích (kliky, Ø CPC); Sklik → Produktové skupiny (kliky, náklady, konverze). Údaje zapsat do `ops/ads/costs-<od>_<do>.json` (vzor je v repu).
2. `npx tsx --env-file=.env scripts/ads-weekly-report.ts ops/ads/costs-<od>_<do>.json` → vznikne `ops/reports/ads-<do>.md`.
3. Porovnat PNO s cílem a CPC s max. CPC, rozhodnout max. 2 změny, zapsat do change-logu.

## 5. Kanály
- **Heureka** (ověřený obchod): jen úprava nabídek CPC po kategoriích a Marketplace (nutné mít zboží skladem). Měření konverzí zatím nezapisuje objednávky (viz níže) — pravdu o prodejích bereme z naší DB (zdroj objednávky z referreru).
- **Zboží.cz / Sklik:** produktové skupiny podle ceny/kategorie, max. CPC na skupinu; konverze měří Seznam.

## 6. Otevřené problémy
- Heureka měření konverzí ukazuje 0 objednávek. Kód a klíč jsou v pořádku, skript se po souhlasu načte; zbývá souhlas s cookies (analytické) a ověření skutečným testovacím nákupem přes Heureku.
- Zboží: objednávky podle našeho referreru (19) ≠ konverze podle Sklik (13). Pro Zboží brát konverze ze Skliku, pro Heureku z naší DB.
