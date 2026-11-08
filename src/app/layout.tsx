import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "next-intl/server";
import { SEO_URL } from "@/lib/site";
import { ogMeta } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Storefront reads live stock/prices from Postgres on every request (no ISR
// yet) — force-dynamic avoids Next attempting to prerender pages at build
// time, which would require a reachable database during `next build`.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const sk = (await getLocale()) === "sk";
  const title = sk ? "Gotrid Perfume — originálna značková parfumeria" : "Gotrid Perfume — originální značková parfumerie";
  const description = sk
    ? "Originálna značková parfuméria, kozmetika a starostlivosť za poctivú cenu, bez maloobchodnej prirážky."
    : "Originální brandová parfumerie, kosmetika a péče za poctivou cenu, bez maloobchodní přirážky.";
  return {
    // Resolves relative canonical/Open Graph URLs against the public (www) host.
    metadataBase: new URL(SEO_URL),
    title,
    description,
    // Default share card for pages that don't set their own (legal pages, cart, …).
    ...ogMeta({ title, description, path: sk ? "/sk" : "/", locale: sk ? "sk" : "cs" }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Root-level routes (admin, 404) have no locale segment; next-intl falls
  // back to the default locale there.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
