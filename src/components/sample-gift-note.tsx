import Image from "next/image";
import { getTr } from "@/i18n/tr.server";
import { getGiftTriggersForProducts, getSampleGiftOptions } from "@/lib/gifts.server";

/**
 * "Dárek k nákupu" strip on a product page: shown for K-beauty and Arabic perfume
 * products (the carts that unlock a free sample, see sample-gifts.ts). Lists the
 * samples currently on offer with photos but never how many are left (owner's call).
 */
export async function SampleGiftNote({ productId }: { productId: string }) {
  const gifts = await getSampleGiftOptions(await getGiftTriggersForProducts([productId]));
  if (gifts.length === 0) return null;
  const tr = await getTr();

  return (
    <div className="flex max-w-md flex-col gap-2 rounded-sm border border-ok/40 bg-ok/5 p-3">
      <p className="text-sm font-semibold text-ink">🎁 {tr("K nákupu dárek zdarma")}</p>
      <p className="text-sm text-accent-2">
        {tr("Přidejte produkt do košíku a vyberte si jeden vzorek zdarma — bez minimální hodnoty objednávky.")}
      </p>
      <ul className="flex flex-wrap gap-3">
        {gifts.map((gift) => (
          <li key={gift.productId} className="flex w-20 flex-col items-center gap-1 text-center">
            {gift.image && (
              <span className="relative h-16 w-16 overflow-hidden rounded-sm bg-line/60">
                <Image src={gift.image} alt={gift.name} fill sizes="64px" className="object-cover" />
              </span>
            )}
            <span className="text-[11px] leading-tight text-ink">{gift.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
