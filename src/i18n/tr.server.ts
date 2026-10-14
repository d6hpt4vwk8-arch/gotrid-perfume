import { getLocale } from "next-intl/server";
import { loadDictionary } from "./dictionary";
import { makeTr, type Tr } from "./tr";

/** Translator for server components — see tr.ts. */
export async function getTr(): Promise<Tr> {
  return makeTr(await loadDictionary(await getLocale()));
}

export async function getCurrentLocale(): Promise<"cs" | "sk"> {
  return (await getLocale()) === "sk" ? "sk" : "cs";
}
