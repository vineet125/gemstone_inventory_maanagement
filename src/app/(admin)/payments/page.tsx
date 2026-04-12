"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, isPast, differenceInDays } from "date-fns";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { ExportButton } from "@/components/ExportButton";
import { Pagination } from "@/components/Pagination";

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  mode: string;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  amountTotal: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  status: string;
  payments: Payment[];
  consignment: { broker: { name: string; phoneWhatsapp: string | null } } | null;
  directSale: { customer: { name: string; phoneWhatsapp: string | null } } | null;
}

const MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

function partyName(inv: Invoice) {
  return inv.consignment?.broker.name ?? inv.directSale?.customer.name ?? "—";
}

function partyPhone(inv: Invoice) {
  return inv.consignment?.broker.phoneWhatsapp ?? inv.directSale?.customer.phoneWhatsapp ?? null;
}

function partyInitial(inv: Invoice) {
  return partyName(inv).charAt(0).toUpperCase();
}

function whatsappUrl(inv: Invoice) {
  const phone = partyPhone(inv);
  if (!phone) return null;
  const digits = phone.replace(/[\s\-+()]/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  const outstanding = inv.amountTotal - inv.amountPaid;
  const due = format(new Date(inv.dueDate), "dd MMM yyyy");
  const msg = `Dear ${partyName(inv)},\n\nThis is a gentle reminder for invoice *${inv.invoiceNo}* amounting to ₹${inv.amountTotal.toLocaleString("en-IN")}.\n\nDue date: ${due}\nOutstanding: *₹${outstanding.toLocaleString("en-IN")}*\n\nKindly arrange the payment at your earliest convenience.\n\nThank you.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "overdue" | "upcoming" | "paid">("all");
  const [page, setPage] = useState(1);
  const _pnow = new Date();
  const _pfy = _pnow.getMonth() >= 3 ? _pnow.getFullYear() : _pnow.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({
    from: `${_pfy}-04-01`,
    to: _pnow.toISOString().split("T")[0],
  });
  const [showRecord, setShowRecord] = useState<Invoice | null>(null);
  const [recordForm, setRecordForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    mode: "CASH",
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const params =
      filter === "overdue" ? "?overdue=true" :
      filter === "upcoming" ? "?upcoming=true" :
      filter === "paid" ? "?paid=true" : "";
    const res = await fetch(`/api/payments${params}`);
    if (res.ok) setInvoices(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal(inv: Invoice) {
    const outstanding = inv.amountTotal - inv.amountPaid;
    setRecordForm({
      amount: String(outstanding),
      paymentDate: new Date().toISOString().split("T")[0],
      mode: "CASH",
      reference: "",
      notes: "",
    });
    setShowRecord(inv);
  }

  async function recordPayment() {
    if (!showRecord || !recordForm.amount) return;
    setSaving(true);
    const combinedNotes = [
      recordForm.reference && `Ref: ${recordForm.reference}`,
      recordForm.notes,
    ].filter(Boolean).join(" | ") || undefined;

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: showRecord.id,
        amount: Number(recordForm.amount),
        paymentDate: recordForm.paymentDate,
        mode: recordForm.mode,
        notes: combinedNotes,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const outstanding = showRecord.amountTotal - showRecord.amountPaid;
      const isFullPayment = Number(recordForm.amount) >= outstanding;
      toast.success(isFullPayment ? "Invoice fully settled ✅" : "Payment recorded");
      setShowRecord(null);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to record payment");
    }
  }

  const dateFiltered = invoices.filter((inv) => {
    const d = new Date(inv.dueDate);
    return d >= new Date(dateRange.from) && d <= new Date(`${dateRange.to}T23:59:59`);
  });
  const PAGE_SIZE = 10;
  const paginated = dateFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalOutstanding = dateFiltered.reduce((s, inv) => s + (inv.amountTotal - inv.amountPaid), 0);
  const totalBilled = dateFiltered.reduce((s, inv) => s + inv.amountTotal, 0);
  const overdueCount = dateFiltered.filter((inv) => isPast(new Date(inv.dueDate)) && inv.status !== "PAID").length;
  const collectionRate = totalBilled > 0 ? Math.round(((totalBilled - totalOutstanding) / totalBilled) * 100) : 0;

  const modalOutstanding = showRecord ? showRecord.amountTotal - showRecord.amountPaid : 0;
  const isFullSettle = showRecord ? Number(recordForm.amount) >= modalOutstanding : false;
  const needsReference = ["BANK_TRANSFER", "UPI", "CHEQUE"].includes(recordForm.mode);

  const FILTER_TABS = [
    { key: "all",      label: "All",          icon: "📋" },
    { key: "overdue",  label: "Overdue",       icon: "🔴" },
    { key: "upcoming", label: "Upcoming (7d)", icon: "⏰" },
    { key: "paid",     label: "Paid",          icon: "✅" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track invoices, record payments &amp; send reminders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
          <ExportButton
            data={dateFiltered.map((inv) => ({
              Invoice: inv.invoiceNo,
              Party: partyName(inv),
              Type: inv.type,
              "Total (₹)": inv.amountTotal,
              "Paid (₹)": inv.amountPaid,
              "Outstanding (₹)": inv.amountTotal - inv.amountPaid,
              "Due Date": inv.dueDate,
              Status: inv.status,
            }))}
            filename={`payments_${dateRange.from}_${dateRange.to}`}
            label="Export"
          />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Outstanding */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</p>
            <span className="text-xl">💰</span>
          </div>
          <p className="text-2xl font-bold text-foreground">₹{totalOutstanding.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted-foreground mt-1">{dateFiltered.length} invoice{dateFiltered.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Overdue */}
        <div className={`rounded-2xl border p-5 shadow-sm ${overdueCount > 0 ? "bg-red-50 border-red-100" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-semibold uppercase tracking-wider ${overdueCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>Overdue</p>
            <span className="text-xl">⚠️</span>
          </div>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-foreground"}`}>{overdueCount}</p>
          <p className={`text-xs mt-1 ${overdueCount > 0 ? "text-red-400" : "text-muted-foreground"}`}>
            {overdueCount > 0 ? "Need immediate action" : "All on time"}
          </p>
        </div>

        {/* Collection Rate */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collected</p>
            <span className="text-xl">📈</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{collectionRate}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>

        {/* Total Billed */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Billed</p>
            <span className="text-xl">🧾</span>
          </div>
          <p className="text-2xl font-bold text-foreground">₹{totalBilled.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted-foreground mt-1">in selected period</p>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key as typeof filter); setPage(1); }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card hover:bg-accent text-foreground border-border"
            }`}
          >
            <span>{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Invoice Cards ── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="h-3.5 bg-muted rounded w-36" />
                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded-full w-24" />
                    <div className="h-5 bg-muted rounded-full w-20" />
                  </div>
                </div>
                <div className="h-7 bg-muted rounded-full w-20" />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="space-y-1.5">
                  <div className="h-5 bg-muted rounded w-28" />
                  <div className="h-3 bg-muted rounded w-40" />
                </div>
                <div className="h-9 bg-muted rounded-xl w-32" />
              </div>
              <div className="mt-3 h-1.5 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      ) : dateFiltered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <div className="text-4xl mb-3">{filter === "paid" ? "✅" : "🎉"}</div>
          <p className="font-semibold text-foreground">
            {filter === "paid" ? "No paid invoices in this period" : "No outstanding invoices"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "paid" ? "Payments will appear here once invoices are settled." : "You're all caught up!"}
          </p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {paginated.map((inv) => {
            const overdue = isPast(new Date(inv.dueDate)) && inv.status !== "PAID";
            const outstanding = inv.amountTotal - inv.amountPaid;
            const paidPct = inv.amountTotal > 0 ? (inv.amountPaid / inv.amountTotal) * 100 : 0;
            const daysOverdue = overdue ? differenceInDays(new Date(), new Date(inv.dueDate)) : 0;
            const name = partyName(inv);
            const waUrl = whatsappUrl(inv);

            return (
              <div
                key={inv.id}
                className={`rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow ${
                  overdue ? "border-red-200" : inv.status === "PAID" ? "border-emerald-200" : "border-border"
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(name)}`}>
                      {partyInitial(inv)}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{name}</p>
                            {/* Type badge */}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              inv.type === "CONSIGNMENT"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {inv.type === "CONSIGNMENT" ? "Consignment" : "Direct"}
                            </span>
                            {/* Status badge */}
                            {inv.status === "PAID" ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">✓ Paid</span>
                            ) : overdue ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 animate-pulse">
                                {daysOverdue}d overdue
                              </span>
                            ) : inv.status === "PARTIAL" ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Partial</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">Pending</span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{inv.invoiceNo}</p>
                        </div>

                        {/* Amount + actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            {inv.status === "PAID" ? (
                              <p className="text-lg font-bold text-emerald-600">
                                ₹{inv.amountTotal.toLocaleString("en-IN")}
                              </p>
                            ) : (
                              <>
                                <p className="text-lg font-bold text-foreground">
                                  ₹{outstanding.toLocaleString("en-IN")}
                                </p>
                                <p className="text-xs text-muted-foreground">of ₹{inv.amountTotal.toLocaleString("en-IN")}</p>
                              </>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Send WhatsApp reminder"
                                className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 hover:bg-green-100 border border-green-200 text-base transition-colors"
                              >
                                📲
                              </a>
                            )}
                            {inv.status !== "PAID" && (
                              <button
                                onClick={() => openModal(inv)}
                                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-xs font-semibold transition-colors shadow-sm whitespace-nowrap"
                              >
                                Record Payment
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {inv.amountTotal > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>
                              {inv.amountPaid > 0
                                ? `₹${inv.amountPaid.toLocaleString("en-IN")} paid`
                                : "No payment yet"}
                            </span>
                            <span>{Math.round(paidPct)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                inv.status === "PAID"
                                  ? "bg-emerald-500"
                                  : overdue
                                  ? "bg-red-400"
                                  : "bg-primary"
                              }`}
                              style={{ width: `${paidPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Due date row */}
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className={overdue ? "text-red-600 font-medium" : ""}>
                          Due: {format(new Date(inv.dueDate), "dd MMM yyyy")}
                          {overdue && " ⚠️"}
                        </span>
                        {inv.payments.length > 0 && (
                          <span>{inv.payments.length} payment{inv.payments.length > 1 ? "s" : ""} recorded</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={dateFiltered.length} onChange={setPage} />
        </>
      )}

      {/* ── Record Payment Modal ── */}
      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Record Payment</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {showRecord.invoiceNo} · {partyName(showRecord)}
                </p>
              </div>
              <button
                onClick={() => setShowRecord(null)}
                disabled={saving}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className={`px-6 py-5 space-y-5${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              {/* Invoice summary */}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Invoice Total</p>
                  <p className="font-bold text-foreground">₹{showRecord.amountTotal.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Already Paid</p>
                  <p className="font-bold text-emerald-600">₹{showRecord.amountPaid.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                  <p className="font-bold text-red-600">₹{modalOutstanding.toLocaleString("en-IN")}</p>
                </div>
              </div>

              {/* Progress */}
              {showRecord.amountTotal > 0 && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${(showRecord.amountPaid / showRecord.amountTotal) * 100}%` }}
                  />
                </div>
              )}

              {/* Previous payments */}
              {showRecord.payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Payment History
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {showRecord.payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">{format(new Date(p.paymentDate), "dd MMM yyyy")}</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground font-medium">
                          {MODE_LABELS[p.mode] ?? p.mode}
                        </span>
                        <span className="font-bold text-emerald-700 ml-auto">₹{p.amount.toLocaleString("en-IN")}</span>
                        {p.notes && <span className="text-muted-foreground/60 truncate max-w-[120px]">{p.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-foreground">Amount (₹) *</label>
                    <button
                      type="button"
                      onClick={() => setRecordForm((f) => ({ ...f, amount: String(modalOutstanding) }))}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Settle full ₹{modalOutstanding.toLocaleString("en-IN")} →
                    </button>
                  </div>
                  <input
                    type="number" min={0.01} step="0.01"
                    value={recordForm.amount}
                    onChange={(e) => setRecordForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Payment Date *</label>
                    <input
                      type="date"
                      value={recordForm.paymentDate}
                      onChange={(e) => setRecordForm((f) => ({ ...f, paymentDate: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Payment Mode *</label>
                    <select
                      value={recordForm.mode}
                      onChange={(e) => setRecordForm((f) => ({ ...f, mode: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                {needsReference && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                      {recordForm.mode === "CHEQUE" ? "Cheque Number" : "Transaction Ref / UTR"}
                    </label>
                    <input
                      value={recordForm.reference}
                      onChange={(e) => setRecordForm((f) => ({ ...f, reference: e.target.value }))}
                      placeholder={recordForm.mode === "CHEQUE" ? "Cheque No. 001234" : "UPI Ref or UTR number"}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Notes <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any remarks…"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {isFullSettle && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                  <span className="text-lg">✅</span>
                  This will fully settle the invoice and mark it as <strong>PAID</strong>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t px-6 py-4">
              <button
                onClick={() => setShowRecord(null)}
                disabled={saving}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={recordPayment}
                disabled={saving || !recordForm.amount || !recordForm.paymentDate}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 transition-colors flex items-center justify-center gap-2 ${
                  isFullSettle
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Recording…" : isFullSettle ? "✓ Record & Settle" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
