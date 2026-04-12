"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Shape { id: string; name: string; active: boolean; }

export default function ShapesPage() {
  const [items, setItems] = useState<Shape[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Shape | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const isAdmin = useIsAdmin();

  async function load() {
    const res = await fetch("/api/settings/shapes");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setName(""); setShowForm(true); }
  function openEdit(item: Shape) { setEditing(item); setName(item.name); setShowForm(true); }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const url = editing ? `/api/settings/shapes/${editing.id}` : "/api/settings/shapes";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  async function toggleActive(item: Shape) {
    await fetch(`/api/settings/shapes/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function handleDelete(item: Shape) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const res = await fetch(`/api/settings/shapes/${item.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Cannot delete — may be in use");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shapes</h1>
          <p className="text-sm text-muted-foreground mt-1">Oval, Round, Octagon, Pear, etc.</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + Add Shape
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Shape" : "Add Shape"}</h2>
            <div className={saving ? "pointer-events-none opacity-50 select-none" : ""}>
              <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="e.g. Oval"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
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
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
                {isAdmin && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
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
