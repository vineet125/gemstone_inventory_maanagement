"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { type DatePreset, DATE_PRESETS, getDateRange, getPresetLabel } from "@/lib/date-ranges";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { ExportButton } from "@/components/ExportButton";
import { Pagination } from "@/components/Pagination";

interface InventoryItem { id: string; sku: string; qtyPieces: number; sellingPriceEstimated: number | null; stoneType: { name: string }; }
interface SaleLine { itemId: string; qty: number; pricePerUnit: number; currency: string; }
interface Sale {
  id: string;
  saleNo: string;
  date: string;
  status: string;
  customer: { name: string };
  lines: Array<{ qty: number; pricePerUnit: number }>;
  invoices: Array<{ amountTotal: number; amountPaid: number; status: string; dueDate: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export default function DirectSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const _dnow = new Date(); const _dfy = _dnow.getMonth() >= 3 ? _dnow.getFullYear() : _dnow.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({ from: `${_dfy}-04-01`, to: _dnow.toISOString().split("T")[0] });
  const [form, setForm] = useState({ customerName: "", customerPhone: "", date: new Date().toISOString().split("T")[0], paymentDays: "90", notes: "" });
  const [lines, setLines] = useState<SaleLine[]>([{ itemId: "", qty: 1, pricePerUnit: 0, currency: "INR" }]);
  const [page, setPage] = useState(1);

  async function loadSales() {
    setLoading(true);
    const res = await fetch("/api/sales/direct");
    if (res.ok) setSales(await res.json());
    setLoading(false);
  }

  async function loadInventory() {
    const res = await fetch("/api/inventory");
    if (res.ok) setInventory(await res.json());
  }

  useEffect(() => { loadSales(); loadInventory(); }, []);

  function updateLine(i: number, field: string, value: string | number) {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    if (field === "itemId") {
      const item = inventory.find((it) => it.id === value);
      if (item?.sellingPriceEstimated) updated[i].pricePerUnit = item.sellingPriceEstimated;
    }
    setLines(updated);
  }

  async function handleSave() {
    if (!form.customerName || lines.some((l) => !l.itemId || !l.pricePerUnit)) {
      toast.error("Fill all required fields");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/sales/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, paymentDays: Number(form.paymentDays), lines }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Sale created"); setShowForm(false); loadSales(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  const totalValue = (s: Sale) => s.lines.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0);

  const filtered = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= new Date(dateRange.from) && d <= new Date(`${dateRange.to}T23:59:59`);
  });
  const PAGE_SIZE = 10;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Direct Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">Customer direct sales with deferred payment</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={filtered.map((s) => ({
              No: s.saleNo,
              Date: s.date,
              Customer: s.customer.name,
              Status: s.status,
              "Total Value (₹)": Math.round(totalValue(s)),
              "Invoice Status": s.invoices[0]?.status ?? "—",
              "Due Date": s.invoices[0]?.dueDate ?? "—",
            }))}
            filename={`direct_sales_${dateRange.from}_${dateRange.to}`}
            label="Export"
          />
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + New Sale
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Period</span>
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Direct Sale</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Customer Name *</label>
                <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Customer name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone / WhatsApp</label>
                <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sale Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Payment Terms</label>
                <select value={form.paymentDays} onChange={(e) => setForm({ ...form, paymentDays: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Items *</label>
                <button onClick={() => setLines([...lines, { itemId: "", qty: 1, pricePerUnit: 0, currency: "INR" }])}
                  className="text-xs text-primary hover:underline">+ Add Item</button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
                  <div className="col-span-5">
                    <select value={line.itemId} onChange={(e) => updateLine(i, "itemId", e.target.value)}
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-xs">
                      <option value="">Select SKU</option>
                      {inventory.filter((it) => it.qtyPieces > 0).map((it) => (
                        <option key={it.id} value={it.id}>{it.sku} ({it.qtyPieces})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={line.qty} onChange={(e) => updateLine(i, "qty", Number(e.target.value))}
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-xs" min={1} placeholder="Qty" />
                  </div>
                  <div className="col-span-4">
                    <input type="number" value={line.pricePerUnit} onChange={(e) => updateLine(i, "pricePerUnit", Number(e.target.value))}
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-xs" placeholder="Price/pc" />
                  </div>
                  <div className="col-span-1">
                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-400 text-lg leading-none">×</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm font-medium text-foreground">
                Total: ₹{lines.reduce((s, l) => s + l.qty * l.pricePerUnit, 0).toLocaleString("en-IN")}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {saving ? "Creating..." : "Create Sale"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sale No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-32" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-28" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-24" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-16 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-20 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-24 mx-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sale No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground/60">No sales found</td></tr>
              ) : paginated.map((s) => (
                <tr key={s.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{s.saleNo}</td>
                  <td className="px-4 py-3 text-foreground">{s.customer.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(s.date), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3 text-right">₹{totalValue(s).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? ""}`}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {s.invoices[0] ? format(new Date(s.invoices[0].dueDate), "dd MMM yyyy") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>
    </div>
  );
}
