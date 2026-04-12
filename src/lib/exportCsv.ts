/**
 * Export an array of flat objects to a downloaded CSV file.
 * columns: [{ key, header }] — if omitted, derives from first row's keys.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[]
) {
  if (!rows.length) return;

  const cols = columns ?? (Object.keys(rows[0]) as (keyof T)[]).map((k) => ({
    key: k, header: String(k),
  }));

  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const header = cols.map((c) => escape(c.header)).join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(",")).join("\n");
  const csv = `\uFEFF${header}\n${body}`; // BOM for Excel UTF-8

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
