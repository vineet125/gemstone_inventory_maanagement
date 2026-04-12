"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
];

export default function CurrencySettingsPage() {
  const [defaultCurrency, setDefaultCurrency] = useState("INR");
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(["INR", "USD"]);

  useEffect(() => {
    const saved = localStorage.getItem("gemstock_currency_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.defaultCurrency) setDefaultCurrency(parsed.defaultCurrency);
        if (parsed.enabledCurrencies) setEnabledCurrencies(parsed.enabledCurrencies);
      } catch { /* ignore */ }
    }
  }, []);

  function toggleCurrency(code: string) {
    if (code === "INR") return; // INR always enabled
    setEnabledCurrencies((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleSave() {
    localStorage.setItem("gemstock_currency_settings", JSON.stringify({ defaultCurrency, enabledCurrencies }));
    toast.success("Currency settings saved");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Currency Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure currencies used across sales, invoices, and pricing.</p>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">How currencies work in GemStock</p>
        <p className="text-blue-700">
          Each sale, consignment, and invoice can specify its own currency. INR is always available
          as the base currency. Enable additional currencies below to make them selectable in transactions.
        </p>
      </div>

      {/* Currency List */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/40">
          <h2 className="text-sm font-semibold text-foreground">Enabled Currencies</h2>
        </div>
        <div className="divide-y">
          {CURRENCIES.map((c) => (
            <div key={c.code} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.flag}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.code} — {c.name}</p>
                  <p className="text-xs text-muted-foreground">Symbol: {c.symbol}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.code === "INR" && (
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">Base</span>
                )}
                {enabledCurrencies.includes(c.code) && defaultCurrency !== c.code && c.code !== "INR" && (
                  <button onClick={() => setDefaultCurrency(c.code)}
                    className="text-xs text-muted-foreground/60 hover:text-primary">
                    Set default
                  </button>
                )}
                {defaultCurrency === c.code && c.code !== "INR" && (
                  <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">Default</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={enabledCurrencies.includes(c.code)}
                    disabled={c.code === "INR"}
                    onChange={() => toggleCurrency(c.code)} />
                  <div className={`w-10 h-5 rounded-full peer transition-colors
                    ${enabledCurrencies.includes(c.code) ? "bg-primary" : "bg-gray-200"}
                    ${c.code === "INR" ? "opacity-60 cursor-not-allowed" : ""}
                    after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all
                    peer-checked:after:translate-x-5`}>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Save Settings
        </button>
      </div>
    </div>
  );
}
