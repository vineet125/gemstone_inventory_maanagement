"use client";

import { useEffect, useState, useCallback } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { ExportButton } from "@/components/ExportButton";
import { useRole } from "@/hooks/useRole";

// ─── Types ─────────────────────────────────────────────────────────────────

interface PendingWorker {
  id: string;
  name: string;
  phone: string | null;
  payType: string;
  settlementCycle: string;
  dailyWageRate: number | null;
  fromDate: string;
  toDate: string;
  lastSettledOn: string | null;
  lastPaidAmount: number | null;
  lastTotalAmount: number | null;
  carriedBalance: number;
  daysPresent: number;
  halfDays: number;
  totalPieces: number;
  wagesAmount: number;
  pieceAmount: number;
  totalAmount: number;
  hasBalance: boolean;
}

interface SettlementRecord {
  id: string;
  workerId: string;
  workerName: string;
  fromDate: string;
  toDate: string;
  daysPresent: number;
  halfDays: number;
  totalPieces: number;
  wagesAmount: number;
  pieceAmount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  notes: string | null;
  settledBy: string | null;
  paymentMode: string;
  paymentDate: string | null;
  createdAt: string;
}

const CYCLE_LABELS: Record<string, { label: string; color: string }> = {
  WEEKLY: { label: "Weekly", color: "bg-blue-100 text-blue-800" },
  MONTHLY: { label: "Monthly", color: "bg-purple-100 text-purple-800" },
  PER_WORK: { label: "Per Work", color: "bg-amber-100 text-amber-800" },
};

const PAY_LABELS: Record<string, string> = {
  DAILY_WAGES: "Daily Wage",
  PER_PIECE: "Per Piece",
  MIXED: "Mixed",
};

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  CASH:          { label: "Cash",          color: "bg-green-100 text-green-800" },
  UPI:           { label: "UPI",           color: "bg-violet-100 text-violet-800" },
  BANK_TRANSFER: { label: "Bank",          color: "bg-blue-100 text-blue-800" },
  CHEQUE:        { label: "Cheque",        color: "bg-gray-100 text-foreground" },
};

// ─── Main Component ────────────────────────────────────────────────────────

export default function SettlementsPage() {
  const role = useRole();
  const isStaff = role === "STAFF";
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<PendingWorker[]>([]);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [settleModal, setSettleModal] = useState<PendingWorker | null>(null);
  const [filterCycle, setFilterCycle] = useState("ALL");
  const [search, setSearch] = useState("");

  // History date range — defaults to current FY (April 1)
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({
    from: `${fyYear}-04-01`,
    to: now.toISOString().split("T")[0],
  });

  const loadPending = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workers/settlements");
    if (res.ok) setPending(await res.json());
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    const res = await fetch(`/api/workers/settlements/history?${params}`);
    if (res.ok) setHistory(await res.json());
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    if (tab === "pending") loadPending();
    else loadHistory();
  }, [tab, loadPending, loadHistory]);

  const filtered = (filterCycle === "ALL"
    ? pending
    : pending.filter((w) => w.settlementCycle === filterCycle)
  ).filter((w) => !search || w.name.toLowerCase().includes(search.toLowerCase()));

  const withBalance = filtered.filter((w) => w.hasBalance);
  const totalDue = withBalance.reduce((s, w) => s + w.totalAmount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Worker Settlements</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Weekly · Monthly · Per Work — calculate dues and record payments
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pending" ? "Pending Dues" : "Settlement History"}
          </button>
        ))}
      </div>

      {/* ── PENDING TAB ── */}
      {tab === "pending" && (
        <>
          {/* Summary + filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              {["ALL", "WEEKLY", "MONTHLY", "PER_WORK"].map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCycle(c)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                    filterCycle === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-border"
                  }`}
                >
                  {c === "ALL" ? "All" : CYCLE_LABELS[c].label}
                </button>
              ))}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search worker…"
                className="rounded-lg border bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {withBalance.length > 0 && !isStaff && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm">
                <span className="text-amber-700">{withBalance.length} workers pending · </span>
                <span className="font-bold text-amber-800">Total due: ₹{totalDue.toLocaleString()}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground/60">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-semibold text-foreground">All settled!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending dues for selected cycle.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w) => {
                const days = w.lastSettledOn
                  ? differenceInDays(new Date(), parseISO(w.lastSettledOn))
                  : null;
                const periodDays = differenceInDays(parseISO(w.toDate), parseISO(w.fromDate)) + 1;
                const cycleInfo = CYCLE_LABELS[w.settlementCycle] ?? CYCLE_LABELS["MONTHLY"];

                return (
                  <div
                    key={w.id}
                    className={`rounded-xl border bg-card p-4 shadow-sm ${
                      !w.hasBalance ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* Worker info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground">{w.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cycleInfo.color}`}>
                            {cycleInfo.label}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground">
                            {PAY_LABELS[w.payType]}
                          </span>
                          {days !== null && (
                            <span className={`text-xs font-medium ${days > 30 ? "text-red-600" : "text-muted-foreground/60"}`}>
                              Last settled {days}d ago
                            </span>
                          )}
                          {!w.lastSettledOn && (
                            <span className="text-xs text-orange-500 font-medium">Never settled</span>
                          )}
                        </div>

                        {/* Period */}
                        <p className="text-xs text-muted-foreground mt-1">
                          Period: {format(parseISO(w.fromDate), "dd MMM")} → {format(parseISO(w.toDate), "dd MMM yyyy")}
                          {" "}({periodDays} days)
                        </p>

                        {/* Last paid info */}
                        {w.lastSettledOn && (
                          <p className="text-xs mt-0.5">
                            <span className="text-muted-foreground/60">Wages paid up to: </span>
                            <span className="font-medium text-muted-foreground">{format(parseISO(w.lastSettledOn), "dd MMM yyyy")}</span>
                            {!isStaff && w.lastPaidAmount !== null && w.lastTotalAmount !== null && (
                              <>
                                <span className="text-muted-foreground/60"> · </span>
                                <span className={`font-medium ${w.lastPaidAmount < w.lastTotalAmount ? "text-orange-600" : "text-green-600"}`}>
                                  ₹{w.lastPaidAmount.toLocaleString()} paid
                                </span>
                                {w.lastPaidAmount < w.lastTotalAmount && (
                                  <span className="text-orange-500 ml-1">
                                    (₹{(w.lastTotalAmount - w.lastPaidAmount).toLocaleString()} balance)
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        )}

                        {/* Breakdown */}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {w.carriedBalance > 0 && (
                            <span className="rounded bg-orange-50 border border-orange-300 px-2 py-1 text-orange-800">
                              ⏳ Previous balance
                              {!isStaff && <span className="font-bold ml-1">₹{w.carriedBalance.toLocaleString()}</span>}
                            </span>
                          )}
                          {w.payType !== "PER_PIECE" && (
                            <span className="rounded bg-green-50 border border-green-200 px-2 py-1 text-green-800">
                              👤 {w.daysPresent} days present
                              {w.halfDays > 0 && ` + ${w.halfDays} half`}
                              {!isStaff && w.dailyWageRate && ` × ₹${w.dailyWageRate}`}
                              {!isStaff && <span className="font-bold ml-1">= ₹{w.wagesAmount.toLocaleString()}</span>}
                            </span>
                          )}
                          {w.payType !== "DAILY_WAGES" && w.totalPieces > 0 && (
                            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-blue-800">
                              🔢 {w.totalPieces} pieces
                              {!isStaff && <span className="font-bold ml-1">= ₹{w.pieceAmount.toLocaleString()}</span>}
                            </span>
                          )}
                          {w.payType !== "DAILY_WAGES" && w.totalPieces === 0 && w.carriedBalance === 0 && (
                            <span className="rounded bg-muted/40 border border-border px-2 py-1 text-muted-foreground">
                              No pieces recorded
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount + action — hidden for STAFF */}
                      {!isStaff && (
                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-2 sm:min-w-[140px]">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total Due</p>
                          <p className={`text-2xl font-bold ${w.totalAmount > 0 ? "text-foreground" : "text-gray-300"}`}>
                            ₹{w.totalAmount.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSettleModal(w)}
                          disabled={!w.hasBalance}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Settle ₹{w.totalAmount.toLocaleString()}
                        </button>
                      </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <>
          {/* Toolbar: date filter + search + export */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePicker
                value={dateRange}
                onChange={(r) => { setDateRange(r); }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search worker…"
                className="rounded-lg border bg-card px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {!isStaff && (
            <ExportButton
              data={history.map((s) => ({
                Worker: s.workerName,
                "Period From": s.fromDate,
                "Period To": s.toDate,
                Days: s.daysPresent,
                "Half Days": s.halfDays,
                Pieces: s.totalPieces,
                "Total Due (₹)": s.totalAmount,
                "Paid (₹)": s.paidAmount,
                "Balance (₹)": s.balance,
                "Payment Mode": s.paymentMode,
                "Paid On": s.paymentDate ?? "",
                "Settled By": s.settledBy ?? "",
                Notes: s.notes ?? "",
              }))}
              filename={`settlements_${dateRange.from}_${dateRange.to}`}
              label={`Export ${history.length || ""} rows`}
            />
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground/60">Loading…</div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-semibold text-foreground">No settlements yet</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Worker</th>
                    <th className="text-left px-4 py-3">Period Covered</th>
                    <th className="text-right px-4 py-3">Days</th>
                    <th className="text-right px-4 py-3">Pieces</th>
                    {!isStaff && <th className="text-right px-4 py-3">Total Due</th>}
                    {!isStaff && <th className="text-right px-4 py-3">Paid</th>}
                    {!isStaff && <th className="text-right px-4 py-3">Balance</th>}
                    <th className="text-left px-4 py-3">Mode</th>
                    <th className="text-left px-4 py-3">Paid On</th>
                    <th className="text-left px-4 py-3">Settled By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.filter((s) => !search || s.workerName.toLowerCase().includes(search.toLowerCase())).map((s) => {
                    const modeInfo = MODE_LABELS[s.paymentMode] ?? MODE_LABELS.CASH;
                    return (
                    <tr key={s.id} className="hover:bg-accent">
                      <td className="px-4 py-3 font-semibold text-foreground">{s.workerName}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(parseISO(s.fromDate), "dd MMM")} – {format(parseISO(s.toDate), "dd MMM yy")}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {s.daysPresent}
                        {s.halfDays > 0 && <span className="text-muted-foreground/60">+{s.halfDays}½</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{s.totalPieces || "—"}</td>
                      {!isStaff && (
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        ₹{s.totalAmount.toLocaleString()}
                      </td>
                      )}
                      {!isStaff && (
                      <td className="px-4 py-3 text-right text-green-700 font-semibold">
                        ₹{s.paidAmount.toLocaleString()}
                      </td>
                      )}
                      {!isStaff && (
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${s.balance > 0 ? "text-red-600" : "text-muted-foreground/60"}`}>
                          {s.balance > 0 ? `₹${s.balance.toLocaleString()}` : "—"}
                        </span>
                      </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${modeInfo.color}`}>
                          {modeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                        {s.paymentDate ? format(parseISO(s.paymentDate), "dd MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.settledBy ?? "—"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Settlement modal */}
      {settleModal && (
        <SettleModal
          worker={settleModal}
          onClose={() => setSettleModal(null)}
          onSaved={() => { setSettleModal(null); loadPending(); }}
        />
      )}
    </div>
  );
}

// ─── Settle Modal ──────────────────────────────────────────────────────────

function SettleModal({
  worker,
  onClose,
  onSaved,
}: {
  worker: PendingWorker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [paidAmount, setPaidAmount] = useState(String(worker.totalAmount));
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const paid = Number(paidAmount) || 0;
  const balance = worker.totalAmount - paid;
  const isFullSettle = paid === worker.totalAmount;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (paid <= 0) { setError("Enter amount paid"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/workers/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerId: worker.id,
        fromDate: worker.fromDate,
        toDate: worker.toDate,
        daysPresent: worker.daysPresent,
        halfDays: worker.halfDays,
        totalPieces: worker.totalPieces,
        wagesAmount: worker.wagesAmount,
        pieceAmount: worker.pieceAmount,
        totalAmount: worker.totalAmount,
        paidAmount: paid,
        paymentMode,
        paymentDate,
        notes: notes || undefined,
      }),
    });
    if (res.ok) { onSaved(); } else { setError("Failed to save"); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-bold text-foreground text-lg">Record Payment</h2>
            <p className="text-sm text-muted-foreground">{worker.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground text-xl">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Period summary */}
          <div className="rounded-xl bg-muted/40 border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period covered</span>
              <span className="font-medium">
                {format(parseISO(worker.fromDate), "dd MMM")} – {format(parseISO(worker.toDate), "dd MMM yyyy")}
              </span>
            </div>
            {worker.carriedBalance > 0 && (
              <div className="flex justify-between text-orange-700">
                <span>Previous unpaid balance</span>
                <span className="font-semibold">₹{worker.carriedBalance.toLocaleString()}</span>
              </div>
            )}
            {worker.payType !== "PER_PIECE" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Wages ({worker.daysPresent} days{worker.halfDays > 0 ? ` + ${worker.halfDays} half` : ""})
                </span>
                <span className="font-medium text-green-700">₹{worker.wagesAmount.toLocaleString()}</span>
              </div>
            )}
            {worker.payType !== "DAILY_WAGES" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pieces ({worker.totalPieces})</span>
                <span className="font-medium text-blue-700">₹{worker.pieceAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="font-semibold text-foreground">Total Due</span>
              <span className="font-bold text-foreground text-base">₹{worker.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Amount Paying Now (₹) *</label>
              {paid !== worker.totalAmount && (
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(worker.totalAmount))}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Settle full ₹{worker.totalAmount.toLocaleString()} →
                </button>
              )}
            </div>
            <input
              type="number"
              min={1}
              max={worker.totalAmount}
              step="1"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>

          {/* Balance preview */}
          {balance > 0 && (
            <div className="rounded-lg px-4 py-2.5 text-sm flex justify-between bg-orange-50 border border-orange-200">
              <span className="text-orange-700">Remaining balance (partial)</span>
              <span className="font-bold text-orange-800">₹{balance.toLocaleString()}</span>
            </div>
          )}
          {balance < 0 && (
            <div className="rounded-lg px-4 py-2.5 text-sm flex justify-between bg-green-50 border border-green-200">
              <span className="text-green-700">Overpayment (advance)</span>
              <span className="font-bold text-green-800">₹{Math.abs(balance).toLocaleString()}</span>
            </div>
          )}

          {/* Payment mode + date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Payment Mode *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full rounded-lg border-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes <span className="font-normal text-muted-foreground/60">(optional)</span></label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. advance deducted, ref no…"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-colors ${
                isFullSettle ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600"
              }`}>
              {saving ? "Saving…" : isFullSettle ? `✓ Settle ₹${paid.toLocaleString()}` : `Pay ₹${paid.toLocaleString()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
