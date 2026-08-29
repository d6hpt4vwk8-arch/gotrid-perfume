import Link from "next/link";
import { WhatsappAdviceButton } from "@/components/whatsapp-advice-button";

export function PerfumeAdviceBlock() {
  return (
    <section
      className="relative overflow-hidden rounded-sm border border-line px-6 py-10 sm:px-10 sm:py-12"
      style={{
        background:
          "radial-gradient(ellipse 60% 90% at 85% 0%, rgba(58,54,50,.06), transparent 60%), #faf8f5",
      }}
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-10">
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.3}
          className="hidden shrink-0 text-accent-2 sm:block"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 2h6M10 2v3.2a2 2 0 0 1-.4 1.2L7.6 9.6A4 4 0 0 0 6.8 12v6.5A3.5 3.5 0 0 0 10.3 22h3.4a3.5 3.5 0 0 0 3.5-3.5V12a4 4 0 0 0-.8-2.4l-2-2.8a2 2 0 0 1-.4-1.2V2"
          />
          <path strokeLinecap="round" d="M7.5 15h9" />
        </svg>

        <div className="flex flex-1 flex-col gap-2">
          <h2 className="text-lg font-bold text-ink sm:text-xl">
            Nevíte, jaký parfém vybrat?
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
            Vůni si přes obrazovku bohužel nepřivoníte — a to je u parfému to nejdůležitější.
            Napište nám na WhatsApp, jaké vůně máte rádi a na jakou příležitost parfém hledáte,
            a osobně vám doporučíme, co by vám mohlo sednout.
          </p>
        </div>

        <div className="flex w-full flex-col items-start gap-3 sm:w-auto">
          <WhatsappAdviceButton
            message="Dobrý den, chtěl(a) bych poradit s výběrem parfému."
            label="Poradit na WhatsAppu"
          />
          <Link
            href="/magazin/jak-vybrat-parfem"
            className="text-sm font-medium text-ink underline-offset-2 hover:underline"
          >
            Jak vybrat parfém →
          </Link>
        </div>
      </div>
    </section>
  );
}
