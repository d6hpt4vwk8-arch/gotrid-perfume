import Image from "next/image";

/**
 * Footer payment marks required by Comgate's merchant terms: the Comgate logo (linked to comgate.eu) plus the Visa
 * and Mastercard marks. Official files from Comgate's logo kit (help.comgate.eu → "Loga a informace na webu"), in
 * their light-background colours, each on a white tile like the carrier logos above.
 */
export function ComgateBadges() {
  return (
    <div className="flex flex-col gap-2" aria-label="Platby zajišťuje Comgate: Visa, Mastercard">
      <a
        href="https://www.comgate.eu/cs/platebni-brana"
        target="_blank"
        rel="noopener noreferrer"
        title="Comgate – platební brána"
        className="flex h-9 w-[7.5rem] items-center justify-center rounded-md bg-white px-3"
      >
        <Image src="/payments/comgate.svg" alt="Comgate" width={104} height={24} unoptimized className="h-5 w-auto" />
      </a>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-14 items-center justify-center rounded-md bg-white">
          <Image src="/payments/visa.svg" alt="Visa" width={52} height={17} unoptimized className="h-4 w-auto" />
        </span>
        <span className="flex h-9 w-14 items-center justify-center rounded-md bg-white">
          <Image src="/payments/mastercard.svg" alt="Mastercard" width={38} height={24} unoptimized className="h-6 w-auto" />
        </span>
      </div>
    </div>
  );
}
