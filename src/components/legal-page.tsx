import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <div className="prose prose-neutral max-w-none text-sm leading-relaxed text-ink/80 [&_a]:text-ink [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink [&_li]:marker:text-accent-2 [&_p]:mb-3 [&_strong]:text-ink">
        {children}
      </div>
    </main>
  );
}
