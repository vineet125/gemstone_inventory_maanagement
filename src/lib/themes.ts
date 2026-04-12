export type ColorTheme = "amber" | "blue" | "green" | "purple" | "rose" | "teal" | "indigo";
export type ColorMode = "light" | "dark";

export interface ThemeConfig {
  label: string;
  hex: string;
  // HSL triplet strings for light and dark primary
  light: string;
  dark: string;
}

export const COLOR_THEMES: Record<ColorTheme, ThemeConfig> = {
  amber:  { label: "Amber",   hex: "#c2710c", light: "30 80% 45%",  dark: "30 80% 55%" },
  blue:   { label: "Blue",    hex: "#2563eb", light: "217 91% 45%", dark: "217 91% 60%" },
  green:  { label: "Green",   hex: "#16a34a", light: "142 76% 36%", dark: "142 76% 50%" },
  purple: { label: "Purple",  hex: "#9333ea", light: "270 70% 50%", dark: "270 70% 65%" },
  rose:   { label: "Rose",    hex: "#e11d48", light: "346 84% 46%", dark: "346 84% 60%" },
  teal:   { label: "Teal",    hex: "#0d9488", light: "173 80% 36%", dark: "173 80% 50%" },
  indigo: { label: "Indigo",  hex: "#4f46e5", light: "239 84% 55%", dark: "239 84% 68%" },
};

export const DEFAULT_COLOR: ColorTheme = "amber";
export const DEFAULT_MODE: ColorMode = "light";

export function applyTheme(color: ColorTheme, mode: ColorMode) {
  const root = document.documentElement;
  const cfg = COLOR_THEMES[color];
  const primary = mode === "dark" ? cfg.dark : cfg.light;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);

  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
