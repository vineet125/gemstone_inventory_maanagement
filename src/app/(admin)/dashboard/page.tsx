"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { type DatePreset, DATE_PRESETS, getDateRange, getPresetLabel } from "@/lib/date-ranges";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";

// ── Types ────────────────────────────────────────────────────────────────────

interface StoneTypeRow { name: string; pieces: number; skus: number; }
interface LowStockRow { sku: string; qty: number; threshold: number; }
interface TopWorker { name: string; pieces: number; earnings: number; }
interface TopBroker { name: string; consignments: number; pendingValue: number; }
interface RecentSale {
  id: string; type: string; party: string;
  amount: number; paid: number; status: string; date: string;
}

interface DashboardData {
  inventory: {
    totalSkus: number; totalPieces: number; totalCarats: number; stockValue: number;
    lowStockCount: number; outOfStockCount: number;
    lowStockItems: LowStockRow[];
    byStoneType: StoneTypeRow[];
  };
  workers: {
    activeCount: number; presentToday: number; piecesThisWeek: number;
    topWorkers: TopWorker[];
  };
  brokers: {
    activeCount: number; totalValue: number; outstandingAmount: number; overdueAmount: number;
    topBrokers: TopBroker[];
  };
  sales: {
    monthBilled: number; monthCollected: number; invoiceCount: number;
    recentSales: RecentSale[];
  };
}

type Tab = "inventory" | "workers" | "brokers" | "sales";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PARTIAL: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("inventory");

  // Default to current India FY
  const _now = new Date();
  const _fyYear = _now.getMonth() >= 3 ? _now.getFullYear() : _now.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({
    from: `${_fyYear}-04-01`,
    to: _now.toISOString().split("T")[0],
  });

  async function load(range: DateRange = dateRange) {
    setLoading(true);
    const params = `?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z`;
    const res = await fetch(`/api/dashboard${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(dateRange); }, [dateRange]);

  if (loading) return (
    <div className="space-y-6">
      {/* Header — stays interactive while loading */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => load(dateRange)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-accent whitespace-nowrap shadow-sm"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI Card Skeletons */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="h-2.5 bg-muted rounded w-20 mb-2.5" />
                <div className="h-7 bg-muted rounded w-28 mb-1.5" />
                <div className="h-2.5 bg-muted rounded w-32" />
              </div>
              <div className="h-8 w-8 bg-muted rounded-lg ml-3 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Tab Bar Skeleton */}
      <div className="flex gap-1 rounded-xl bg-muted/60 p-1 w-fit animate-pulse">
        {[100, 90, 84, 80].map((w, i) => (
          <div key={i} className={`rounded-lg px-4 py-2 ${i === 0 ? "bg-card shadow-sm" : ""}`}>
            <div className="h-4 bg-muted rounded" style={{ width: w }} />
          </div>
        ))}
      </div>

      {/* Content Area Skeleton — mirrors inventory tab (default) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left panel: stone type bar chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-5">
            <div className="h-4 bg-muted rounded w-40" />
            <div className="h-3 bg-muted rounded w-14" />
          </div>
          <div className="space-y-4">
            {[85, 72, 58, 44, 30].map((w, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1.5">
                  <div className="h-3 bg-muted rounded" style={{ width: w * 1.2 }} />
                  <div className="h-3 bg-muted rounded w-24" />
                </div>
                <div className="h-2 bg-muted rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t flex justify-between">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        </div>

        {/* Right panel: stock alerts */}
        <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
          <div className="h-4 bg-muted rounded w-28 mb-5" />
          <div className="space-y-3">
            <div className="h-12 bg-muted rounded-lg" />
            <div className="h-12 bg-muted rounded-lg" />
            <div className="mt-4">
              <div className="h-2.5 bg-muted rounded w-24 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <div className="h-3 bg-muted rounded w-20" />
                    <div className="h-3 bg-muted rounded w-10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  if (!data) return <div className="py-16 text-center text-sm text-red-500">Failed to load dashboard.</div>;

  const { inventory, workers, brokers, sales } = data;
  const maxPieces = Math.max(...inventory.byStoneType.map((s) => s.pieces), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => load(dateRange)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-accent whitespace-nowrap shadow-sm"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon="📦"
          title="Total Stock"
          value={inventory.totalPieces.toLocaleString("en-IN")}
          sub={
            inventory.totalCarats > 0
              ? `${inventory.totalCarats.toFixed(1)} ct · ${inventory.totalSkus} SKUs`
              : `${inventory.totalSkus} SKUs`
          }
          alert={inventory.outOfStockCount > 0 ? `${inventory.outOfStockCount} out of stock` : undefined}
          alertType="warn"
          href="/inventory"
        />
        <KpiCard
          icon="🤝"
          title="Consignments Out"
          value={brokers.activeCount.toString()}
          sub={brokers.totalValue > 0 ? `${fmt(brokers.totalValue)} pending` : "No active consignments"}
          href="/sales/consignments"
        />
        <KpiCard
          icon="💰"
          title="Outstanding"
          value={fmt(brokers.outstandingAmount)}
          sub={brokers.overdueAmount > 0 ? `${fmt(brokers.overdueAmount)} overdue` : "All current"}
          alert={brokers.overdueAmount > 0 ? "Overdue payments!" : undefined}
          alertType="danger"
          href="/payments"
        />
        <KpiCard
          icon="👷"
          title="Workers Today"
          value={`${workers.presentToday} / ${workers.activeCount}`}
          sub={`${workers.piecesThisWeek.toLocaleString("en-IN")} pcs this week`}
          href="/workers/daily"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(["inventory", "workers", "brokers", "sales"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "inventory" ? "📦 Inventory"
              : t === "workers" ? "👷 Workers"
              : t === "brokers" ? "🤝 Brokers"
              : "💰 Sales"}
          </button>
        ))}
      </div>

      {/* ── Inventory Tab ─────────────────────────────────────────────────── */}
      {tab === "inventory" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Stock by Stone Type */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Stock by Stone Type</h2>
              <Link href="/inventory" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            {inventory.byStoneType.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 py-6 text-center">No inventory yet</p>
            ) : (
              <div className="space-y-3">
                {inventory.byStoneType.map((st) => (
                  <div key={st.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-foreground">{st.name}</span>
                      <span className="text-muted-foreground">
                        {st.pieces.toLocaleString("en-IN")} pcs · {st.skus} SKUs
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${(st.pieces / maxPieces) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t flex justify-between text-sm text-muted-foreground">
              <span>Est. Stock Value</span>
              <span className="font-semibold text-foreground">{fmt(inventory.stockValue)}</span>
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4">Stock Alerts</h2>
            <div className="space-y-2">
              {inventory.outOfStockCount > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                  <span className="text-sm font-medium text-red-700">Out of Stock</span>
                  <span className="text-xl font-bold text-red-600">{inventory.outOfStockCount} SKUs</span>
                </div>
              )}
              {inventory.lowStockCount > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                  <span className="text-sm font-medium text-amber-700">Low Stock</span>
                  <span className="text-xl font-bold text-amber-600">{inventory.lowStockCount} SKUs</span>
                </div>
              )}
              {inventory.lowStockCount === 0 && inventory.outOfStockCount === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-4 py-3">
                  <span className="text-green-600">✓</span>
                  <p className="text-sm text-green-700 font-medium">All stock levels healthy</p>
                </div>
              )}
              {inventory.lowStockItems.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Low Stock Items
                  </p>
                  <div className="space-y-1">
                    {inventory.lowStockItems.map((item) => (
                      <div key={item.sku} className="flex justify-between items-center py-1.5 border-b last:border-0">
                        <span className="font-mono text-xs text-foreground">{item.sku}</span>
                        <span className={`text-sm font-semibold ${item.qty <= 2 ? "text-red-600" : "text-amber-600"}`}>
                          {item.qty} / {item.threshold}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Workers Tab ───────────────────────────────────────────────────── */}
      {tab === "workers" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Attendance Summary */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground">Today&apos;s Attendance</h2>
              <Link href="/workers/daily" className="text-xs text-primary hover:underline">
                Daily Register →
              </Link>
            </div>
            <div className="flex items-center gap-8">
              {/* Donut */}
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${workers.activeCount > 0 ? (workers.presentToday / workers.activeCount) * 100 : 0} 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-foreground">{workers.presentToday}</span>
                  <span className="text-xs text-muted-foreground/60">of {workers.activeCount}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground/60">Present Today</p>
                  <p className="text-2xl font-bold text-green-600">{workers.presentToday}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground/60">Pieces This Week</p>
                  <p className="text-xl font-bold text-foreground">
                    {workers.piecesThisWeek.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Top Performers (This Month)</h2>
              <Link href="/workers/settlements" className="text-xs text-primary hover:underline">
                Settlements →
              </Link>
            </div>
            {workers.topWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 py-6 text-center">No piece work recorded this month</p>
            ) : (
              <div className="space-y-2">
                {workers.topWorkers.map((w, i) => (
                  <div key={w.name} className="flex items-center gap-3 py-1">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? "bg-amber-100 text-amber-700" :
                      i === 1 ? "bg-gray-200 text-muted-foreground" :
                      i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted/40 text-muted-foreground/60"
                    }`}>{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-foreground">{w.name}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {w.pieces.toLocaleString("en-IN")} pcs
                      </p>
                      <p className="text-xs text-muted-foreground/60">{fmt(Math.round(w.earnings))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Brokers Tab ───────────────────────────────────────────────────── */}
      {tab === "brokers" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Active Consignments */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Active Consignments</h2>
              <Link href="/sales/consignments" className="text-xs text-primary hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-600 font-medium">Open</p>
                <p className="text-2xl font-bold text-blue-700">{brokers.activeCount}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-600 font-medium">Pending Value</p>
                <p className="text-lg font-bold text-amber-700">{fmt(brokers.totalValue)}</p>
              </div>
            </div>
            {brokers.topBrokers.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 py-2 text-center">No active consignments</p>
            ) : (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">By Broker</p>
                <div className="space-y-1">
                  {brokers.topBrokers.map((b) => (
                    <div key={b.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground/60">
                          {b.consignments} consignment{b.consignments !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-foreground">{fmt(b.pendingValue)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Payment Status</h2>
              <Link href="/payments" className="text-xs text-primary hover:underline">
                Payments →
              </Link>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 border p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
                <p className="text-2xl font-bold text-foreground">{fmt(brokers.outstandingAmount)}</p>
              </div>
              {brokers.overdueAmount > 0 ? (
                <div className="rounded-lg bg-red-50 border border-red-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-500 font-semibold">⚠ OVERDUE</p>
                    <p className="text-xl font-bold text-red-600">{fmt(brokers.overdueAmount)}</p>
                  </div>
                  <Link href="/payments" className="text-xs text-red-600 underline font-medium">
                    Collect now →
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <p className="text-sm text-green-700 font-medium">No overdue payments</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sales Tab ─────────────────────────────────────────────────────── */}
      {tab === "sales" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Period Summary */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-foreground mb-5">{dateRange.from} – {dateRange.to}</h2>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-xs text-muted-foreground/60">Billed</p>
                <p className="text-2xl font-bold text-foreground">{fmt(sales.monthBilled)}</p>
                <p className="text-xs text-muted-foreground/60">
                  {sales.invoiceCount} invoice{sales.invoiceCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/60">Collected</p>
                <p className="text-2xl font-bold text-green-600">{fmt(sales.monthCollected)}</p>
                {sales.monthBilled > 0 && (
                  <p className="text-xs text-muted-foreground/60">
                    {Math.round((sales.monthCollected / sales.monthBilled) * 100)}% of billed
                  </p>
                )}
              </div>
            </div>
            {sales.monthBilled > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Collection progress</span>
                  <span>{Math.round((sales.monthCollected / sales.monthBilled) * 100)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{
                      width: `${Math.min((sales.monthCollected / sales.monthBilled) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {sales.monthBilled === 0 && (
              <p className="text-sm text-muted-foreground/60 text-center py-4">No invoices in this period</p>
            )}
          </div>

          {/* Recent Invoices */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Recent Invoices</h2>
              <Link href="/payments" className="text-xs text-primary hover:underline">All →</Link>
            </div>
            {sales.recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 py-8 text-center">No invoices yet</p>
            ) : (
              <div className="divide-y">
                {sales.recentSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-accent">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.party}</p>
                      <p className="text-xs text-muted-foreground/60">
                        {s.type === "CONSIGNMENT" ? "Consignment" : "Direct"} ·{" "}
                        {format(new Date(s.date), "dd MMM")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{fmt(s.amount)}</p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[s.status] ?? "bg-gray-100 text-muted-foreground"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, title, value, sub, alert, alertType, href,
}: {
  icon: string;
  title: string;
  value: string;
  sub?: string;
  alert?: string;
  alertType?: "warn" | "danger";
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow h-full">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-foreground truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>}
        </div>
        <span className="text-2xl ml-2 shrink-0">{icon}</span>
      </div>
      {alert && (
        <p className={`mt-2 text-xs font-semibold ${
          alertType === "danger" ? "text-red-600" : "text-amber-600"
        }`}>
          ⚠ {alert}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
