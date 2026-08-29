import { buildWhatsappHref } from "@/lib/whatsapp";

export function WhatsappAdviceButton({ message, label }: { message: string; label: string }) {
  return (
    <a
      href={buildWhatsappHref(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit items-center gap-2.5 rounded-sm bg-[#25D366] px-5 py-3 text-sm font-semibold text-[#0b2f1c] transition hover:bg-[#20bd5a]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0b2f1c" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.87 9.87 0 0 0 4.62 1.15h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.05c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.06.27-3.56-.75-2.99-1.24-4.87-4.26-5.02-4.46-.14-.2-1.2-1.6-1.2-3.05 0-1.46.76-2.17 1.03-2.47.27-.3.6-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.6.83 2.05.9 2.2.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.17-.2.73-.85.93-1.14.2-.3.4-.24.66-.15.27.1 1.7.8 2 .95.28.14.47.21.54.33.07.13.07.72-.17 1.4Z" />
      </svg>
      {label}
    </a>
  );
}
