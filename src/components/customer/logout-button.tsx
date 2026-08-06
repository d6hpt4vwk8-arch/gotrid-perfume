"use client";

import { useRouter } from "next/navigation";

export function CustomerLogoutButton() {
  const router = useRouter();

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
      Odhlásit se
    </button>
  );
}
