"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  ColorTheme, ColorMode, DEFAULT_COLOR, DEFAULT_MODE, applyTheme,
} from "@/lib/themes";

interface ThemeContextValue {
  colorTheme: ColorTheme;
  mode: ColorMode;
  setColorTheme: (t: ColorTheme) => void;
  setMode: (m: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorTheme: DEFAULT_COLOR,
  mode: DEFAULT_MODE,
  setColorTheme: () => {},
  setMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(DEFAULT_COLOR);
  const [mode, setModeState] = useState<ColorMode>(DEFAULT_MODE);

  // Load from localStorage on mount
  useEffect(() => {
    const savedColor = (localStorage.getItem("gs-color") as ColorTheme) || DEFAULT_COLOR;
    const savedMode = (localStorage.getItem("gs-mode") as ColorMode) || DEFAULT_MODE;
    setColorThemeState(savedColor);
    setModeState(savedMode);
    applyTheme(savedColor, savedMode);
  }, []);

  function setColorTheme(t: ColorTheme) {
    setColorThemeState(t);
    localStorage.setItem("gs-color", t);
    applyTheme(t, mode);
  }

  function setMode(m: ColorMode) {
    setModeState(m);
    localStorage.setItem("gs-mode", m);
    applyTheme(colorTheme, m);
  }

  return (
    <ThemeContext.Provider value={{ colorTheme, mode, setColorTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
