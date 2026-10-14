"use client";

import { useContext } from "react";
import { useLocale } from "next-intl";
import { TrContext } from "./tr-provider";
import type { Tr } from "./tr";

/** Translator for client components — see tr.ts. */
export function useTr(): Tr {
  return useContext(TrContext);
}

export function useIsSk(): boolean {
  return useLocale() === "sk";
}
