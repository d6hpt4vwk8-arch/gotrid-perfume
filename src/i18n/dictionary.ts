import type { Dict } from "./tr";

/** The UI-string dictionary for a locale (Czech renders as written, so its dictionary is empty). */
export async function loadDictionary(locale: string): Promise<Dict> {
  if (locale !== "sk") return {};
  return (await import("../../messages/sk.json")).default as Dict;
}
