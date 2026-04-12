"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  contactPhone: string | null;
  phoneWhatsapp: string | null;
  city: string | null;
  specialization: string | null;
  active: boolean;
  notifyWhatsapp: boolean;
  _count: { records: number };
}

export default function PolishingPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: "", contactPhone: "", phoneWhatsapp: "", city: "", specialization: "", notifyWhatsapp: true });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/manufacturing/polishing-vendors");
    if (res.ok) setVendors(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm({ name: "", contactPhone: "", phoneWhatsapp: "", city: "", specialization: "", notifyWhatsapp: true }); setShowForm(true); }
  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({ name: v.name, contactPhone: v.contactPhone ?? "", phoneWhatsapp: v.phoneWhatsapp ?? "", city: v.city ?? "", specialization: v.specialization ?? "", notifyWhatsapp: v.notifyWhatsapp ?? true });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = editing ? `/api/manufacturing/polishing-vendors/${editing.id}` : "/api/manufacturing/polishing-vendors";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  async function toggleActive(v: Vendor) {
    await fetch(`/api/manufacturing/polishing-vendors/${v.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !v.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polishing Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">External vendors for polishing & finishing stage</p>
        </div>
        <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          + Add Vendor
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Vendor" : "Add Vendor"}</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Vendor Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone / WhatsApp</label>
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">WhatsApp Number</label>
                <input value={form.phoneWhatsapp} onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="+91... (if different)" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, notifyWhatsapp: !form.notifyWhatsapp })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.notifyWhatsapp ? "bg-green-500" : "bg-gray-300"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform ${form.notifyWhatsapp ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <label className="text-sm text-foreground">Notify via WhatsApp</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Jaipur" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Specialization</label>
                <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Citrine, Amethyst" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">City</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Specialization</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Jobs</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground/60">No vendors yet</td></tr>
              ) : vendors.map((v) => (
                <tr key={v.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-medium text-foreground">{v.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.contactPhone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.city ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.specialization ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{v._count.records}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(v)}
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${v.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                      {v.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(v)} className="text-primary hover:underline text-xs">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
