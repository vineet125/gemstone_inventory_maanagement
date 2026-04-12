"use client";

import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { COLOR_THEMES, ColorTheme } from "@/lib/themes";

export function ThemeSelector() {
  const { colorTheme, mode, setColorTheme, setMode } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-gray-100 hover:text-foreground dark:text-muted-foreground/60 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
        title="Change theme"
      >
        <span
          className="h-4 w-4 rounded-full border border-border dark:border-gray-600 flex-shrink-0"
          style={{ background: COLOR_THEMES[colorTheme].hex }}
        />
        <span>Theme</span>
        <span className="ml-auto text-xs opacity-60">{mode === "dark" ? "🌙" : "☀️"}</span>
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-20 w-52 rounded-xl border bg-card dark:bg-gray-900 dark:border-gray-700 shadow-lg p-3">
            {/* Color swatches */}
            <p className="mb-2 text-xs font-medium text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-wide">Color</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setColorTheme(key)}
                  title={cfg.label}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: cfg.hex,
                    borderColor: colorTheme === key ? cfg.hex : "transparent",
                    boxShadow: colorTheme === key ? `0 0 0 2px white, 0 0 0 4px ${cfg.hex}` : undefined,
                  }}
                />
              ))}
            </div>

            {/* Light / Dark toggle */}
            <p className="mb-2 text-xs font-medium text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-wide">Mode</p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("light")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                  mode === "light"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border dark:border-gray-700 text-muted-foreground dark:text-muted-foreground/60 hover:bg-accent dark:hover:bg-gray-800"
                }`}
              >
                ☀️ Light
              </button>
              <button
                onClick={() => setMode("dark")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                  mode === "dark"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border dark:border-gray-700 text-muted-foreground dark:text-muted-foreground/60 hover:bg-accent dark:hover:bg-gray-800"
                }`}
              >
                🌙 Dark
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
