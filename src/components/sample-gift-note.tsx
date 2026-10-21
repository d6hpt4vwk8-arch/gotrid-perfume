import Image from "next/image";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { getGiftTriggersForProducts, getSampleGiftOptions } from "@/lib/gifts.server";

/**
 * "Dárek zdarma" strip on a product page: shown for K-beauty and Arabic perfume
 * products (the carts that unlock a free sample, see sample-gifts.ts). A compact
 * row of overlapping sample photos; tapping it unfolds what each sample is.
 * Never shows how many are left (owner's call).
 */
export async function SampleGiftNote({ productId }: { productId: string }) {
  const gifts = await getSampleGiftOptions(await getGiftTriggersForProducts([productId]));
  if (gifts.length === 0) return null;
  const tr = await getTr();
  const isSk = (await getCurrentLocale()) === "sk";
  const withImage = gifts.filter((g) => g.image);

  return (
    <details className="group max-w-md rounded-sm border border-ok/40 bg-gradient-to-br from-ok/10 to-ok/[0.03]">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="flex shrink-0 -space-x-3">
          {withImage.slice(0, 4).map((gift) => (
            <span
              key={gift.productId}
              className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-line/60 shadow-sm"
            >
              <Image src={gift.image!} alt="" fill sizes="44px" className="object-cover" />
            </span>
          ))}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-ink">🎁 {tr("Dárek zdarma k nákupu")}</span>
          <span className="text-xs text-accent-2">
            {tr("Vyberte si 1 z {n} vzorků v košíku", { n: String(gifts.length) })}
          </span>
        </span>
        <span aria-hidden className="text-accent-2 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="flex flex-col gap-2 border-t border-ok/30 p-3">
        {gifts.map((gift) => (
          <li key={gift.productId} className="flex items-center gap-3">
            {gift.image && (
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-line/60">
                <Image src={gift.image} alt="" fill sizes="48px" className="object-cover" />
              </span>
            )}
            <span className="flex flex-col">
              <span className="text-sm text-ink">{isSk && gift.nameSk ? gift.nameSk : gift.name}</span>
              {(isSk ? gift.blurbSk ?? gift.blurb : gift.blurb) && (
                <span className="text-xs leading-snug text-accent-2">{isSk ? gift.blurbSk ?? gift.blurb : gift.blurb}</span>
              )}
            </span>
          </li>
        ))}
        <li className="text-xs text-accent-2">{tr("Bez minimální hodnoty objednávky.")}</li>
      </ul>
    </details>
  );
}
