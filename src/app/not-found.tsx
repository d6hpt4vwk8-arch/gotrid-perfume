import Image from "next/image";
import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Image src="/logo.svg" alt="Gotrid Perfume" width={40} height={40} />
      <span className="text-sm font-semibold tracking-wide text-accent-2 uppercase">404</span>
      <h1 className="text-2xl font-bold text-ink">Stránku jsme nenašli</h1>
      <p className="text-accent-2">Odkaz je neplatný nebo stránka byla přesunuta.</p>
      <Link
        href="/"
        className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
      >
        Zpět na úvod
      </Link>
    </main>
  );
}
