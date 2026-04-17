"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { ExportButton } from "@/components/ExportButton";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";

type TxType = "PURCHASE" | "CONSIGNMENT" | "DIRECT_SALE";

interface Transaction {
  id: string;
  type: TxType;
  refNo: string;
  date: string;
  party: string;
  stoneType: string;
  linesCount: number;
  amount: number;
  amountPaid: number;
  status: string;
  currency: string;
  href: string;
}

const TYPE_CONFIG: Record<TxType, { label: string; color: string; icon: string }> = {
  PURCHASE:     { label: "Purchase",     color: "bg-purple-100 text-purple-700 ring-1 ring-purple-200", icon: "📥" },
  CONSIGNMENT:  { label: "Consignment",  color: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",     icon: "🤝" },
  DIRECT_SALE:  { label: "Direct Sale",  color: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", icon: "🛒" },
};

const STATUS_COLORS: Record<string, string> = {
  // Purchase statuses
  NO_PO:             "bg-gray-100 text-muted-foreground",
  DRAFT:             "bg-gray-100 text-muted-foreground",
  APPROVED:          "bg-blue-100 text-blue-700",
  DELIVERED:         "bg-yellow-100 text-yellow-700",
  PAID:              "bg-emerald-100 text-emerald-700",
  // Consignment statuses
  ACTIVE:            "bg-blue-100 text-blue-700",
  PARTIALLY_RETURNED:"bg-yellow-100 text-yellow-700",
  FULLY_SOLD:        "bg-emerald-100 text-emerald-700",
  CLOSED:            "bg-gray-100 text-muted-foreground",
  // Direct sale statuses
  COMPLETED:         "bg-blue-100 text-blue-700",
  PARTIALLY_PAID:    "bg-yellow-100 text-yellow-700",
};

const PAGE_SIZE = 15;

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterType, setFilterType] = useState<"all" | TxType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const _now = new Date();
  const _fy = _now.getMonth() >= 3 ? _now.getFullYear() : _now.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({
    from: `${_fy}-04-01`,
    to: _now.toISOString().split("T")[0],
  });

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    fetch("/api/transactions")
      .then((r) => { if (!r.ok) throw new Error("failed"); return r.json(); })
      .then((d) => { setTxns(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  const filtered = txns.filter((t) => {
    const d = new Date(t.date);
    const inRange = d >= new Date(dateRange.from) && d <= new Date(`${dateRange.to}T23:59:59`);
    const matchType = filterType === "all" || t.type === filterType;
    const q = search.toLowerCase();
    const matchSearch = !q || t.refNo.toLowerCase().includes(q) || t.party.toLowerCase().includes(q);
    return inRange && matchType && matchSearch;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Clamp page if filters reduce total pages
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);

  // KPI stats
  const purchases   = filtered.filter((t) => t.type === "PURCHASE");
  const sales       = filtered.filter((t) => t.type !== "PURCHASE");
  const totalIn     = purchases.reduce((s, t) => s + t.amount, 0);
  const totalOut    = sales.reduce((s, t) => s + t.amount, 0);
  const outstanding = sales.reduce((s, t) => s + (t.amount - t.amountPaid), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">Purchases, consignments and direct sales in one view</p>
        </div>
        <ExportButton
          data={filtered.map((t) => ({
            Date: format(new Date(t.date), "dd MMM yyyy"),
            Type: TYPE_CONFIG[t.type]?.label ?? t.type,
            "Ref No": t.refNo,
            Party: t.party,
            Items: t.linesCount,
            "Amount (₹)": Math.round(t.amount),
            "Paid (₹)": Math.round(t.amountPaid),
            "Outstanding (₹)": Math.round(t.amount - t.amountPaid),
            Status: t.status.replace(/_/g, " "),
          }))}
          filename={`transactions_${dateRange.from}_${dateRange.to}`}
          label="Export"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Transactions", value: filtered.length.toString(), sub: "in period", color: "text-foreground" },
          { label: "Total Purchases", value: `₹${Math.round(totalIn).toLocaleString("en-IN")}`, sub: `${purchases.length} orders`, color: "text-purple-600" },
          { label: "Total Sales", value: `₹${Math.round(totalOut).toLocaleString("en-IN")}`, sub: `${sales.length} transactions`, color: "text-emerald-600" },
          { label: "Outstanding", value: `₹${Math.round(outstanding).toLocaleString("en-IN")}`, sub: "unpaid receivables", color: "text-amber-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Type</span>
          {([["all", "All"], ["PURCHASE", "Purchases"], ["CONSIGNMENT", "Consignments"], ["DIRECT_SALE", "Direct Sales"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => { setFilterType(val); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${filterType === val ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
              {label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ref no. or party…"
            className="ml-2 rounded-lg border bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Period</span>
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load transactions. <button onClick={() => { setLoading(true); setLoadError(false); fetch("/api/transactions").then((r) => r.json()).then((d) => { setTxns(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setLoadError(true); setLoading(false); }); }} className="underline font-medium">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-5 bg-muted rounded-full w-24" />
                <div className="h-3 bg-muted rounded w-24" />
                <div className="flex-1 h-3 bg-muted rounded w-28" />
                <div className="h-3 bg-muted rounded w-32" />
                <div className="h-3 bg-muted rounded w-12" />
                <div className="h-3 bg-muted rounded w-20 ml-auto" />
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-5 bg-muted rounded-full w-20" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Ref No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Party</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Items</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Paid</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground/60">No transactions found</td></tr>
              ) : paginated.map((t) => {
                const tc = TYPE_CONFIG[t.type] ?? { label: t.type, icon: "•", color: "bg-muted text-muted-foreground" };
                const outstanding = t.amount - t.amountPaid;
                return (
                  <tr key={`${t.type}-${t.id}`} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tc.color}`}>
                        <span>{tc.icon}</span>
                        {tc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(t.date), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{t.refNo}</td>
                    <td className="px-4 py-3 text-foreground">{t.party}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{t.linesCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      ₹{Math.round(t.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {t.amountPaid > 0
                        ? <span className="text-emerald-600 font-medium">₹{Math.round(t.amountPaid).toLocaleString("en-IN")}</span>
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-0.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-muted-foreground"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                        {outstanding > 0 && t.type !== "PURCHASE" && (
                          <div className="text-[10px] text-amber-600 font-medium">
                            ₹{Math.round(outstanding).toLocaleString("en-IN")} due
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={t.href} className="text-primary hover:underline text-xs font-medium">View →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>
    </div>
  );
}
