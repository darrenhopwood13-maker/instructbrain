export const LANGUAGES = [
  { code: "en", label: "EN", native: "English" },
  { code: "Spanish", label: "ES", native: "Español" },
  { code: "French", label: "FR", native: "Français" },
  { code: "German", label: "DE", native: "Deutsch" },
  { code: "Italian", label: "IT", native: "Italiano" },
  { code: "Portuguese", label: "PT", native: "Português" },
  { code: "Dutch", label: "NL", native: "Nederlands" },
  { code: "Polish", label: "PL", native: "Polski" },
  { code: "Romanian", label: "RO", native: "Română" },
  { code: "Russian", label: "RU", native: "Русский" },
  { code: "Ukrainian", label: "UK", native: "Українська" },
  { code: "Turkish", label: "TR", native: "Türkçe" },
  { code: "Arabic", label: "AR", native: "العربية" },
  { code: "Hebrew", label: "HE", native: "עברית" },
  { code: "Chinese", label: "ZH", native: "中文" },
  { code: "Japanese", label: "JA", native: "日本語" },
  { code: "Korean", label: "KO", native: "한국어" },
  { code: "Hindi", label: "HI", native: "हिन्दी" },
  { code: "Bengali", label: "BN", native: "বাংলা" },
  { code: "Vietnamese", label: "VI", native: "Tiếng Việt" },
  { code: "Thai", label: "TH", native: "ไทย" },
  { code: "Indonesian", label: "ID", native: "Indonesia" },
  { code: "Swedish", label: "SV", native: "Svenska" },
  { code: "Norwegian", label: "NO", native: "Norsk" },
  { code: "Danish", label: "DA", native: "Dansk" },
  { code: "Finnish", label: "FI", native: "Suomi" },
  { code: "Greek", label: "EL", native: "Ελληνικά" },
  { code: "Czech", label: "CS", native: "Čeština" },
  { code: "Bulgarian", label: "BG", native: "Български" },
  { code: "Lithuanian", label: "LT", native: "Lietuvių" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const RTL_LANGS = new Set(["Arabic", "Hebrew"]);

export function languageLabel(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.native ?? code;
}

export function langHtmlAttr(code: string): string {
  if (code === "en") return "en";
  return code.slice(0, 2).toLowerCase();
}
