"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExportButton } from "@/components/ExportButton";
import { Pagination } from "@/components/Pagination";

interface MasterItem { id: string; name: string; }
interface GradeItem { id: string; label: string; }
interface SizeItem { id: string; label: string; }
interface ColorItem { id: string; name: string; hexCode: string | null; stoneType?: { name: string }; }
interface InventoryItem {
  id: string;
  sku: string;
  qtyPieces: number;
  lowStockThreshold: number;
  costPricePerPiece: number | null;
  sellingPriceEstimated: number | null;
  weightPerPieceGrams: number | null;
  weightPerPieceCarats: number | null;
  locationCabinet: string | null;
  locationTray: string | null;
  locationCompartment: string | null;
  currency: string;
  catalogVisible: boolean;
  stoneType: { name: string };
  shape: { name: string };
  size: { label: string };
  color: { name: string; hexCode: string | null };
  grade: { label: string };
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stoneTypes, setStoneTypes] = useState<MasterItem[]>([]);
  const [shapes, setShapes] = useState<MasterItem[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ typeId: "", colorId: "", shapeId: "", gradeId: "", lowStock: false });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    stoneTypeId: "", shapeId: "", sizeId: "", colorId: "", gradeId: "",
    qtyPieces: "0", weight: "", weightUnit: "ct" as "ct" | "g",
    costPricePerPiece: "", sellingPriceEstimated: "", currency: "INR",
    locationCabinet: "", locationTray: "", locationCompartment: "",
    lowStockThreshold: "10", catalogVisible: false,
  });

  // Edit state
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    qtyPieces: "0",
    sellingPriceEstimated: "", costPricePerPiece: "",
    weight: "", weightUnit: "ct" as "ct" | "g",
    locationCabinet: "", locationTray: "", locationCompartment: "",
    lowStockThreshold: "10", catalogVisible: false,
  });
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  async function loadMaster() {
    const [tRes, shRes, siRes, cRes, gRes] = await Promise.all([
      fetch("/api/settings/stone-types"), fetch("/api/settings/shapes"),
      fetch("/api/settings/sizes"), fetch("/api/settings/colors"), fetch("/api/settings/grades"),
    ]);
    const [types, sh, si, cl, gr] = await Promise.all([tRes.json(), shRes.json(), siRes.json(), cRes.json(), gRes.json()]);
    setStoneTypes(types); setShapes(sh); setSizes(si); setColors(cl); setGrades(gr);
    if (types.length > 0) setForm((f) => ({ ...f, stoneTypeId: types[0].id }));
    if (sh.length > 0) setForm((f) => ({ ...f, shapeId: sh[0].id }));
    if (si.length > 0) setForm((f) => ({ ...f, sizeId: si[0].id }));
    if (cl.length > 0) setForm((f) => ({ ...f, colorId: cl[0].id }));
    if (gr.length > 0) setForm((f) => ({ ...f, gradeId: gr[0].id }));
  }

  async function loadItems() {
    const params = new URLSearchParams();
    if (filters.typeId) params.set("typeId", filters.typeId);
    if (filters.colorId) params.set("colorId", filters.colorId);
    if (filters.shapeId) params.set("shapeId", filters.shapeId);
    if (filters.gradeId) params.set("gradeId", filters.gradeId);
    if (filters.lowStock) params.set("lowStock", "true");
    const res = await fetch(`/api/inventory?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadMaster(); }, []);
  useEffect(() => { loadItems(); }, [filters]);
  useEffect(() => { setPage(1); }, [filters]);

  async function handleSave() {
    if (!form.stoneTypeId || !form.shapeId || !form.sizeId || !form.colorId || !form.gradeId) {
      toast.error("Please select stone type, shape, size, color and grade");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stoneTypeId: form.stoneTypeId,
        shapeId: form.shapeId,
        sizeId: form.sizeId,
        colorId: form.colorId,
        gradeId: form.gradeId,
        qtyPieces: Number(form.qtyPieces) || 0,
        weightPerPieceCarats: form.weight
          ? form.weightUnit === "ct" ? Number(form.weight) : Number(form.weight) / 0.2
          : undefined,
        weightPerPieceGrams: form.weight
          ? form.weightUnit === "g" ? Number(form.weight) : Number(form.weight) * 0.2
          : undefined,
        costPricePerPiece: form.costPricePerPiece ? Number(form.costPricePerPiece) : undefined,
        sellingPriceEstimated: form.sellingPriceEstimated ? Number(form.sellingPriceEstimated) : undefined,
        currency: form.currency,
        locationCabinet: form.locationCabinet || undefined,
        locationTray: form.locationTray || undefined,
        locationCompartment: form.locationCompartment || undefined,
        lowStockThreshold: Number(form.lowStockThreshold) || 10,
        catalogVisible: form.catalogVisible,
      }),
    });
    if (res.ok) {
      const newItem = await res.json();
      for (let i = 0; i < pendingImages.length; i++) {
        const fd = new FormData();
        fd.append("file", pendingImages[i]);
        fd.append("isPrimary", i === 0 ? "true" : "false");
        await fetch(`/api/inventory/images?itemId=${newItem.id}`, { method: "POST", body: fd });
      }
      pendingPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPendingImages([]);
      setPendingPreviews([]);
      toast.success("SKU created");
      setShowForm(false);
      loadItems();
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Failed to create SKU");
    }
    setSaving(false);
  }

  const colorsByType = colors.filter((c) => !form.stoneTypeId || (c as ColorItem & { stoneTypeId?: string }).stoneTypeId === form.stoneTypeId);

  function addPendingImage(file: File) {
    setPendingImages((prev) => [...prev, file]);
    setPendingPreviews((prev) => [...prev, URL.createObjectURL(file)]);
  }
  function removePendingImage(idx: number) {
    setPendingPreviews((prev) => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadEditImage(file: File) {
    if (!editing) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("isPrimary", editing.images.length === 0 ? "true" : "false");
    const res = await fetch(`/api/inventory/images?itemId=${editing.id}`, { method: "POST", body: fd });
    if (res.ok) {
      const img = await res.json();
      setEditing((prev) => prev ? { ...prev, images: [...prev.images, img] } : prev);
      loadItems();
    }
  }
  async function deleteImage(imageId: string) {
    await fetch(`/api/inventory/images?imageId=${imageId}`, { method: "DELETE" });
    setEditing((prev) => prev ? { ...prev, images: prev.images.filter((i) => i.id !== imageId) } : prev);
    loadItems();
  }
  async function setPrimaryImage(imageId: string) {
    await fetch(`/api/inventory/images?imageId=${imageId}`, { method: "PATCH" });
    setEditing((prev) => prev ? { ...prev, images: prev.images.map((i) => ({ ...i, isPrimary: i.id === imageId })) } : prev);
    loadItems();
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    const hasCt = item.weightPerPieceCarats != null;
    const hasG = item.weightPerPieceGrams != null;
    const weightVal = hasCt
      ? String(item.weightPerPieceCarats)
      : hasG ? String(+(item.weightPerPieceGrams! / 0.2).toFixed(4)) : "";
    setEditForm({
      qtyPieces: String(item.qtyPieces),
      sellingPriceEstimated: item.sellingPriceEstimated != null ? String(item.sellingPriceEstimated) : "",
      costPricePerPiece: item.costPricePerPiece != null ? String(item.costPricePerPiece) : "",
      weight: weightVal,
      weightUnit: "ct",
      locationCabinet: item.locationCabinet ?? "",
      locationTray: item.locationTray ?? "",
      locationCompartment: item.locationCompartment ?? "",
      lowStockThreshold: String(item.lowStockThreshold),
      catalogVisible: item.catalogVisible,
    });
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/inventory/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qtyPieces: Number(editForm.qtyPieces),
        sellingPriceEstimated: editForm.sellingPriceEstimated ? Number(editForm.sellingPriceEstimated) : undefined,
        costPricePerPiece: editForm.costPricePerPiece ? Number(editForm.costPricePerPiece) : undefined,
        weightPerPieceCarats: editForm.weight
          ? editForm.weightUnit === "ct" ? Number(editForm.weight) : Number(editForm.weight) / 0.2
          : undefined,
        weightPerPieceGrams: editForm.weight
          ? editForm.weightUnit === "g" ? Number(editForm.weight) : Number(editForm.weight) * 0.2
          : undefined,
        locationCabinet: editForm.locationCabinet || undefined,
        locationTray: editForm.locationTray || undefined,
        locationCompartment: editForm.locationCompartment || undefined,
        lowStockThreshold: Number(editForm.lowStockThreshold) || 10,
        catalogVisible: editForm.catalogVisible,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Item updated"); setEditing(null); loadItems(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed to update"); }
  }

  const PAGE_SIZE = 10;
  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const outOfStock = items.filter((i) => i.qtyPieces === 0 && i.weightPerPieceCarats == null && i.weightPerPieceGrams == null).length;
  const lowStockCount = items.filter((i) => i.qtyPieces > 0 && i.qtyPieces <= i.lowStockThreshold).length;

  const gradeColor = (label: string) => {
    if (label === "AAA") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    if (label === "AA") return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";
    if (label === "A") return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    return "bg-purple-100 text-purple-700 ring-1 ring-purple-200";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-muted-foreground">{items.length} SKUs total</span>
            {outOfStock > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {outOfStock} out of stock
              </span>
            )}
            {lowStockCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {lowStockCount} low stock
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={items.map((item) => ({
              SKU: item.sku,
              "Stone Type": item.stoneType.name,
              Shape: item.shape.name,
              Size: item.size.label,
              Color: item.color.name,
              Grade: item.grade.label,
              "Qty (pieces)": item.qtyPieces,
              "Weight/pc (ct)": item.weightPerPieceCarats ?? "",
              "Weight/pc (g)": item.weightPerPieceGrams ?? "",
              "Cost Price (₹)": item.costPricePerPiece ?? "",
              "Selling Price (₹)": item.sellingPriceEstimated ?? "",
              Currency: item.currency,
              Location: [item.locationCabinet, item.locationTray, item.locationCompartment].filter(Boolean).join(" / "),
              "Low Stock Threshold": item.lowStockThreshold,
              "Catalog Visible": item.catalogVisible ? "Yes" : "No",
            }))}
            filename="inventory_export"
            label="Export"
          />
          <button onClick={() => setShowForm(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm">
            + Add Item (SKU)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center bg-muted/40 border border-border rounded-xl px-4 py-3">
        <select value={filters.typeId} onChange={(e) => setFilters({ ...filters, typeId: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm shadow-sm">
          <option value="">All Stone Types</option>
          {stoneTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filters.shapeId} onChange={(e) => setFilters({ ...filters, shapeId: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm shadow-sm">
          <option value="">All Shapes</option>
          {shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.gradeId} onChange={(e) => setFilters({ ...filters, gradeId: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm shadow-sm">
          <option value="">All Grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <label className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${filters.lowStock ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-background border-border text-muted-foreground hover:bg-accent"}`}>
          <input type="checkbox" className="hidden" checked={filters.lowStock} onChange={(e) => setFilters({ ...filters, lowStock: e.target.checked })} />
          ⚠ Low Stock Only
        </label>
        {(filters.typeId || filters.shapeId || filters.gradeId || filters.lowStock) && (
          <button onClick={() => setFilters({ typeId: "", colorId: "", shapeId: "", gradeId: "", lowStock: false })}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Add Item Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add New SKU</h2>
            <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Stone Type *</label>
                <select value={form.stoneTypeId} onChange={(e) => setForm({ ...form, stoneTypeId: e.target.value, colorId: "" })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {stoneTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Shape *</label>
                <select value={form.shapeId} onChange={(e) => setForm({ ...form, shapeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Size *</label>
                <select value={form.sizeId} onChange={(e) => setForm({ ...form, sizeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Color *</label>
                <select value={form.colorId} onChange={(e) => setForm({ ...form, colorId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">Select color</option>
                  {colorsByType.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Grade *</label>
                <select value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pcs</label>
                <input type="number" value={form.qtyPieces} onChange={(e) => setForm({ ...form, qtyPieces: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-foreground">Weight</label>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {(["ct", "g"] as const).map((u) => (
                      <button key={u} type="button" onClick={() => setForm({ ...form, weightUnit: u })}
                        className={`px-2.5 py-0.5 text-xs font-semibold transition-colors ${form.weightUnit === u ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-accent"}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="number" step="0.001" min={0} value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="0.00" />
                {form.weight && (
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    {form.weightUnit === "ct" ? `= ${(Number(form.weight) * 0.2).toFixed(3)} g` : `= ${(Number(form.weight) / 0.2).toFixed(3)} ct`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cost Price (₹)</label>
                <input type="number" step="0.01" value={form.costPricePerPiece} onChange={(e) => setForm({ ...form, costPricePerPiece: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Selling Price (₹)</label>
                <input type="number" step="0.01" value={form.sellingPriceEstimated} onChange={(e) => setForm({ ...form, sellingPriceEstimated: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Low Stock Alert</label>
                <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cabinet</label>
                <input value={form.locationCabinet} onChange={(e) => setForm({ ...form, locationCabinet: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tray</label>
                <input value={form.locationTray} onChange={(e) => setForm({ ...form, locationTray: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Compartment</label>
                <input value={form.locationCompartment} onChange={(e) => setForm({ ...form, locationCompartment: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="C2" />
              </div>
              <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
                <input type="checkbox" id="catalogVis" checked={form.catalogVisible} onChange={(e) => setForm({ ...form, catalogVisible: e.target.checked })} />
                <label htmlFor="catalogVis" className="text-sm text-foreground">Show in public catalog</label>
              </div>
              {/* Photos */}
              <div className="col-span-2 sm:col-span-3">
                <label className="block text-sm font-medium text-foreground mb-1.5">Photos (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {pendingPreviews.map((src, i) => (
                    <div key={i} className="relative group w-16 h-16">
                      <img src={src} alt="" className="w-full h-full object-cover rounded-lg border border-border" />
                      {i === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-primary/80 text-primary-foreground rounded-b-lg px-0.5">Primary</span>}
                      <button type="button" onClick={() => removePendingImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-white rounded-full text-[10px] leading-none hidden group-hover:flex items-center justify-center">
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50 cursor-pointer transition-colors">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-[10px] mt-0.5">Add</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) addPendingImage(f); e.target.value = "";
                    }} />
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); pendingPreviews.forEach((u) => URL.revokeObjectURL(u)); setPendingImages([]); setPendingPreviews([]); }} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Creating..." : "Create SKU"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-1">Edit SKU</h2>
            <p className="text-xs text-muted-foreground mb-4 font-mono">{editing.sku} — {editing.stoneType.name} · {editing.color.name} · {editing.grade.label}</p>
            <div className={saving ? "pointer-events-none opacity-50 select-none" : ""}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pcs</label>
                <input type="number" min={0} value={editForm.qtyPieces}
                  onChange={(e) => setEditForm({ ...editForm, qtyPieces: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-foreground">Weight</label>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {(["ct", "g"] as const).map((u) => (
                      <button key={u} type="button" onClick={() => setEditForm({ ...editForm, weightUnit: u })}
                        className={`px-2.5 py-0.5 text-xs font-semibold transition-colors ${editForm.weightUnit === u ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-accent"}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="number" step="0.001" min={0} value={editForm.weight}
                  onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="0.00" />
                {editForm.weight && (
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    {editForm.weightUnit === "ct" ? `= ${(Number(editForm.weight) * 0.2).toFixed(3)} g` : `= ${(Number(editForm.weight) / 0.2).toFixed(3)} ct`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Selling Price (₹)</label>
                <input type="number" step="0.01" value={editForm.sellingPriceEstimated}
                  onChange={(e) => setEditForm({ ...editForm, sellingPriceEstimated: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. 250" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cost Price (₹)</label>
                <input type="number" step="0.01" value={editForm.costPricePerPiece}
                  onChange={(e) => setEditForm({ ...editForm, costPricePerPiece: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. 150" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Low Stock Alert (qty)</label>
                <input type="number" value={editForm.lowStockThreshold}
                  onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editForm.catalogVisible}
                    onChange={(e) => setEditForm({ ...editForm, catalogVisible: e.target.checked })} />
                  Show in public catalog
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cabinet</label>
                <input value={editForm.locationCabinet}
                  onChange={(e) => setEditForm({ ...editForm, locationCabinet: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tray</label>
                <input value={editForm.locationTray}
                  onChange={(e) => setEditForm({ ...editForm, locationTray: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Compartment</label>
                <input value={editForm.locationCompartment}
                  onChange={(e) => setEditForm({ ...editForm, locationCompartment: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="C2" />
              </div>
            </div>
            {/* Images */}
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground mb-1.5">Photos</label>
              <div className="flex flex-wrap gap-2">
                {editing.images.map((img) => (
                  <div key={img.id} className="relative group w-16 h-16">
                    <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg border border-border" />
                    {img.isPrimary && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-primary/80 text-primary-foreground rounded-b-lg px-0.5">Primary</span>}
                    <div className="absolute inset-0 rounded-lg bg-black/50 hidden group-hover:flex flex-col items-center justify-center gap-0.5">
                      {!img.isPrimary && (
                        <button type="button" onClick={() => setPrimaryImage(img.id)}
                          className="text-[9px] text-white bg-blue-600/80 rounded px-1.5 py-0.5">Set primary</button>
                      )}
                      <button type="button" onClick={() => deleteImage(img.id)}
                        className="text-[9px] text-white bg-red-600/80 rounded px-1.5 py-0.5">Delete</button>
                    </div>
                  </div>
                ))}
                <label className="w-16 h-16 flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50 cursor-pointer transition-colors">
                  <span className="text-xl leading-none">+</span>
                  <span className="text-[10px] mt-0.5">Add</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (f) await uploadEditImage(f); e.target.value = "";
                  }} />
                </label>
              </div>
            </div>
            </div>{/* end lock wrapper */}
            <p className="mt-3 text-xs text-muted-foreground/60">Note: SKU, stone type, shape, size, color and grade cannot be changed after creation.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleUpdate} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center gap-2">
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

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5">
                <div className="h-3 bg-muted rounded w-28" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-32" />
                  <div className="h-2.5 bg-muted rounded w-24" />
                </div>
                <div className="h-5 bg-muted rounded-full w-16" />
                <div className="h-5 bg-muted rounded-full w-14" />
                <div className="h-3 bg-muted rounded w-10" />
                <div className="h-3 bg-muted rounded w-16" />
                <div className="h-7 bg-muted rounded-lg w-14" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground/60">No items found. Add your first SKU above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b-2 border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Stone / Shape / Size</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Color</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Grade</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Qty</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Weight</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Selling ₹</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Catalog</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginated.map((item) => {
                const isWeightTracked = item.weightPerPieceCarats != null || item.weightPerPieceGrams != null;
                const isLow = !isWeightTracked && item.qtyPieces > 0 && item.qtyPieces <= item.lowStockThreshold;
                const isOut = !isWeightTracked && item.qtyPieces === 0;
                return (
                  <tr key={item.id} className="hover:bg-accent/60 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {item.images[0] ? (
                          <img src={item.images[0].url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-border shadow-sm" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0 border border-border text-base">
                            💎
                          </div>
                        )}
                        <span className="font-mono text-[11px] font-semibold text-foreground bg-muted/60 rounded px-1.5 py-0.5 leading-tight">{item.sku}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground text-sm">{item.stoneType.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.shape.name} · {item.size.label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.color.hexCode && (
                          <span className="w-3.5 h-3.5 rounded-full border border-white shadow-sm flex-shrink-0" style={{ backgroundColor: item.color.hexCode }} />
                        )}
                        <span className="text-sm text-foreground">{item.color.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${gradeColor(item.grade.label)}`}>
                        {item.grade.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 ring-1 ring-red-200 px-2.5 py-0.5 text-xs font-bold">OUT</span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200 px-2.5 py-0.5 text-xs font-bold">
                          ⚠ {item.qtyPieces}
                        </span>
                      ) : item.qtyPieces === 0 ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        <span className="font-semibold text-foreground">{item.qtyPieces}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.weightPerPieceCarats != null
                        ? <span className="text-sm text-foreground">{item.weightPerPieceCarats} <span className="text-xs text-muted-foreground">ct</span></span>
                        : item.weightPerPieceGrams != null
                        ? <span className="text-sm text-foreground">{item.weightPerPieceGrams} <span className="text-xs text-muted-foreground">g</span></span>
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.sellingPriceEstimated
                        ? <span className="font-medium text-foreground">₹{item.sellingPriceEstimated.toLocaleString("en-IN")}</span>
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.catalogVisible
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 ring-1 ring-emerald-200">✓ Live</span>
                        : <span className="text-xs text-muted-foreground/50">Hidden</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(item)}
                        className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors opacity-0 group-hover:opacity-100">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onChange={setPage} />
      </div>
    </div>
  );
}
