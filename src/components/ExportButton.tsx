"use client";

import { exportToCsv } from "@/lib/exportCsv";

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  columns?: { key: keyof T; header: string }[];
  disabled?: boolean;
  label?: string;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  disabled,
  label = "Export CSV",
}: ExportButtonProps<T>) {
  return (
    <button
      type="button"
      disabled={disabled || !data.length}
      onClick={() => exportToCsv(data, filename, columns)}
      className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      title={!data.length ? "No data to export" : `Export ${data.length} rows to CSV`}
    >
      ⬇ {label}
    </button>
  );
}
