import Link from "next/link";
import type { ReactNode } from "react";

export function OAuthLoginButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2.5 rounded-sm border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      {label}
    </Link>
  );
}
