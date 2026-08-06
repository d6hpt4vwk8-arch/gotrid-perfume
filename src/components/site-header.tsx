import Image from "next/image";
import Link from "next/link";
import { getCategoryNavTree } from "@/lib/categories.server";
import { SearchBar } from "@/components/search-bar";
import { CartIconLink } from "@/components/cart-icon-link";
import { WishlistIconLink } from "@/components/wishlist-icon-link";
import { getCurrentCustomerId } from "@/lib/customer/get-current-customer";

export async function SiteHeader() {
  const [categories, customerId] = await Promise.all([
    getCategoryNavTree(),
    getCurrentCustomerId(),
  ]);

  return (
    <header className="sticky inset-x-0 top-0 z-30 w-full bg-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:gap-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt="Gotrid Perfume"
            width={40}
            height={40}
            className="brightness-0 invert"
          />
          <span className="text-base font-semibold tracking-tight text-white">
            Gotrid Perfume
          </span>
        </Link>

        <div className="order-3 w-full sm:order-2 sm:w-auto sm:max-w-70 sm:flex-1">
          <SearchBar dark />
        </div>

        <div className="order-2 ml-auto flex items-center gap-4 text-white sm:order-3">
          <Link
            href={customerId ? "/muj-ucet" : "/prihlaseni"}
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-5 w-5"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 21v-1.5a3.75 3.75 0 0 0-3.75-3.75h-3A3.75 3.75 0 0 0 6.75 19.5V21M15 8.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
            <span className="hidden sm:inline">{customerId ? "Můj účet" : "Přihlásit se"}</span>
          </Link>
          <WishlistIconLink />
          <CartIconLink />
        </div>

        <nav className="order-4 flex w-full flex-nowrap gap-x-5 gap-y-2 overflow-x-auto border-t border-white/10 pt-3 text-sm sm:flex-wrap sm:overflow-visible">
          {categories
            .filter((c) => !c.hidden)
            .map((category) => (
              <Link
                key={category.id}
                href={`/kategorie/${category.fullSlug}`}
                className="shrink-0 font-medium text-white/70 hover:text-white"
              >
                {category.name}
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
