"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useRole } from "@/hooks/useRole";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { ExportButton } from "@/components/ExportButton";
import { Pagination } from "@/components/Pagination";

interface Batch {
  id: string;
  batchNo: string;
  stoneType: string | null;
  purchaseType: string;
  supplierName: string;
  purchaseDate: string;
  weightGrams: number;
  weightCarats: number;
  costAmount: number;
  currency: string;
  notes: string | null;
  createdBy: { name: string };
  stages: Array<{ stage: string; exitDate: string | null; weightIn: number }>;
  _count: { stages: number };
}

const PURCHASE_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  ROUGH_COLLECTION: { label: "🪨 Rough",        cls: "bg-stone-100 text-stone-700" },
  CUTTING:          { label: "✂️ Pre-cut",       cls: "bg-blue-100 text-blue-700" },
  SHAPING:          { label: "💎 Shaped",        cls: "bg-purple-100 text-purple-700" },
  POLISHING:        { label: "✨ Pre-polished",  cls: "bg-amber-100 text-amber-700" },
  INVENTORY_IN:     { label: "📦 Ready Item",    cls: "bg-green-100 text-green-700" },
};

interface StoneTypeOption { id: string; name: string; }

const STAGE_LABELS: Record<string, string> = {
  ROUGH_COLLECTION: "Material Received",
  CUTTING: "Cutting",
  SHAPING: "Shaping",
  POLISHING: "Polishing",
  INVENTORY_IN: "Inventory In",
};

const PURCHASE_TYPES = [
  { value: "ROUGH_COLLECTION", label: "🪨 Rough Stone", desc: "Bulk raw material — cuts distributed over time" },
  { value: "CUTTING",          label: "✂️ Pre-cut Stone", desc: "Already cut, starts at cutting stage" },
  { value: "SHAPING",          label: "💎 Shaped / Ghats", desc: "Already shaped, needs polishing" },
  { value: "POLISHING",        label: "✨ Pre-polished", desc: "Needs final polish only" },
  { value: "INVENTORY_IN",     label: "📦 Ready Item", desc: "Finished — goes straight to inventory" },
];

/** Grams distributed out of rough (sum of all CUTTING stage weightIn values) */
function distributedGrams(batch: Batch): number {
  return batch.stages
    .filter((s) => s.stage === "CUTTING")
    .reduce((sum, s) => sum + s.weightIn, 0);
}

/** Current active stage label — latest stage with no exit date */
function currentStage(batch: Batch): { stage: string; label: string } | null {
  const active = batch.stages.filter((s) => !s.exitDate);
  if (active.length === 0) return null;
  // Use the last one in array order (stages are ordered by entryDate asc from API)
  const last = active[active.length - 1];
  return { stage: last.stage, label: STAGE_LABELS[last.stage] ?? last.stage };
}

export default function BatchesPage() {
  const isAdmin = useIsAdmin();
  const role = useRole();
  const isStaff = role === "STAFF";
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stoneTypes, setStoneTypes] = useState<StoneTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const _bnow = new Date(); const _bfy = _bnow.getMonth() >= 3 ? _bnow.getFullYear() : _bnow.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({ from: `${_bfy}-04-01`, to: _bnow.toISOString().split("T")[0] });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    purchaseType: "ROUGH_COLLECTION",
    stoneType: "", supplierName: "", purchaseDate: "",
    weight: "", weightUnit: "g", costAmount: "", currency: "INR", notes: "",
  });
  const [editing, setEditing] = useState<Batch | null>(null);
  const [editForm, setEditForm] = useState({
    batchNo: "", stoneType: "", purchaseType: "ROUGH_COLLECTION", supplierName: "", purchaseDate: "", weight: "", weightUnit: "g",
    costAmount: "", currency: "INR", notes: "",
  });

  /** Convert weight value to grams based on selected unit */
  function toGrams(value: string, unit: string) {
    const n = Number(value);
    if (unit === "ct") return n * 0.2;
    if (unit === "kg") return n * 1000;
    return n; // g
  }

  function openEdit(batch: Batch) {
    setEditing(batch);
    setEditForm({
      batchNo: batch.batchNo,
      stoneType: batch.stoneType ?? "",
      purchaseType: batch.purchaseType ?? "ROUGH_COLLECTION",
      supplierName: batch.supplierName,
      purchaseDate: batch.purchaseDate.slice(0, 10),
      weight: String(batch.weightGrams),
      weightUnit: "g",
      costAmount: String(batch.costAmount),
      currency: batch.currency,
      notes: batch.notes ?? "",
    });
  }

  async function handleUpdate() {
    if (!editing) return;
    if (!editForm.supplierName) { toast.error("Supplier Name is required"); return; }
    if (!editForm.purchaseDate) { toast.error("Purchase Date is required"); return; }
    if (!editForm.weight || Number(editForm.weight) <= 0) { toast.error("Weight must be greater than 0"); return; }
    if (!isStaff && (!editForm.costAmount || Number(editForm.costAmount) <= 0)) { toast.error("Cost Amount must be greater than 0"); return; }

    const wg = toGrams(editForm.weight, editForm.weightUnit);
    setSaving(true);
    const res = await fetch(`/api/manufacturing/batches/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchNo: editForm.batchNo || undefined,
        stoneType: editForm.stoneType || null,
        purchaseType: editForm.purchaseType,
        supplierName: editForm.supplierName,
        purchaseDate: editForm.purchaseDate,
        weightGrams: wg,
        weightCarats: wg * 5,
        costAmount: Number(editForm.costAmount),
        currency: editForm.currency,
        notes: editForm.notes || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed to update order");
      return;
    }
    toast.success("Order updated");
    setEditing(null);
    load();
  }

  async function load() {
    const [bRes, stRes] = await Promise.all([
      fetch("/api/manufacturing/batches"),
      fetch("/api/catalog/stone-types"),
    ]);
    if (bRes.ok) setBatches(await bRes.json());
    if (stRes.ok) setStoneTypes(await stRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.supplierName) { toast.error("Supplier Name is required"); return; }
    if (!form.purchaseDate) { toast.error("Purchase Date is required"); return; }
    if (!form.weight || Number(form.weight) <= 0) { toast.error("Weight must be greater than 0"); return; }
    if (!isStaff && (!form.costAmount || Number(form.costAmount) <= 0)) { toast.error("Cost Amount must be greater than 0"); return; }

    const wg = toGrams(form.weight, form.weightUnit);
    setSaving(true);
    const res = await fetch("/api/manufacturing/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stoneType: form.stoneType || undefined,
        purchaseType: form.purchaseType,
        supplierName: form.supplierName,
        purchaseDate: form.purchaseDate,
        weightGrams: wg,
        weightCarats: wg * 5,
        costAmount: Number(form.costAmount),
        currency: form.currency,
        notes: form.notes || undefined,
      }),
    });

    if (!res.ok) {
      setSaving(false);
      const d = await res.json();
      toast.error(d.error ?? "Something went wrong");
      return;
    }

    const newBatch = await res.json();

    // Auto-create initial stage entry for non-rough purchase types
    if (form.purchaseType !== "ROUGH_COLLECTION") {
      await fetch("/api/manufacturing/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: newBatch.id,
          stage: form.purchaseType,
          entryDate: form.purchaseDate,
          weightIn: wg,
        }),
      });
    }

    setSaving(false);
    toast.success("Purchase order created");
    setShowForm(false);
    setForm({ purchaseType: "ROUGH_COLLECTION", stoneType: "", supplierName: "", purchaseDate: "", weight: "", weightUnit: "g", costAmount: "", currency: "INR", notes: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Track all material purchases — rough, pre-cut, shaped, or finished.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={batches.filter((b) => {
              const d = new Date(b.purchaseDate);
              return d >= new Date(dateRange.from) && d <= new Date(`${dateRange.to}T23:59:59`);
            }).map((b) => ({
              "PO No": b.batchNo,
              "Purchase Date": b.purchaseDate,
              Type: b.purchaseType,
              "Stone Type": b.stoneType ?? "",
              Supplier: b.supplierName,
              "Weight (g)": b.weightGrams,
              "Weight (ct)": b.weightCarats,
              ...(!isStaff && { "Cost (₹)": b.costAmount }),
              Currency: b.currency,
              Stages: b._count.stages,
              Notes: b.notes ?? "",
            }))}
            filename={`purchase_orders_${dateRange.from}_${dateRange.to}`}
            label="Export"
          />
          <button onClick={() => setShowForm(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + New Order
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Period</span>
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Purchase Order</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">What are you purchasing? *</label>
              <div className="grid grid-cols-1 gap-2">
                {PURCHASE_TYPES.map((t) => (
                  <label key={t.value}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      form.purchaseType === t.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-border"
                    }`}>
                    <input type="radio" name="purchaseType" value={t.value}
                      checked={form.purchaseType === t.value}
                      onChange={(e) => setForm({ ...form, purchaseType: e.target.value })}
                      className="accent-primary" />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground/60">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Purchase Date *</label>
                <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Stone Type</label>
                <select value={form.stoneType} onChange={(e) => setForm({ ...form, stoneType: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select stone type —</option>
                  {stoneTypes.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Supplier Name *</label>
                <input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Supplier name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Weight *</label>
                <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Unit</label>
                <select value={form.weightUnit} onChange={(e) => setForm({ ...form, weightUnit: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="g">Grams (g)</option>
                  <option value="ct">Carats (ct)</option>
                  <option value="kg">Kilograms (kg)</option>
                </select>
              </div>
              {!isStaff && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cost Amount *</label>
                <input type="number" value={form.costAmount} onChange={(e) => setForm({ ...form, costAmount: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="25000" />
              </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option>INR</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Purchase Order — <span className="font-mono text-sm">{editing.batchNo}</span></h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">PO Number</label>
                <input value={editForm.batchNo} onChange={(e) => setEditForm({ ...editForm, batchNo: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Purchase Type</label>
                <select value={editForm.purchaseType} onChange={(e) => setEditForm({ ...editForm, purchaseType: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {PURCHASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Stone Type</label>
                <select value={editForm.stoneType} onChange={(e) => setEditForm({ ...editForm, stoneType: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select stone type —</option>
                  {stoneTypes.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Supplier Name *</label>
                <input value={editForm.supplierName} onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Purchase Date *</label>
                <input type="date" value={editForm.purchaseDate} onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
                <select value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option>INR</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Weight *</label>
                <input type="number" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Unit</label>
                <select value={editForm.weightUnit} onChange={(e) => setEditForm({ ...editForm, weightUnit: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="g">Grams (g)</option>
                  <option value="ct">Carats (ct)</option>
                  <option value="kg">Kilograms (kg)</option>
                </select>
              </div>
              {!isStaff && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Cost Amount *</label>
                <input type="number" value={editForm.costAmount} onChange={(e) => setEditForm({ ...editForm, costAmount: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleUpdate} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Purchased (g)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Distributed (g)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Remaining (g)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-24" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-20" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-16" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-28" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-20" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-14 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-14 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-14 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-20 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-10 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (() => {
          const filtered = batches.filter((b) => {
            const d = new Date(b.purchaseDate);
            return d >= new Date(dateRange.from) && d <= new Date(`${dateRange.to}T23:59:59`);
          });
          const PAGE_SIZE = 10;
          const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          return filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground/60">No purchase orders in selected period.</div>
          ) : (
          <>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Purchased (g)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Distributed (g)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Remaining (g)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((batch) => {
                const dist = distributedGrams(batch);
                const remaining = batch.weightGrams - dist;
                const stage = currentStage(batch);
                const allDone = batch.stages.length > 0 && batch.stages.every((s) => !!s.exitDate);
                return (
                  <tr key={batch.id} className="hover:bg-accent">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{batch.batchNo}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const b = PURCHASE_TYPE_BADGE[batch.purchaseType ?? "ROUGH_COLLECTION"] ?? PURCHASE_TYPE_BADGE.ROUGH_COLLECTION;
                        return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-foreground">{batch.stoneType ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-foreground">{batch.supplierName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(batch.purchaseDate), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3 text-right text-foreground">{batch.weightGrams.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{dist > 0 ? dist.toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={remaining < 0 ? "text-red-600 font-semibold" : remaining === 0 ? "text-muted-foreground/60" : "text-green-700 font-medium"}>
                        {remaining.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        // For rough batches, "in stock" takes priority while material remains
                        const isRough = (batch.purchaseType ?? "ROUGH_COLLECTION") === "ROUGH_COLLECTION";
                        if (allDone) {
                          return <span className="inline-flex rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">✓ Done</span>;
                        }
                        if (stage && (!isRough || remaining <= 0)) {
                          return (
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PURCHASE_TYPE_BADGE[stage.stage]?.cls ?? "bg-gray-100 text-foreground"}`}>
                              {stage.label}
                            </span>
                          );
                        }
                        if (isRough && remaining > 0) {
                          return <span className="inline-flex rounded-full bg-stone-100 text-stone-600 px-2.5 py-0.5 text-xs font-medium">In stock</span>;
                        }
                        return <span className="text-gray-300 text-xs">Not started</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {isAdmin && (
                          <button onClick={() => openEdit(batch)} className="text-muted-foreground hover:text-foreground text-xs font-medium">
                            Edit
                          </button>
                        )}
                        <Link href={`/manufacturing/batches/${batch.id}`} className="text-primary hover:underline text-xs font-medium">
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
          </>
          );
        })()}
      </div>
    </div>
  );
}
