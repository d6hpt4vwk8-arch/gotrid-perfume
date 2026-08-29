// Same number published in the footer and on /kontakty.
export const WHATSAPP_NUMBER = "420735583527";

export function buildWhatsappHref(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
