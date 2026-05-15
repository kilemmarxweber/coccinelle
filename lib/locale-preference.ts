export const LOCALE_STORAGE_KEY = "smart-church-locale";

export const LOCALE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
] as const;

export type LocalePreference = (typeof LOCALE_OPTIONS)[number]["value"];

export function readLocalePreference(): LocalePreference {
  if (typeof window === "undefined") return "fr";
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "en" ? "en" : "fr";
}

export function writeLocalePreference(locale: LocalePreference) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
