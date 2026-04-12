"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { exportToCsv } from "@/lib/exportCsv";

// Default to current India FY
function currentFY(): DateRange {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const fyYear = m >= 3 ? y : y - 1;
  return { from: `${fyYear}-04-01`, to: `${fyYear + 1}-03-31` };
}

// Build query string, omitting empty / falsy values
function qs(params: Record<string, string | boolean | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const SEL =
  "rounded-lg border bg-background px-2 py-1.5 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ─── Types ────────────────────────────────────────────────────────────────────

type StockF   = { stoneTypeId: string; lowStock: boolean };
type SalesF   = { dateRange: DateRange; brokerId: string; stoneTypeId: string; type: string };
type PayF     = { dateRange: DateRange; status: string };
type MfgF     = { dateRange: DateRange; stoneType: string };
type BLF      = { dateRange: DateRange; brokerId: string };
type PLF      = { dateRange: DateRange };

// ─── Summary display values for P&L ──────────────────────────────────────────
interface PLSummary {
  totalBilled: number; totalCollected: number; totalOutstanding: number;
  consignmentRevenue: number; directRevenue: number;
  materialCost: number; wageCost: number; totalCost: number;
  grossProfit: number; netProfit: number;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [brokers,    setBrokers]    = useState<{ id: string; name: string }[]>([]);
  const [stoneTypes, setStoneTypes] = useState<{ id: string; name: string }[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  // Per-report filter state
  const [stockF, setStockF] = useState<StockF>({ stoneTypeId: "", lowStock: false });
  const [salesF, setSalesF] = useState<SalesF>({ dateRange: currentFY(), brokerId: "", stoneTypeId: "", type: "" });
  const [payF,   setPayF]   = useState<PayF>  ({ dateRange: currentFY(), status: "" });
  const [mfgF,   setMfgF]   = useState<MfgF>  ({ dateRange: currentFY(), stoneType: "" });
  const [blF,    setBLF]    = useState<BLF>   ({ dateRange: currentFY(), brokerId: "" });
  const [plF,    setPLF]    = useState<PLF>   ({ dateRange: currentFY() });

  // P&L inline summary (shown after generation)
  const [plSummary, setPlSummary] = useState<PLSummary | null>(null);

  // Load dropdown data once
  useEffect(() => {
    Promise.all([
      fetch("/api/brokers").then((r) => r.json()),
      fetch("/api/catalog/stone-types").then((r) => r.json()),
    ])
      .then(([b, s]) => {
        setBrokers(Array.isArray(b) ? b : []);
        setStoneTypes(Array.isArray(s) ? s : []);
      })
      .catch(() => {});
  }, []);

  async function runReport(id: string, endpoint: string) {
    setGenerating(id);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const msg = res.status === 403 ? "Access denied (Owner only)" : "Report generation failed";
        toast.error(msg);
        return;
      }
      const data = await res.json();

      if (id === "pl") {
        setPlSummary(data.summary);
        if (!data.rows?.length) { toast.info("No data for selected period"); return; }
        exportToCsv(data.rows, "pl-report");
      } else {
        const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
        if (!rows.length) { toast.info("No data for selected filters"); return; }
        exportToCsv(rows, `${id}-report`);
      }
      toast.success("CSV downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(null);
    }
  }

  const busy = (id: string) => generating === id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Filter and export business reports as CSV
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* ── Stock Report ──────────────────────────────────────────────── */}
        <ReportCard title="Stock Report" icon="📦" desc="Current inventory snapshot by type, color, size, grade">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stockF.stoneTypeId}
              onChange={(e) => setStockF({ ...stockF, stoneTypeId: e.target.value })}
              className={SEL}
            >
              <option value="">All stone types</option>
              {stoneTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={stockF.lowStock}
                onChange={(e) => setStockF({ ...stockF, lowStock: e.target.checked })}
                className="rounded"
              />
              Low stock only (≤10 pcs)
            </label>
          </div>
          <ExportBtn
            busy={busy("stock")}
            onClick={() =>
              runReport(
                "stock",
                `/api/reports/stock${qs({
                  stoneTypeId: stockF.stoneTypeId || undefined,
                  lowStock: stockF.lowStock || undefined,
                })}`,
              )
            }
          />
        </ReportCard>

        {/* ── Sales Report ──────────────────────────────────────────────── */}
        <ReportCard title="Sales Report" icon="📈" desc="Consignments and direct sales">
          <DateRangePicker value={salesF.dateRange} onChange={(r) => setSalesF({ ...salesF, dateRange: r })} />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <select
              value={salesF.brokerId}
              onChange={(e) => setSalesF({ ...salesF, brokerId: e.target.value })}
              className={SEL}
            >
              <option value="">All brokers</option>
              {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              value={salesF.stoneTypeId}
              onChange={(e) => setSalesF({ ...salesF, stoneTypeId: e.target.value })}
              className={SEL}
            >
              <option value="">All stone types</option>
              {stoneTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={salesF.type}
              onChange={(e) => setSalesF({ ...salesF, type: e.target.value })}
              className={SEL}
            >
              <option value="">All types</option>
              <option value="consignment">Consignment</option>
              <option value="direct">Direct Sale</option>
            </select>
          </div>
          <ExportBtn
            busy={busy("sales")}
            onClick={() =>
              runReport(
                "sales",
                `/api/reports/sales${qs({
                  from:        salesF.dateRange.from,
                  to:          salesF.dateRange.to,
                  brokerId:    salesF.brokerId    || undefined,
                  stoneTypeId: salesF.stoneTypeId || undefined,
                  type:        salesF.type        || undefined,
                })}`,
              )
            }
          />
        </ReportCard>

        {/* ── Payment Report ────────────────────────────────────────────── */}
        <ReportCard title="Payment Report" icon="💰" desc="Outstanding, collected, and overdue invoices">
          <DateRangePicker value={payF.dateRange} onChange={(r) => setPayF({ ...payF, dateRange: r })} />
          <div className="mt-2">
            <select
              value={payF.status}
              onChange={(e) => setPayF({ ...payF, status: e.target.value })}
              className={SEL}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          <ExportBtn
            busy={busy("payments")}
            onClick={() =>
              runReport(
                "payments",
                `/api/reports/payments${qs({
                  from:   payF.dateRange.from,
                  to:     payF.dateRange.to,
                  status: payF.status || undefined,
                })}`,
              )
            }
          />
        </ReportCard>

        {/* ── Manufacturing Report ──────────────────────────────────────── */}
        <ReportCard title="Manufacturing Report" icon="🏭" desc="Batch yield, stage throughput, vendor performance">
          <DateRangePicker value={mfgF.dateRange} onChange={(r) => setMfgF({ ...mfgF, dateRange: r })} />
          <div className="mt-2">
            <select
              value={mfgF.stoneType}
              onChange={(e) => setMfgF({ ...mfgF, stoneType: e.target.value })}
              className={SEL}
            >
              <option value="">All stone types</option>
              {stoneTypes.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <ExportBtn
            busy={busy("manufacturing")}
            onClick={() =>
              runReport(
                "manufacturing",
                `/api/reports/manufacturing${qs({
                  from:      mfgF.dateRange.from,
                  to:        mfgF.dateRange.to,
                  stoneType: mfgF.stoneType || undefined,
                })}`,
              )
            }
          />
        </ReportCard>

        {/* ── Broker Ledger ─────────────────────────────────────────────── */}
        <ReportCard title="Broker Ledger" icon="🤝" desc="Per broker: consignments, qty, payments, balance">
          <DateRangePicker value={blF.dateRange} onChange={(r) => setBLF({ ...blF, dateRange: r })} />
          <div className="mt-2">
            <select
              value={blF.brokerId}
              onChange={(e) => setBLF({ ...blF, brokerId: e.target.value })}
              className={SEL}
            >
              <option value="">All brokers</option>
              {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <ExportBtn
            busy={busy("broker-ledger")}
            onClick={() =>
              runReport(
                "broker-ledger",
                `/api/reports/broker-ledger${qs({
                  from:     blF.dateRange.from,
                  to:       blF.dateRange.to,
                  brokerId: blF.brokerId || undefined,
                })}`,
              )
            }
          />
        </ReportCard>

        {/* ── Profit & Loss ─────────────────────────────────────────────── */}
        <ReportCard
          title="Profit & Loss"
          icon="📊"
          desc="Revenue vs cost breakdown — Owner only"
          badge="Owner only"
        >
          <DateRangePicker value={plF.dateRange} onChange={(r) => setPLF({ dateRange: r })} />

          {/* Inline summary after generation */}
          {plSummary && (
            <div className="mt-3 rounded-lg border bg-muted/40 p-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <PLRow label="Total Billed"    value={plSummary.totalBilled} />
              <PLRow label="Collected"       value={plSummary.totalCollected} />
              <PLRow label="Outstanding"     value={plSummary.totalOutstanding} />
              <PLRow label="Consignment Rev" value={plSummary.consignmentRevenue} />
              <PLRow label="Direct Revenue"  value={plSummary.directRevenue} />
              <PLRow label="Material Cost"   value={plSummary.materialCost} />
              <PLRow label="Wages"           value={plSummary.wageCost} />
              <PLRow
                label="Gross Profit"
                value={plSummary.grossProfit}
                className={plSummary.grossProfit >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}
              />
              <PLRow
                label="Net Profit"
                value={plSummary.netProfit}
                className={plSummary.netProfit >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}
              />
            </div>
          )}

          <ExportBtn
            busy={busy("pl")}
            label="Generate & Export Monthly CSV"
            onClick={() =>
              runReport(
                "pl",
                `/api/reports/pl${qs({ from: plF.dateRange.from, to: plF.dateRange.to })}`,
              )
            }
          />
        </ReportCard>

      </div>
    </div>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function ReportCard({
  title, icon, desc, badge, children,
}: {
  title: string; icon: string; desc: string; badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {badge && (
              <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium whitespace-nowrap">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ExportBtn({
  busy, onClick, label = "Export CSV",
}: {
  busy: boolean; onClick: () => void; label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-auto w-full rounded-lg py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {busy ? "Generating…" : `⬇ ${label}`}
    </button>
  );
}

function PLRow({
  label, value, className = "text-foreground",
}: {
  label: string; value: number; className?: string;
}) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className={className}>₹{value.toLocaleString("en-IN")}</span>
    </>
  );
}
