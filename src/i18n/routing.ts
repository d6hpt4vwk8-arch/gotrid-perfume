import { defineRouting } from "next-intl/routing";

// Phase 0 of the multi-language rollout: only "cs" is registered so
// as-needed prefixing never actually produces a prefix yet — the entire
// point of this phase is a zero-visible-change routing migration. "uk",
// "sk", "en" get added here once real translated content exists (see
// /Users/pavlogrican/.claude/plans/tidy-zooming-dewdrop.md, Phase 1).
export const routing = defineRouting({
  locales: ["cs"],
  defaultLocale: "cs",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
