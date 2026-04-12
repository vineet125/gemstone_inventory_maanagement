export type DatePreset = "" | "this_month" | "last_15" | "last_fy" | "last_2_fy";

/** India financial year starts April 1. Returns the year in which the current FY started. */
function fyStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export function getDateRange(preset: DatePreset): { from: Date; to: Date } | null {
  if (!preset) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fy = fyStart();
  switch (preset) {
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today };
    case "last_15":
      return { from: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), to: today };
    case "last_fy":
      // e.g. Apr 1 2025 – Mar 31 2026
      return { from: new Date(fy - 1, 3, 1), to: new Date(fy, 2, 31) };
    case "last_2_fy":
      // e.g. Apr 1 2024 – Mar 31 2026
      return { from: new Date(fy - 2, 3, 1), to: new Date(fy, 2, 31) };
  }
}

export function getPresetLabel(preset: DatePreset): string {
  if (!preset) return "All Time";
  const fy = fyStart();
  switch (preset) {
    case "this_month": return "This Month";
    case "last_15":    return "Last 15 Days";
    case "last_fy":    return `FY ${fy - 1}-${String(fy).slice(2)}`;
    case "last_2_fy":  return `FY ${fy - 2}-${String(fy).slice(2)}`;
  }
}

export const DATE_PRESETS: DatePreset[] = ["", "this_month", "last_15", "last_fy", "last_2_fy"];
