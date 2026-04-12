"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";
import { format } from "date-fns";
import { type DatePreset, DATE_PRESETS, getDateRange, getPresetLabel } from "@/lib/date-ranges";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { ExportButton } from "@/components/ExportButton";

interface Broker { id: string; name: string; }
interface InventoryItem { id: string; sku: string; stoneType: { name: string }; shape: { name: string }; size: { label: string }; color: { name: string }; grade: { label: string }; qtyPieces: number; sellingPriceEstimated: number | null; }
interface ConsignmentLine { itemId: string; qtyIssued: number; weightIssued: number | ""; estPricePerUnit: number; priceUnit: "per_pc" | "per_ct"; currency: string; }
interface Consignment {
  id: string;
  consignmentNo: string;
  date: string;
  status: string;
  broker: { name: string };
  lines: Array<{ qtyIssued: number; qtySold: number; qtyReturned: number; estPricePerUnit: number; meta: string | null }>;
  invoices: Array<{ amountTotal: number; amountPaid: number; status: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-muted-foreground",
  ACTIVE: "bg-blue-100 text-blue-700",
  PARTIALLY_RETURNED: "bg-yellow-100 text-yellow-700",
  FULLY_SOLD: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-muted-foreground",
};

export default function ConsignmentsPage() {
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUnit, setFilterUnit] = useState<"all" | "pc" | "ct" | "mixed">("all");
  const [search, setSearch] = useState("");
  const _cnow = new Date(); const _cfy = _cnow.getMonth() >= 3 ? _cnow.getFullYear() : _cnow.getFullYear() - 1;
  const [dateRange, setDateRange] = useState<DateRange>({ from: `${_cfy}-04-01`, to: _cnow.toISOString().split("T")[0] });
  const [form, setForm] = useState({ brokerId: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [formLines, setFormLines] = useState<ConsignmentLine[]>([{ itemId: "", qtyIssued: 0, weightIssued: "", estPricePerUnit: 0, priceUnit: "per_pc", currency: "INR" }]);
  const [page, setPage] = useState(1);

  async function loadMasterData() {
    const [bRes, iRes] = await Promise.all([fetch("/api/brokers"), fetch("/api/inventory")]);
    if (bRes.ok) setBrokers(await bRes.json());
    if (iRes.ok) setInventory(await iRes.json());
  }

  async function loadConsignments() {
    setLoading(true);
    const url = filterStatus ? `/api/sales/consignments?status=${filterStatus}` : "/api/sales/consignments";
    const res = await fetch(url);
    if (res.ok) setConsignments(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadMasterData(); }, []);
  useEffect(() => { loadConsignments(); setPage(1); }, [filterStatus]);

  function addLine() {
    setFormLines([...formLines, { itemId: "", qtyIssued: 0, weightIssued: "", estPricePerUnit: 0, priceUnit: "per_pc", currency: "INR" }]);
  }

  function removeLine(i: number) {
    setFormLines(formLines.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: string, value: string | number) {
    const updated = formLines.map((l, idx): ConsignmentLine => idx !== i ? l : ({ ...l, [field]: value } as ConsignmentLine));
    // Auto-fill price from inventory when SKU selected
    if (field === "itemId") {
      const inv = inventory.find((it) => it.id === value);
      if (inv?.sellingPriceEstimated) updated[i] = { ...updated[i], estPricePerUnit: inv.sellingPriceEstimated };
    }
    setFormLines(updated);
  }

  function closeForm() {
    setShowForm(false);
    setForm({ brokerId: "", date: new Date().toISOString().split("T")[0], notes: "" });
    setFormLines([{ itemId: "", qtyIssued: 0, weightIssued: "", estPricePerUnit: 0, priceUnit: "per_pc", currency: "INR" }]);
  }

  async function handleSave() {
    if (!form.brokerId) { toast.error("Please select a broker"); return; }
    if (formLines.some((l) => !l.itemId)) { toast.error("Please select an item for each line"); return; }
    if (formLines.some((l) => !(l.estPricePerUnit > 0))) { toast.error("Please enter a price greater than 0 for each item"); return; }
    if (formLines.some((l) => !((l.qtyIssued > 0) || (Number(l.weightIssued) > 0)))) {
      toast.error("Each item needs at least a qty or weight"); return;
    }
    setSaving(true);
    const payload = {
      ...form,
      lines: formLines.map((l) => ({
        ...l,
        weightIssued: l.weightIssued !== "" ? Number(l.weightIssued) : undefined,
        priceUnit: l.priceUnit,
      })),
    };
    const res = await fetch("/api/sales/consignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Consignment created");
      closeForm();
      loadConsignments();
    } else {
      const d = await res.json().catch(() => ({}));
      const msg = typeof d.error === "string" ? d.error : d.message ?? "Failed to create consignment";
      toast.error(msg);
    }
  }

  const totalValue = (c: Consignment) => c.lines.reduce((s, l) => {
    try {
      const m = l.meta ? JSON.parse(l.meta) : null;
      // Weight-tracked line: use weightIssued * price
      if (m && (m.unit === "WEIGHT" || (!m.unit && m.priceUnit === "per_ct"))) {
        return s + (Number(m.weightIssued) || 0) * l.estPricePerUnit;
      }
    } catch { /* ignore */ }
    return s + l.qtyIssued * l.estPricePerUnit;
  }, 0);

  // Compute issued / pending summary text for list row
  function linesSummary(c: Consignment): { issued: string; pending: string } {
    let pcIssued = 0, pcPending = 0;
    const wtIssued: Record<string, number> = {};
    const wtPending: Record<string, number> = {};
    for (const l of c.lines) {
      try {
        const m = l.meta ? JSON.parse(l.meta) : null;
        const isWeight = m && (m.unit === "WEIGHT" || (!m.unit && m.priceUnit === "per_ct"));
        if (isWeight) {
          const u: string = m.weightUnit ?? "ct";
          const wi = Number(m.weightIssued) || 0;
          const ws = Number(m.weightSold) || 0;
          const wr = Number(m.weightReturned) || 0;
          wtIssued[u] = (wtIssued[u] || 0) + wi;
          wtPending[u] = (wtPending[u] || 0) + (wi - ws - wr);
        } else {
          pcIssued += (l.qtyIssued || 0);
          pcPending += (l.qtyIssued || 0) - (l.qtySold || 0) - (l.qtyReturned || 0);
        }
      } catch {
        pcIssued += (l.qtyIssued || 0);
        pcPending += (l.qtyIssued || 0) - (l.qtySold || 0) - (l.qtyReturned || 0);
      }
    }
    const fmtWt = (map: Record<string, number>) =>
      Object.entries(map).map(([u, v]) => `${+v.toFixed(3)}${u}`).join(" + ");
    const parts = (pc: number, wt: Record<string, number>) => {
      const p: string[] = [];
      if (pc > 0 || Object.keys(wt).length === 0) p.push(`${pc} pc`);
      const w = fmtWt(wt); if (w) p.push(w);
      return p.join(" + ") || "0";
    };
    return { issued: parts(pcIssued, wtIssued), pending: parts(pcPending, wtPending) };
  }

  function consignmentUnitType(c: Consignment): "pc" | "ct" | "mixed" {
    let hasPC = false, hasWT = false;
    for (const l of c.lines) {
      try {
        const m = l.meta ? JSON.parse(l.meta) : null;
        if (m && (m.unit === "WEIGHT" || (!m.unit && m.priceUnit === "per_ct"))) hasWT = true;
        else hasPC = true;
      } catch { hasPC = true; }
    }
    if (hasPC && hasWT) return "mixed";
    if (hasWT) return "ct";
    return "pc";
  }

  const filtered = consignments.filter((c) => {
    const d = new Date(c.date);
    const inRange = d >= new Date(dateRange.from) && d <= new Date(`${dateRange.to}T23:59:59`);
    const matchSearch = !search || c.consignmentNo.toLowerCase().includes(search.toLowerCase()) || c.broker.name.toLowerCase().includes(search.toLowerCase());
    const matchUnit = filterUnit === "all" || consignmentUnitType(c) === filterUnit;
    return inRange && matchSearch && matchUnit;
  });
  const PAGE_SIZE = 10;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consignments</h1>
          <p className="text-sm text-muted-foreground mt-1">Broker consignment issuance and tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={filtered.map((c) => ({
              No: c.consignmentNo,
              Date: c.date,
              Broker: c.broker.name,
              Status: c.status,
              "Qty Issued": c.lines.reduce((s, l) => s + l.qtyIssued, 0),
              "Qty Sold": c.lines.reduce((s, l) => s + l.qtySold, 0),
              "Total Value (₹)": Math.round(totalValue(c)),
              "Invoice Status": c.invoices[0]?.status ?? "—",
            }))}
            filename={`consignments_${dateRange.from}_${dateRange.to}`}
            label="Export"
          />
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + New Consignment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Status</span>
          {["", "ACTIVE", "PARTIALLY_RETURNED", "FULLY_SOLD", "CLOSED"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs border ${filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
              {s || "All"}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search no. or broker…"
            className="ml-2 rounded-lg border bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Unit</span>
          {([["all", "All"], ["pc", "Pieces (pc)"], ["ct", "Weight (ct/g)"], ["mixed", "Mixed"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => { setFilterUnit(val); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs border ${filterUnit === val ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Period</span>
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
        </div>
      </div>

      {/* New Consignment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">New Consignment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Issue items to a broker for sale</p>
              </div>
              <button
                onClick={() => closeForm()}
                disabled={saving}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
              >✕</button>
            </div>

            {/* Body */}
            <div className={`overflow-y-auto flex-1 px-6 py-5 space-y-5 transition-opacity${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              {/* Broker + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Broker *</label>
                  <select value={form.brokerId} onChange={(e) => setForm({ ...form, brokerId: e.target.value })}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="">Select broker…</option>
                    {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>

              {/* Owner Note */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Owner Note <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Handle with care, priority broker, special pricing agreed…"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-foreground">Items *</label>
                  <button onClick={addLine} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formLines.map((line, i) => {
                    const selItem = inventory.find((it) => it.id === line.itemId);
                    return (
                      <div key={i} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                        {/* SKU selector */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <select
                              value={line.itemId}
                              onChange={(e) => updateLine(i, "itemId", e.target.value)}
                              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              <option value="">Select SKU…</option>
                              {inventory.filter((it) => it.qtyPieces > 0).map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.stoneType.name} · {it.color.name} · {it.grade.label} — {it.sku} ({it.qtyPieces} pcs)
                                </option>
                              ))}
                            </select>
                            {selItem && (
                              <p className="text-xs text-muted-foreground mt-1 pl-1">
                                {selItem.shape.name} · {selItem.size.label} · In stock: {selItem.qtyPieces} pcs
                              </p>
                            )}
                          </div>
                          {formLines.length > 1 && (
                            <button
                              onClick={() => removeLine(i)}
                              className="mt-1 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                            >✕</button>
                          )}
                        </div>

                        {/* Qty + Weight */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Pcs <span className="text-muted-foreground/60">(optional)</span>
                            </label>
                            <input
                              type="number"
                              value={line.qtyIssued || ""}
                              onChange={(e) => updateLine(i, "qtyIssued", e.target.value === "" ? 0 : Number(e.target.value))}
                              placeholder="0"
                              min={0}
                              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Weight (ct) <span className="text-muted-foreground/60">(optional)</span>
                            </label>
                            <input
                              type="number"
                              value={line.weightIssued}
                              onChange={(e) => updateLine(i, "weightIssued", e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="0.00"
                              min={0}
                              step="0.01"
                              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>

                        {/* Price + Unit toggle */}
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Price (₹) *</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={line.estPricePerUnit || ""}
                              onChange={(e) => updateLine(i, "estPricePerUnit", Number(e.target.value))}
                              placeholder="0.00"
                              min={0.01}
                              step="0.01"
                              className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            {/* per pc / per ct toggle */}
                            <div className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
                              <button
                                type="button"
                                onClick={() => updateLine(i, "priceUnit", "per_pc")}
                                className={`px-2.5 py-1.5 font-medium transition-colors ${line.priceUnit === "per_pc" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}
                              >per pc</button>
                              <button
                                type="button"
                                onClick={() => updateLine(i, "priceUnit", "per_ct")}
                                className={`px-2.5 py-1.5 font-medium transition-colors border-l border-border ${line.priceUnit === "per_ct" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}
                              >per ct</button>
                            </div>
                          </div>
                        </div>

                        {/* Line total preview */}
                        {line.estPricePerUnit > 0 && (line.qtyIssued > 0 || Number(line.weightIssued) > 0) && (() => {
                          const total = line.priceUnit === "per_ct"
                            ? Number(line.weightIssued) * line.estPricePerUnit
                            : line.qtyIssued * line.estPricePerUnit;
                          const basis = line.priceUnit === "per_ct"
                            ? `${line.weightIssued} ct × ₹${line.estPricePerUnit}/ct`
                            : `${line.qtyIssued} pcs × ₹${line.estPricePerUnit}/pc`;
                          return total > 0 ? (
                            <p className="text-xs text-muted-foreground text-right pr-1">
                              {basis} = <span className="font-semibold text-foreground">₹{total.toLocaleString("en-IN")}</span>
                            </p>
                          ) : null;
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Grand total preview */}
                {formLines.some((l) => l.estPricePerUnit > 0 && (l.qtyIssued > 0 || Number(l.weightIssued) > 0)) && (
                  <div className="mt-3 flex justify-end">
                    <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-2 text-sm">
                      <span className="text-muted-foreground">Est. Total: </span>
                      <span className="font-bold text-foreground">
                        ₹{formLines.reduce((s, l) => {
                          if (!l.estPricePerUnit) return s;
                          const lineTotal = l.priceUnit === "per_ct"
                            ? Number(l.weightIssued) * l.estPricePerUnit
                            : l.qtyIssued * l.estPricePerUnit;
                          return s + (lineTotal > 0 ? lineTotal : 0);
                        }, 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t px-6 py-4 shrink-0">
              <button
                onClick={() => closeForm()}
                disabled={saving}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-80 transition-colors flex items-center justify-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Creating…" : "Create Consignment"}
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Consignment No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Broker</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Issued</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Value</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-32 font-mono" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-28" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-24" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-16 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-16 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-20 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-20 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-12 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Consignment No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Broker</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Issued</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Value</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground/60">No consignments found</td></tr>
              ) : paginated.map((c) => {
                const { issued, pending } = linesSummary(c);
                return (
                <tr key={c.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{c.consignmentNo}</td>
                  <td className="px-4 py-3 text-foreground">{c.broker.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(c.date), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3 text-center">{c.lines.length}</td>
                  <td className="px-4 py-3 text-right text-xs text-foreground">{issued}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-blue-600">{pending}</td>
                  <td className="px-4 py-3 text-right">₹{totalValue(c).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/sales/consignments/${c.id}`} className="text-primary hover:underline text-xs">View →</Link>
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
