"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Grade { id: string; label: string; sortOrder: number; active: boolean; }

export default function GradesPage() {
  const [items, setItems] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState({ label: "", sortOrder: "" });
  const [saving, setSaving] = useState(false);
  const isAdmin = useIsAdmin();

  async function load() {
    const res = await fetch("/api/settings/grades");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm({ label: "", sortOrder: String(items.length + 1) }); setShowForm(true); }
  function openEdit(item: Grade) { setEditing(item); setForm({ label: item.label, sortOrder: String(item.sortOrder) }); setShowForm(true); }

  async function handleSave() {
    if (!form.label.trim()) return;
    setSaving(true);
    const url = editing ? `/api/settings/grades/${editing.id}` : "/api/settings/grades";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: form.label, sortOrder: Number(form.sortOrder) || 0 }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  async function handleDelete(item: Grade) {
    if (!confirm(`Delete grade "${item.label}"?`)) return;
    const res = await fetch(`/api/settings/grades/${item.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Cannot delete — may be in use");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grades</h1>
          <p className="text-sm text-muted-foreground mt-1">Quality grades (AAA, AA, A — fully customizable)</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + Add Grade
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Grade" : "Add Grade"}</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Label *</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. AAA" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="1" />
                <p className="text-xs text-muted-foreground/60 mt-1">Lower number = higher quality (shown first)</p>
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
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Label</th>
                {isAdmin && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-accent">
                  <td className="px-4 py-3 text-center text-muted-foreground">{item.sortOrder}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-0.5 text-sm">
                      {item.label}
                    </span>
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
