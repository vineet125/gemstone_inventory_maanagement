"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

// ─── Meta ─────────────────────────────────────────────────────────────────────

interface LineMeta {
  unit: "PC" | "WEIGHT" | "BOTH";
  weightUnit: "g" | "ct" | "kg";
  weightIssued: number;
  weightSold: number;
  weightReturned: number;
  notes: string;
}

const META_DEFAULTS: LineMeta = {
  unit: "PC", weightUnit: "g", weightIssued: 0, weightSold: 0, weightReturned: 0, notes: "",
};

function parseMeta(s: string | null | undefined): LineMeta {
  if (!s) return { ...META_DEFAULTS };
  try { return { ...META_DEFAULTS, ...JSON.parse(s) }; }
  catch { return { ...META_DEFAULTS }; }
}

function fmtQty(qty: number, meta: LineMeta, field: "issued" | "sold" | "returned"): string {
  const wt = field === "issued" ? meta.weightIssued : field === "sold" ? meta.weightSold : meta.weightReturned;
  if (meta.unit === "PC")     return `${qty}`;
  if (meta.unit === "WEIGHT") return `${wt}${meta.weightUnit}`;
  return `${qty} / ${wt}${meta.weightUnit}`;
}

function fmtPending(qty: number, meta: LineMeta): { value: string; raw: number } {
  if (meta.unit === "PC") return { value: String(qty), raw: qty };
  if (meta.unit === "WEIGHT") {
    const wPending = meta.weightIssued - meta.weightSold - meta.weightReturned;
    return { value: `${Number(wPending.toFixed(3))}${meta.weightUnit}`, raw: wPending };
  }
  const wPending = meta.weightIssued - meta.weightSold - meta.weightReturned;
  return { value: `${qty} / ${Number(wPending.toFixed(3))}${meta.weightUnit}`, raw: qty > 0 || wPending > 0.001 ? 1 : 0 };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsignmentLine {
  id: string;
  qtyIssued: number;
  estPricePerUnit: number;
  qtySold: number;
  qtyReturned: number;
  actualPricePerUnit: number | null;
  currency: string;
  meta: string | null;
  item: {
    sku: string;
    stoneType: { name: string };
    shape: { name: string };
    size: { label: string };
    color: { name: string; hexCode: string };
    grade: { label: string };
  };
}

interface Consignment {
  id: string;
  consignmentNo: string;
  date: string;
  status: string;
  notes: string | null;
  broker: { id: string; name: string; phoneWhatsapp: string | null };
  lines: ConsignmentLine[];
  invoices: Array<{
    id: string;
    amountTotal: number;
    amountPaid: number;
    status: string;
    dueDate: string;
    payments: Array<{ id: string; amount: number; paymentDate: string; mode: string }>;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-muted-foreground",
  ACTIVE: "bg-blue-100 text-blue-700",
  PARTIALLY_RETURNED: "bg-yellow-100 text-yellow-700",
  FULLY_SOLD: "bg-green-100 text-green-700",
  CLOSED: "bg-purple-100 text-purple-700",
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  OVERDUE: "bg-red-100 text-red-700",
};

const UNIT_LABELS: Record<string, string> = { PC: "Pieces", WEIGHT: "Weight", BOTH: "Both" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [consignment, setConsignment] = useState<Consignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sold modal
  const [soldModal, setSoldModal] = useState<{
    lineId: string; sku: string;
    maxQty: number; maxWeight: number;
    meta: LineMeta; defaultPrice: number;
  } | null>(null);
  const [soldQty, setSoldQty] = useState(0);
  const [soldWeight, setSoldWeight] = useState<number | "">("");
  const [soldPrice, setSoldPrice] = useState<number | "">("");

  // Return modal
  const [returnModal, setReturnModal] = useState<{
    lineId: string; sku: string;
    maxQty: number; maxWeight: number; meta: LineMeta;
  } | null>(null);
  const [returnQty, setReturnQty] = useState(0);
  const [returnWeight, setReturnWeight] = useState<number | "">("");

  // Status modal
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  // Payment modal
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", mode: "CASH", notes: "" });

  // Edit line meta modal
  const [editMetaModal, setEditMetaModal] = useState<{ lineId: string; sku: string } | null>(null);
  const [editMetaForm, setEditMetaForm] = useState<LineMeta>({ ...META_DEFAULTS });

  async function load() {
    const res = await fetch(`/api/sales/consignments/${id}`);
    if (res.ok) setConsignment(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus() {
    setSaving(true);
    const res = await fetch(`/api/sales/consignments/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Status updated"); setStatusModal(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  async function markSold() {
    if (!soldModal) return;
    const meta = soldModal.meta;
    const needsQty = meta.unit !== "WEIGHT";
    const needsWeight = meta.unit !== "PC";
    if (needsQty && (!soldQty || soldQty < 1)) { toast.error("Enter qty sold"); return; }
    if (needsWeight && (!soldWeight || Number(soldWeight) <= 0)) { toast.error("Enter weight sold"); return; }
    setSaving(true);
    const res = await fetch(`/api/sales/consignments/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soldLines: [{
          lineId: soldModal.lineId,
          qtySold: needsQty ? soldQty : 0,
          ...(needsWeight && { weightSold: Number(soldWeight) }),
          ...(soldPrice !== "" && { actualPricePerUnit: Number(soldPrice) }),
        }],
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Marked as sold"); setSoldModal(null); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  async function markReturned() {
    if (!returnModal) return;
    const meta = returnModal.meta;
    const needsQty = meta.unit !== "WEIGHT";
    const needsWeight = meta.unit !== "PC";
    if (needsQty && (!returnQty || returnQty < 1)) { toast.error("Enter qty returned"); return; }
    if (needsWeight && (!returnWeight || Number(returnWeight) <= 0)) { toast.error("Enter weight returned"); return; }
    setSaving(true);
    const res = await fetch(`/api/sales/consignments/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returnLines: [{
          lineId: returnModal.lineId,
          qtyReturned: needsQty ? returnQty : 0,
          ...(needsWeight && { weightReturned: Number(returnWeight) }),
        }],
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Returned to inventory"); setReturnModal(null); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  async function saveLineMeta() {
    if (!editMetaModal) return;
    setSaving(true);
    const res = await fetch(`/api/sales/consignments/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateLineMeta: [{
          lineId: editMetaModal.lineId,
          unit: editMetaForm.unit,
          weightUnit: editMetaForm.weightUnit,
          weightIssued: editMetaForm.weightIssued,
          notes: editMetaForm.notes,
        }],
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Line details saved"); setEditMetaModal(null); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  async function recordPayment() {
    if (!consignment || !paymentForm.amount) return;
    const invoice = consignment.invoices[0];
    if (!invoice) return;
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amount: Number(paymentForm.amount),
        paymentDate: new Date().toISOString().split("T")[0],
        mode: paymentForm.mode,
        notes: paymentForm.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Payment recorded"); setPaymentModal(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>;
  if (!consignment) return <div className="p-8 text-center text-sm text-red-400">Consignment not found.</div>;

  const invoice = consignment.invoices[0];
  const outstanding = invoice ? invoice.amountTotal - invoice.amountPaid : 0;
  const totalIssued   = consignment.lines.reduce((s, l) => s + l.qtyIssued, 0);
  const totalSold     = consignment.lines.reduce((s, l) => s + l.qtySold, 0);
  const totalReturned = consignment.lines.reduce((s, l) => s + l.qtyReturned, 0);
  const totalPending  = totalIssued - totalSold - totalReturned;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/sales/consignments" className="text-sm text-muted-foreground/60 hover:text-muted-foreground">← All Consignments</Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{consignment.consignmentNo}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <Link href={`/brokers/${consignment.broker.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
              👥 {consignment.broker.name}
            </Link>
            <span className="text-xs text-muted-foreground/60">{format(new Date(consignment.date), "dd MMM yyyy")}</span>
          </div>
        </div>
        <button
          onClick={() => { setNewStatus(consignment.status); setStatusModal(true); }}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer hover:opacity-80 ${STATUS_COLORS[consignment.status] ?? "bg-gray-100 text-muted-foreground"}`}
          title="Click to change status"
        >
          {consignment.status.replace(/_/g, " ")} <span className="opacity-60">▾</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Issued</p>
          <p className="text-2xl font-bold text-foreground">{totalIssued}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Sold</p>
          <p className="text-2xl font-bold text-green-600">{totalSold}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Returned</p>
          <p className="text-2xl font-bold text-yellow-600">{totalReturned}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Pending (pc)</p>
          <p className={`text-2xl font-bold ${totalPending < 0 ? "text-red-600" : totalPending === 0 ? "text-muted-foreground/60" : "text-blue-600"}`}>
            {totalPending}
          </p>
        </div>
      </div>

      {/* Invoice & Payment */}
      {invoice ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Invoice & Payment</h2>
            {outstanding > 0 ? (
              <button onClick={() => { setPaymentForm({ amount: String(outstanding), mode: "CASH", notes: "" }); setPaymentModal(true); }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                + Record Payment
              </button>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Fully Paid</span>
            )}
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div><p className="text-xs text-muted-foreground mb-0.5">Invoice Value</p><p className="font-semibold">₹{invoice.amountTotal.toLocaleString("en-IN")}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Paid</p><p className="font-semibold text-green-600">₹{invoice.amountPaid.toLocaleString("en-IN")}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Outstanding</p><p className={`font-semibold ${outstanding > 0 ? "text-red-600" : "text-muted-foreground/60"}`}>₹{outstanding.toLocaleString("en-IN")}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Due Date</p><p className="font-semibold">{format(new Date(invoice.dueDate), "dd MMM yyyy")}</p></div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[invoice.status] ?? "bg-gray-100 text-muted-foreground"}`}>
                {invoice.status}
              </span>
            </div>
          </div>
          {invoice.payments.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Payment History</p>
              <div className="space-y-1.5">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{format(new Date(p.paymentDate), "dd MMM yyyy")} · <span className="text-muted-foreground/60">{p.mode}</span></span>
                    <span className="font-semibold text-foreground">₹{p.amount.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : totalSold > 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Items sold but no invoice yet — will generate on next sale update.</p>
        </div>
      ) : null}

      {/* Line Items Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/40">
          <h2 className="text-sm font-semibold text-foreground">Items ({consignment.lines.length})</h2>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Click ✏ on any row to set unit type (PC / Weight / Both) and add notes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">SKU</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Description</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Unit</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Issued</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Sold</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Returned</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Pending</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Price</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Sold Value</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {consignment.lines.map((line) => {
                const meta = parseMeta(line.meta);
                const pending = fmtPending(line.qtyIssued - line.qtySold - line.qtyReturned, meta);
                const isWeightBased = meta.unit !== "PC";
                const soldValue = meta.unit === "WEIGHT"
                  ? meta.weightSold * (line.actualPricePerUnit ?? line.estPricePerUnit)
                  : line.qtySold * (line.actualPricePerUnit ?? line.estPricePerUnit);
                const priceLabel = meta.unit === "WEIGHT" ? `/${meta.weightUnit}` : "/pc";
                const unitBadgeColor = meta.unit === "WEIGHT" ? "bg-purple-50 text-purple-700"
                  : meta.unit === "BOTH" ? "bg-amber-50 text-amber-700"
                  : "bg-gray-100 text-muted-foreground";

                return (
                  <tr key={line.id} className="hover:bg-accent">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{line.item.sku}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
                          style={{ backgroundColor: line.item.color.hexCode || "#ccc" }} />
                        {line.item.stoneType.name} · {line.item.shape.name} · {line.item.size.label} · {line.item.grade.label}
                      </div>
                      {meta.notes && (
                        <p className="text-muted-foreground/60 italic mt-0.5 text-xs">📝 {meta.notes}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${unitBadgeColor}`}>
                        {meta.unit === "BOTH" ? `PC+${meta.weightUnit}` : meta.unit === "WEIGHT" ? meta.weightUnit : "PC"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-foreground text-xs font-medium">
                      {fmtQty(line.qtyIssued, meta, "issued")}
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-medium text-green-600">
                      {fmtQty(line.qtySold, meta, "sold")}
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-medium text-yellow-600">
                      {fmtQty(line.qtyReturned, meta, "returned")}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      <span className={pending.raw < 0 ? "font-bold text-red-600" : pending.raw > 0.001 ? "font-medium text-blue-600" : "text-muted-foreground/60"}>
                        {pending.value}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground text-xs">
                      ₹{line.estPricePerUnit.toLocaleString("en-IN")}
                      <span className="text-muted-foreground/60">{priceLabel}</span>
                      {line.actualPricePerUnit && line.actualPricePerUnit !== line.estPricePerUnit && (
                        <span className="block text-green-600">actual: ₹{line.actualPricePerUnit.toLocaleString("en-IN")}{priceLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                      {soldValue > 0 ? `₹${soldValue.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {/* Sold / Return actions */}
                        {pending.raw > 0.001 && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const maxQty = line.qtyIssued - line.qtySold - line.qtyReturned;
                                const maxWt = meta.weightIssued - meta.weightSold - meta.weightReturned;
                                setSoldModal({ lineId: line.id, sku: line.item.sku, maxQty, maxWeight: maxWt, meta, defaultPrice: line.estPricePerUnit });
                                setSoldQty(meta.unit !== "WEIGHT" ? maxQty : 0);
                                setSoldWeight(meta.unit !== "PC" ? Number(maxWt.toFixed(3)) : "");
                                setSoldPrice(line.actualPricePerUnit ?? line.estPricePerUnit);
                              }}
                              className="rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 font-medium whitespace-nowrap">
                              Sold
                            </button>
                            <button
                              onClick={() => {
                                const maxQty = line.qtyIssued - line.qtySold - line.qtyReturned;
                                const maxWt = meta.weightIssued - meta.weightSold - meta.weightReturned;
                                setReturnModal({ lineId: line.id, sku: line.item.sku, maxQty, maxWeight: maxWt, meta });
                                setReturnQty(meta.unit !== "WEIGHT" ? maxQty : 0);
                                setReturnWeight(meta.unit !== "PC" ? Number(maxWt.toFixed(3)) : "");
                              }}
                              className="rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-100 font-medium whitespace-nowrap">
                              Return
                            </button>
                          </div>
                        )}
                        {/* Edit line details */}
                        <button
                          onClick={() => { setEditMetaModal({ lineId: line.id, sku: line.item.sku }); setEditMetaForm({ ...meta }); }}
                          className="text-xs text-muted-foreground/60 hover:text-primary text-left"
                          title="Edit unit type, weight and notes"
                        >
                          ✏ Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {consignment.notes && (
        <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-800">
          <span className="font-medium">Notes: </span>{consignment.notes}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Mark Sold Modal */}
      {soldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Mark Items Sold</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {soldModal.sku}
              {soldModal.meta.unit === "PC" && ` — max ${soldModal.maxQty} pc`}
              {soldModal.meta.unit === "WEIGHT" && ` — max ${soldModal.maxWeight.toFixed(3)}${soldModal.meta.weightUnit}`}
              {soldModal.meta.unit === "BOTH" && ` — max ${soldModal.maxQty} pc / ${soldModal.maxWeight.toFixed(3)}${soldModal.meta.weightUnit}`}
            </p>
            <div className="space-y-3">
              {soldModal.meta.unit !== "WEIGHT" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Qty Sold (pc) *</label>
                  <input type="number" value={soldQty} onChange={(e) => setSoldQty(Number(e.target.value))}
                    min={0} max={soldModal.maxQty}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
              )}
              {soldModal.meta.unit !== "PC" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Weight Sold ({soldModal.meta.weightUnit}) *
                  </label>
                  <input type="number" step="0.001" value={soldWeight}
                    onChange={(e) => setSoldWeight(e.target.value === "" ? "" : Number(e.target.value))}
                    min={0} max={soldModal.maxWeight}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Actual Price / {soldModal.meta.unit === "WEIGHT" ? soldModal.meta.weightUnit : "pc"}{" "}
                  <span className="font-normal text-muted-foreground/60">(optional)</span>
                </label>
                <input type="number" value={soldPrice}
                  onChange={(e) => setSoldPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder={`Default: ₹${soldModal.defaultPrice.toLocaleString("en-IN")}`} />
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setSoldModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={markSold} disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "Saving..." : "Confirm Sold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Return to Inventory</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {returnModal.sku}
              {returnModal.meta.unit === "PC" && ` — max ${returnModal.maxQty} pc`}
              {returnModal.meta.unit === "WEIGHT" && ` — max ${returnModal.maxWeight.toFixed(3)}${returnModal.meta.weightUnit}`}
              {returnModal.meta.unit === "BOTH" && ` — max ${returnModal.maxQty} pc / ${returnModal.maxWeight.toFixed(3)}${returnModal.meta.weightUnit}`}
            </p>
            <div className="space-y-3">
              {returnModal.meta.unit !== "WEIGHT" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Qty Returned (pc) *</label>
                  <input type="number" value={returnQty} onChange={(e) => setReturnQty(Number(e.target.value))}
                    min={0} max={returnModal.maxQty}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
              )}
              {returnModal.meta.unit !== "PC" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Weight Returned ({returnModal.meta.weightUnit}) *
                  </label>
                  <input type="number" step="0.001" value={returnWeight}
                    onChange={(e) => setReturnWeight(e.target.value === "" ? "" : Number(e.target.value))}
                    min={0} max={returnModal.maxWeight}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setReturnModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={markReturned} disabled={saving}
                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "Saving..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Line Details Modal */}
      {editMetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Line Details</h2>
            <p className="text-sm text-muted-foreground mb-4">{editMetaModal.sku}</p>
            <div className="space-y-4">
              {/* Unit type */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Tracking Unit</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PC", "WEIGHT", "BOTH"] as const).map((u) => (
                    <button key={u} type="button"
                      onClick={() => setEditMetaForm((f) => ({ ...f, unit: u }))}
                      className={`rounded-lg border py-2 text-xs font-medium transition-colors ${editMetaForm.unit === u ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {UNIT_LABELS[u]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight unit + weight issued — shown for WEIGHT and BOTH */}
              {editMetaForm.unit !== "PC" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Weight Unit</label>
                    <div className="flex gap-2">
                      {(["g", "ct", "kg"] as const).map((wu) => (
                        <button key={wu} type="button"
                          onClick={() => setEditMetaForm((f) => ({ ...f, weightUnit: wu }))}
                          className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${editMetaForm.weightUnit === wu ? "bg-purple-500 border-purple-500 text-white" : "border-border text-muted-foreground hover:border-purple-300"}`}>
                          {wu === "g" ? "Grams (g)" : wu === "ct" ? "Carats (ct)" : "Kilograms (kg)"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Total Weight Issued ({editMetaForm.weightUnit})
                    </label>
                    <input type="number" step="0.001" min={0}
                      value={editMetaForm.weightIssued || ""}
                      onChange={(e) => setEditMetaForm((f) => ({ ...f, weightIssued: Number(e.target.value) }))}
                      placeholder="e.g. 25.500"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Notes <span className="font-normal text-muted-foreground/60">(optional)</span>
                </label>
                <input value={editMetaForm.notes}
                  onChange={(e) => setEditMetaForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Special instructions, handling notes…"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setEditMetaModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={saveLineMeta} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Change Status</h2>
            <div className="space-y-2">
              {(["DRAFT", "ACTIVE", "PARTIALLY_RETURNED", "FULLY_SOLD", "CLOSED"] as const).map((s) => (
                <button key={s} onClick={() => setNewStatus(s)}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium text-left transition-colors ${newStatus === s ? "ring-2 ring-primary " : ""}${STATUS_COLORS[s] ?? "bg-gray-100 text-muted-foreground"}`}>
                  {s.replace(/_/g, " ")}
                  {s === "ACTIVE" && <span className="ml-2 text-xs opacity-70">— items still with broker</span>}
                  {s === "PARTIALLY_RETURNED" && <span className="ml-2 text-xs opacity-70">— some returned</span>}
                  {s === "FULLY_SOLD" && <span className="ml-2 text-xs opacity-70">— all items sold</span>}
                  {s === "CLOSED" && <span className="ml-2 text-xs opacity-70">— manually close</span>}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setStatusModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={changeStatus} disabled={saving || newStatus === consignment.status}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Saving..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModal && invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Record Payment</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {consignment.consignmentNo} · Outstanding ₹{outstanding.toLocaleString("en-IN")}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount (₹) *</label>
                <input type="number" value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Payment Mode</label>
                <select value={paymentForm.mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <input value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setPaymentModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={recordPayment} disabled={saving || !paymentForm.amount}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Recording..." : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
