"use client";

import { useTr } from "@/i18n/use-tr";
import { useRouter } from "@/i18n/navigation";

export function CustomerLogoutButton() {
  const router = useRouter();
  const tr = useTr();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/customer/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-sm text-accent-2 underline hover:text-accent"
    >
      {tr("Odhlásit se")}
    </button>
  );
}
