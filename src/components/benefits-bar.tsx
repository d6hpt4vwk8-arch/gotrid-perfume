import { getSettings } from "@/lib/settings.server";
import { formatPrice } from "@/lib/format";
import { BenefitsRotator } from "@/components/benefits-rotator";

export async function BenefitsBar() {
  const settings = await getSettings();

  const items = [
    `Doprava zdarma od ${formatPrice(settings.freeShippingThreshold)}`,
    "Doručení do 2–3 pracovních dnů",
    "100 % originální produkty",
  ];

  return (
    <div className="bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-1.5">
        <BenefitsRotator items={items} />
      </div>
    </div>
  );
}
