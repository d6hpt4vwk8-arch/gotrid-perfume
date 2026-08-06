import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Gotrid Perfume — originální značková parfumerie",
  description:
    "Originální brandová parfumerie, kosmetika a péče za poctivou cenu, bez maloobchodní přirážky.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
