import Image from "next/image";
import { ApplePayMark, GooglePayMark } from "@/components/payment-icons";

/**
 * Footer payment marks required by Comgate's merchant terms: the Comgate logo (linked to comgate.eu) with the Visa
 * and Mastercard marks underneath. Official files from Comgate's logo kit (help.comgate.eu → "Loga a informace na
 * webu"), white variants because the footer is dark.
 */
export function ComgateBadges() {
  return (
    <div className="flex w-fit flex-col gap-3" aria-label="Platby zajišťuje Comgate: Visa, Mastercard, Apple Pay, Google Pay">
      <a href="https://www.comgate.eu/cs/platebni-brana" target="_blank" rel="noopener noreferrer" title="Comgate – platební brána">
        <Image src="/payments/comgate-white.svg" alt="Comgate" width={156} height={36} unoptimized className="h-11 w-auto" />
      </a>
      {/* Four equal tiles spread over exactly the width of the Comgate logo. */}
      <div className="flex items-center justify-between">
        <span className="flex h-6 w-[38px] items-center justify-center rounded-[3px] bg-[#1A1F71]">
          <Image src="/payments/visa-white.svg" alt="Visa" width={52} height={17} unoptimized className="h-auto w-[28px]" />
        </span>
        <span className="flex h-6 w-[38px] items-center justify-center rounded-[3px] bg-white">
          <Image src="/payments/mastercard.svg" alt="Mastercard" width={38} height={24} unoptimized className="h-[18px] w-auto" />
        </span>
        <ApplePayMark />
        <GooglePayMark />
      </div>
    </div>
  );
}
