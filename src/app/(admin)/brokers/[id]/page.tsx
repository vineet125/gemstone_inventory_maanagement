"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

interface BrokerConsignment {
  id: string;
  consignmentNo: string;
  date: string;
  status: string;
  lines: Array<{ qty: number; pricePerUnit: number; qtySold: number; item: { sku: string } }>;
  invoices: Array<{ id: string; amountTotal: number; amountPaid: number; status: string; dueDate: string }>;
}

interface Broker {
  id: string;
  name: string;
  phoneWhatsapp: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  defaultPaymentDays: number;
  notifyWhatsapp: boolean;
  notes: string | null;
  active: boolean;
  consignments: BrokerConsignment[];
}

const CONSIGNMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-muted-foreground",
  ACTIVE: "bg-blue-100 text-blue-700",
  PARTIALLY_RETURNED: "bg-yellow-100 text-yellow-700",
  FULLY_SOLD: "bg-green-100 text-green-700",
  CLOSED: "bg-purple-100 text-purple-700",
};

export default function BrokerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [broker, setBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phoneWhatsapp: "", contactPhone: "", address: "", city: "", defaultPaymentDays: "90", notes: "", notifyWhatsapp: true });

  async function load() {
    const res = await fetch(`/api/brokers/${id}`);
    if (res.ok) {
      const data: Broker = await res.json();
      setBroker(data);
      setForm({
        name: data.name,
        phoneWhatsapp: data.phoneWhatsapp ?? "",
        contactPhone: data.contactPhone ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        defaultPaymentDays: String(data.defaultPaymentDays),
        notes: data.notes ?? "",
        notifyWhatsapp: data.notifyWhatsapp ?? true,
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    const res = await fetch(`/api/brokers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, defaultPaymentDays: Number(form.defaultPaymentDays), notifyWhatsapp: form.notifyWhatsapp }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Broker updated"); setShowEdit(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>;
  if (!broker) return <div className="p-8 text-center text-sm text-red-400">Broker not found.</div>;

  // Compute outstanding balance
  const totalOutstanding = broker.consignments.reduce((sum, c) => {
    const inv = c.invoices[0];
    return sum + (inv ? inv.amountTotal - inv.amountPaid : 0);
  }, 0);
  const totalConsignments = broker.consignments.length;
  const activeConsignments = broker.consignments.filter((c) => c.status === "ACTIVE" || c.status === "PARTIALLY_RETURNED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/brokers" className="text-sm text-muted-foreground/60 hover:text-muted-foreground">← All Brokers</Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{broker.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{broker.city || "—"} · {broker.defaultPaymentDays}-day payment terms</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${broker.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
            {broker.active ? "Active" : "Inactive"}
          </span>
          <button onClick={() => setShowEdit(true)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent">
            Edit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Consignments</p>
          <p className="text-2xl font-bold text-foreground">{totalConsignments}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Active / Pending</p>
          <p className="text-2xl font-bold text-blue-600">{activeConsignments}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Outstanding Balance</p>
          <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Broker Info */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-3">Contact Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">WhatsApp</p>
            <p className="font-medium text-foreground">{broker.phoneWhatsapp || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">WA Notifications</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${broker.notifyWhatsapp ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
              {broker.notifyWhatsapp ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
            <p className="font-medium text-foreground">{broker.contactPhone || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">City</p>
            <p className="font-medium text-foreground">{broker.city || "—"}</p>
          </div>
          {broker.address && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground mb-0.5">Address</p>
              <p className="font-medium text-foreground">{broker.address}</p>
            </div>
          )}
          {broker.notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
              <p className="text-muted-foreground">{broker.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Consignment History */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Consignment History</h2>
          <Link href={`/sales/consignments?brokerId=${broker.id}`} className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {broker.consignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground/60">No consignments yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Consignment</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Invoice</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Paid</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Outstanding</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {broker.consignments.map((c) => {
                const inv = c.invoices[0];
                const outstanding = inv ? inv.amountTotal - inv.amountPaid : 0;
                return (
                  <tr key={c.id} className="hover:bg-accent">
                    <td className="px-4 py-3">
                      <Link href={`/sales/consignments/${c.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                        {c.consignmentNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(c.date), "dd MMM yyyy")}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONSIGNMENT_STATUS_COLORS[c.status] ?? "bg-gray-100 text-muted-foreground"}`}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {inv ? `₹${inv.amountTotal.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {inv ? `₹${inv.amountPaid.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {outstanding > 0 ? <span className="text-red-600">₹{outstanding.toLocaleString("en-IN")}</span> : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {inv ? format(new Date(inv.dueDate), "dd MMM yyyy") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Broker</h2>
            <div className={`grid grid-cols-2 gap-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">WhatsApp</label>
                <input value={form.phoneWhatsapp} onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="+91..." />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, notifyWhatsapp: !form.notifyWhatsapp })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.notifyWhatsapp ? "bg-green-500" : "bg-gray-300"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform ${form.notifyWhatsapp ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <label className="text-sm text-foreground">Notify via WhatsApp</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Payment Terms</label>
                <select value={form.defaultPaymentDays} onChange={(e) => setForm({ ...form, defaultPaymentDays: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowEdit(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
