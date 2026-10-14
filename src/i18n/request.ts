import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// UI strings are NOT passed through next-intl's messages (its validator
// rejects flat keys containing "." — our keys are whole Czech sentences);
// they live in messages/<locale>.json and are served by src/i18n/tr*.ts.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: {} };
});
