"use client";

import { createContext, useMemo, type ReactNode } from "react";
import { makeTr, type Dict, type Tr } from "./tr";

export const TrContext = createContext<Tr>(makeTr({}));

/** Hands the locale's UI dictionary (loaded on the server) to client components via useTr(). */
export function TrProvider({ dict, children }: { dict: Dict; children: ReactNode }) {
  const tr = useMemo(() => makeTr(dict), [dict]);
  return <TrContext.Provider value={tr}>{children}</TrContext.Provider>;
}
