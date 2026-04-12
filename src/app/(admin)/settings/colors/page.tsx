"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface StoneType { id: string; name: string; }
interface Color { id: string; name: string; hexCode: string | null; active: boolean; stoneType: { name: string }; stoneTypeId: string; }

export default function ColorsPage() {
  const [items, setItems] = useState<Color[]>([]);
  const [stoneTypes, setStoneTypes] = useState<StoneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Color | null>(null);
  const [form, setForm] = useState({ name: "", hexCode: "", stoneTypeId: "" });
  const [saving, setSaving] = useState(false);
  const isAdmin = useIsAdmin();

  async function load() {
    const url = filterType ? `/api/settings/colors?stoneTypeId=${filterType}` : "/api/settings/colors";
    const [colRes, typeRes] = await Promise.all([fetch(url), fetch("/api/settings/stone-types")]);
    setItems(await colRes.json());
    setStoneTypes(await typeRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterType]);

  function openAdd() { setEditing(null); setForm({ name: "", hexCode: "", stoneTypeId: stoneTypes[0]?.id ?? "" }); setShowForm(true); }
  function openEdit(item: Color) {
    setEditing(item);
    setForm({ name: item.name, hexCode: item.hexCode ?? "", stoneTypeId: item.stoneTypeId });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.stoneTypeId) return;
    setSaving(true);
    const url = editing ? `/api/settings/colors/${editing.id}` : "/api/settings/colors";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, hexCode: form.hexCode || undefined, stoneTypeId: form.stoneTypeId }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  async function toggleActive(item: Color) {
    await fetch(`/api/settings/colors/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function handleDelete(item: Color) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const res = await fetch(`/api/settings/colors/${item.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Cannot delete — may be in use");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Colors</h1>
          <p className="text-sm text-muted-foreground mt-1">Colors are defined per stone type</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + Add Color
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterType("")}
          className={`rounded-full px-3 py-1 text-sm border ${!filterType ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
          All
        </button>
        {stoneTypes.map((st) => (
          <button key={st.id} onClick={() => setFilterType(st.id)}
            className={`rounded-full px-3 py-1 text-sm border ${filterType === st.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
            {st.name}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Color" : "Add Color"}</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Stone Type *</label>
                <select value={form.stoneTypeId} onChange={(e) => setForm({ ...form, stoneTypeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {stoneTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Color Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. Deep Yellow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Hex Code (optional)</label>
                <div className="flex gap-2">
                  <input type="color" value={form.hexCode || "#cccccc"} onChange={(e) => setForm({ ...form, hexCode: e.target.value })}
                    className="h-9 w-14 rounded border cursor-pointer" />
                  <input value={form.hexCode} onChange={(e) => setForm({ ...form, hexCode: e.target.value })}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" placeholder="#F4C842" />
                </div>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Color</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stone Type</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
                {isAdmin && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-accent">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.hexCode && (
                        <span className="inline-block w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: item.hexCode }} />
                      )}
                      <span className="font-medium text-foreground">{item.name}</span>
                      {item.hexCode && <span className="text-xs text-muted-foreground/60">{item.hexCode}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.stoneType.name}</td>
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
