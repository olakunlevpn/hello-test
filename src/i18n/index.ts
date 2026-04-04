import en from "./en";
import type { TranslationKey } from "./en";

const translations = { en } as const;
type SupportedLocale = keyof typeof translations;
const defaultLocale: SupportedLocale = "en";

export function t(key: TranslationKey, replacements?: Record<string, string>): string {
  let value: string = translations[defaultLocale][key];
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      value = value.replace(`{${k}}`, v);
    }
  }
  return value;
}

export type { TranslationKey };
