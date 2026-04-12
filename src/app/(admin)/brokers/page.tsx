"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";

interface Broker {
  id: string;
  name: string;
  phoneWhatsapp: string | null;
  city: string | null;
  defaultPaymentDays: number;
  active: boolean;
  _count: { consignments: number };
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Broker | null>(null);
  const [form, setForm] = useState({ name: "", phoneWhatsapp: "", city: "", defaultPaymentDays: "90", notes: "" });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    const res = await fetch("/api/brokers");
    if (res.ok) setBrokers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm({ name: "", phoneWhatsapp: "", city: "", defaultPaymentDays: "90", notes: "" }); setShowForm(true); }
  function openEdit(b: Broker) {
    setEditing(b);
    setForm({ name: b.name, phoneWhatsapp: b.phoneWhatsapp ?? "", city: b.city ?? "", defaultPaymentDays: String(b.defaultPaymentDays), notes: "" });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = editing ? `/api/brokers/${editing.id}` : "/api/brokers";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, defaultPaymentDays: Number(form.defaultPaymentDays) }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  const filtered = brokers.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.city ?? "").toLowerCase().includes(search.toLowerCase()));
  const PAGE_SIZE = 10;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brokers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage broker relationships and consignment history</p>
        </div>
        <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          + Add Broker
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Broker" : "Add Broker"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">WhatsApp / Phone</label>
                <input value={form.phoneWhatsapp} onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Default Payment Days</label>
                <select value={form.defaultPaymentDays} onChange={(e) => setForm({ ...form, defaultPaymentDays: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="px-4 py-3 border-b bg-muted/40">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search broker by name or city…"
            className="w-full max-w-sm rounded-lg border bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {loading ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">City</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Payment Days</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Consignments</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5"><div className="h-3.5 bg-muted rounded w-32" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-28" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-20" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-10 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="flex gap-2 justify-end"><div className="h-7 bg-muted rounded-lg w-14" /><div className="h-7 bg-muted rounded-lg w-18" /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">City</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Payment Days</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Consignments</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {brokers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground/60">No brokers yet</td></tr>
              ) : paginated.map((b) => (
                <tr key={b.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-medium text-foreground">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.phoneWhatsapp ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.city ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{b.defaultPaymentDays} days</td>
                  <td className="px-4 py-3 text-center">{b._count.consignments}</td>
                  <td className="px-4 py-3 text-right flex justify-end gap-3">
                    <button onClick={() => openEdit(b)} className="text-primary hover:underline text-xs">Edit</button>
                    <Link href={`/brokers/${b.id}`} className="text-primary hover:underline text-xs">History →</Link>
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
