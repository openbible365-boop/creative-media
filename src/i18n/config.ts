import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "zh", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`@/messages/${locale}/common.json`)).default,
}));
