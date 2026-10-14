import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { loadDictionary } from "@/i18n/dictionary";
import { TrProvider } from "@/i18n/tr-provider";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const dict = await loadDictionary(locale);

  return (
    <NextIntlClientProvider>
      <TrProvider dict={dict}>{children}</TrProvider>
    </NextIntlClientProvider>
  );
}
