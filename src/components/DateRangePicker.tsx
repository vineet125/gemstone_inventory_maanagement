"use client";

import { useState, useEffect } from "react";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

interface Preset {
  label: string;
  range: () => DateRange;
}

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

function getPresets(): Preset[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  // India FY: Apr 1 – Mar 31
  const fyStart = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1);
  const fyEnd   = m >= 3 ? new Date(y + 1, 2, 31) : new Date(y, 2, 31);

  // Start of current week (Mon)
  const dow = (today.getDay() + 6) % 7; // 0=Mon
  const weekStart = new Date(y, m, d - dow);

  return [
    { label: "Today",        range: () => ({ from: ymd(today), to: ymd(today) }) },
    { label: "This Week",    range: () => ({ from: ymd(weekStart), to: ymd(today) }) },
    { label: "This Month",   range: () => ({ from: ymd(new Date(y, m, 1)), to: ymd(today) }) },
    { label: "Last Month",   range: () => ({ from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) }) },
    { label: "Last 3 Months",range: () => ({ from: ymd(new Date(y, m - 3, d)), to: ymd(today) }) },
    { label: "This FY",      range: () => ({ from: ymd(fyStart), to: ymd(fyEnd) }) },
  ];
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className = "" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // draft mirrors the inputs locally; onChange fires only on blur or preset select
  const [draft, setDraft] = useState<DateRange>(value);
  const presets = getPresets();

  // Sync draft if parent resets value externally (e.g., page navigation)
  useEffect(() => { setDraft(value); }, [value.from, value.to]);

  function applyPreset(p: Preset) {
    const r = p.range();
    setDraft(r);
    onChange(r);
    setOpen(false);
  }

  function commit(next: DateRange) {
    if (next.from && next.to && next.from <= next.to) {
      onChange(next);
    }
  }

  function activePreset() {
    return presets.find((p) => {
      const r = p.range();
      return r.from === value.from && r.to === value.to;
    })?.label ?? "Custom";
  }

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Preset button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent shadow-sm"
        >
          📅 {activePreset()}
          <span className="text-muted-foreground/60">▾</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-20 w-40 rounded-xl border bg-card shadow-lg py-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                    activePreset() === p.label ? "font-semibold text-primary" : "text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* From date — updates draft while editing, commits on blur */}
      <input
        type="date"
        value={draft.from}
        onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
        onBlur={() => commit(draft)}
        className="rounded-lg border bg-card px-2 py-1.5 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <span className="text-muted-foreground/60 text-xs">→</span>
      {/* To date */}
      <input
        type="date"
        value={draft.to}
        min={draft.from}
        onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
        onBlur={() => commit(draft)}
        className="rounded-lg border bg-card px-2 py-1.5 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}
