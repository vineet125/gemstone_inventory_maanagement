"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Size { id: string; label: string; lengthMm: number; widthMm: number; active: boolean; }

export default function SizesPage() {
  const [items, setItems] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Size | null>(null);
  const [form, setForm] = useState({ label: "", lengthMm: "", widthMm: "" });
  const [saving, setSaving] = useState(false);
  const isAdmin = useIsAdmin();

  async function load() {
    const res = await fetch("/api/settings/sizes");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm({ label: "", lengthMm: "", widthMm: "" }); setShowForm(true); }
  function openEdit(item: Size) {
    setEditing(item);
    setForm({ label: item.label, lengthMm: String(item.lengthMm), widthMm: String(item.widthMm) });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.label.trim() || !form.lengthMm || !form.widthMm) return;
    setSaving(true);
    const url = editing ? `/api/settings/sizes/${editing.id}` : "/api/settings/sizes";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: form.label, lengthMm: Number(form.lengthMm), widthMm: Number(form.widthMm) }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  async function toggleActive(item: Size) {
    await fetch(`/api/settings/sizes/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function handleDelete(item: Size) {
    if (!confirm(`Delete "${item.label}"?`)) return;
    const res = await fetch(`/api/settings/sizes/${item.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Cannot delete — may be in use");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sizes</h1>
          <p className="text-sm text-muted-foreground mt-1">Stone dimensions (length × width in mm)</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + Add Size
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Size" : "Add Size"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Label *</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. 6x4" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Length (mm) *</label>
                  <input type="number" value={form.lengthMm} onChange={(e) => setForm({ ...form, lengthMm: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="6" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Width (mm) *</label>
                  <input type="number" value={form.widthMm} onChange={(e) => setForm({ ...form, widthMm: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="4" />
                </div>
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
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Label</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Length (mm)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Width (mm)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
                {isAdmin && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-medium">{item.label}</td>
                  <td className="px-4 py-3 text-center">{item.lengthMm}</td>
                  <td className="px-4 py-3 text-center">{item.widthMm}</td>
                  <td className="px-4 py-3 text-center">
                    {isAdmin ? (
                      <button onClick={() => toggleActive(item)} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${item.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                        {item.active ? "Active" : "Inactive"}
                      </button>
                    ) : (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${item.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(item)} className="mr-2 text-primary hover:underline text-xs">Edit</button>
                      <button onClick={() => handleDelete(item)} className="text-red-500 hover:underline text-xs">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
