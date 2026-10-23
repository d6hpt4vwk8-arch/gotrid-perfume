import Image from "next/image";

/**
 * Footer payment marks required by Comgate's merchant terms: the Comgate logo (linked to comgate.eu) with the Visa
 * and Mastercard marks underneath. Official files from Comgate's logo kit (help.comgate.eu → "Loga a informace na
 * webu"), white variants because the footer is dark.
 */
export function ComgateBadges() {
  return (
    <div className="flex flex-col items-start gap-3" aria-label="Platby zajišťuje Comgate: Visa, Mastercard">
      <a href="https://www.comgate.eu/cs/platebni-brana" target="_blank" rel="noopener noreferrer" title="Comgate – platební brána">
        <Image src="/payments/comgate-white.svg" alt="Comgate" width={156} height={36} unoptimized className="h-9 w-auto" />
      </a>
      <div className="flex items-center gap-4">
        <Image src="/payments/visa-white.svg" alt="Visa" width={52} height={17} unoptimized className="h-5 w-auto" />
        <Image src="/payments/mastercard.svg" alt="Mastercard" width={38} height={24} unoptimized className="h-6 w-auto" />
      </div>
    </div>
  );
}
