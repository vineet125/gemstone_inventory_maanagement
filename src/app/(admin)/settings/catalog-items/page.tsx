"use client";

import { useEffect, useRef, useState } from "react";

interface ItemImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface InventoryItem {
  id: string;
  sku: string;
  catalogVisible: boolean;
  qtyPieces: number;
  costPricePerPiece: number | null;
  sellingPriceEstimated: number | null;
  currency: string;
  locationCabinet: string | null;
  locationTray: string | null;
  locationCompartment: string | null;
  lowStockThreshold: number;
  weightPerPieceGrams: number | null;
  weightPerPieceCarats: number | null;
  stoneType: { name: string };
  shape: { name: string };
  size: { label: string };
  color: { name: string };
  grade: { label: string };
  images: ItemImage[];
}

interface StoneType {
  id: string;
  name: string;
}

type Filter = "all" | "on" | "off";

interface EditForm {
  qtyPieces: string;
  costPricePerPiece: string;
  sellingPriceEstimated: string;
  locationCabinet: string;
  locationTray: string;
  locationCompartment: string;
  lowStockThreshold: string;
}

export default function CatalogItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stoneTypes, setStoneTypes] = useState<StoneType[]>([]);
  const [stoneImages, setStoneImages] = useState<Record<string, string>>({});
  const [uploadingStone, setUploadingStone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stoneFilter, setStoneFilter] = useState<string>("all");
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setLoadError(false);
    try {
      const [invRes, typesRes, settingsRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/settings/stone-types"),
        fetch("/api/settings/catalog-site"),
      ]);
      if (!invRes.ok || !typesRes.ok || !settingsRes.ok) throw new Error("fetch failed");
      const [invData, typesData, settingsData] = await Promise.all([
        invRes.json(), typesRes.json(), settingsRes.json(),
      ]);
      setItems(Array.isArray(invData) ? invData : []);
      setStoneTypes(Array.isArray(typesData) ? typesData : []);
      try { setStoneImages(JSON.parse(settingsData.stone_type_images ?? "{}")); } catch { /* empty */ }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function uploadStoneImage(stoneName: string, file: File) {
    setUploadingStone((p) => ({ ...p, [stoneName]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/settings/stone-type-images?stoneName=${encodeURIComponent(stoneName)}`, {
        method: "POST", body: fd,
      });
      if (r.ok) {
        const { url } = await r.json();
        setStoneImages((p) => ({ ...p, [stoneName]: url }));
      } else {
        const { error } = await r.json().catch(() => ({ error: "Upload failed" }));
        alert(error ?? "Upload failed");
      }
    } catch {
      alert("Upload failed — check your connection.");
    } finally {
      setUploadingStone((p) => ({ ...p, [stoneName]: false }));
    }
  }

  const visible = items.filter((it) => {
    if (filter === "on" && !it.catalogVisible) return false;
    if (filter === "off" && it.catalogVisible) return false;
    if (stoneFilter !== "all" && it.stoneType.name !== stoneFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        it.sku.toLowerCase().includes(q) ||
        it.stoneType.name.toLowerCase().includes(q) ||
        it.color.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Clear expanded card when filters change so stale photo panels don't persist
  useEffect(() => { setExpanded(null); }, [filter, stoneFilter, search]);

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setEditForm({
      qtyPieces: String(item.qtyPieces ?? 0),
      costPricePerPiece: item.costPricePerPiece != null ? String(item.costPricePerPiece) : "",
      sellingPriceEstimated: item.sellingPriceEstimated != null ? String(item.sellingPriceEstimated) : "",
      locationCabinet: item.locationCabinet ?? "",
      locationTray: item.locationTray ?? "",
      locationCompartment: item.locationCompartment ?? "",
      lowStockThreshold: String(item.lowStockThreshold ?? 10),
    });
  }

  function closeEdit() {
    setEditItem(null);
    setEditForm(null);
    setSaveError(null);
  }

  async function saveEdit() {
    if (!editItem || !editForm) return;
    setSaving(true);
    setSaveError(null);

    const qtyPieces = Math.max(0, parseInt(editForm.qtyPieces) || 0);
    const lowStockThreshold = Math.max(0, parseInt(editForm.lowStockThreshold) || 0);
    const costPricePerPiece = editForm.costPricePerPiece.trim() !== ""
      ? parseFloat(editForm.costPricePerPiece)
      : null;
    const sellingPriceEstimated = editForm.sellingPriceEstimated.trim() !== ""
      ? parseFloat(editForm.sellingPriceEstimated)
      : null;

    const body = {
      qtyPieces,
      lowStockThreshold,
      locationCabinet: editForm.locationCabinet.trim() || null,
      locationTray: editForm.locationTray.trim() || null,
      locationCompartment: editForm.locationCompartment.trim() || null,
      costPricePerPiece,
      sellingPriceEstimated,
    };

    const r = await fetch(`/api/inventory/${editItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: "Save failed" }));
      setSaveError(error ?? "Save failed");
      setSaving(false);
      return;
    }

    setItems((prev) =>
      prev.map((it) => it.id === editItem.id ? { ...it, ...body } : it)
    );
    setSaving(false);
    closeEdit();
  }

  async function toggleVisible(item: InventoryItem) {
    setToggling((p) => ({ ...p, [item.id]: true }));
    const r = await fetch(`/api/inventory/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogVisible: !item.catalogVisible }),
    });
    if (r.ok) {
      setItems((prev) =>
        prev.map((it) => it.id === item.id ? { ...it, catalogVisible: !it.catalogVisible } : it)
      );
    }
    setToggling((p) => ({ ...p, [item.id]: false }));
  }

  async function uploadFile(itemId: string, file: File) {
    setUploading((p) => ({ ...p, [itemId]: true }));
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/inventory/images?itemId=${itemId}`, { method: "POST", body: fd });
    if (r.ok) {
      const img = await r.json();
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                images: img.isPrimary
                  ? [img, ...it.images.map((i) => ({ ...i, isPrimary: false }))]
                  : [...it.images, img],
              }
            : it
        )
      );
    }
    setUploading((p) => ({ ...p, [itemId]: false }));
  }

  async function deleteImage(itemId: string, imageId: string) {
    await fetch(`/api/inventory/images?imageId=${imageId}`, { method: "DELETE" });
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, images: it.images.filter((i) => i.id !== imageId) } : it
      )
    );
  }

  async function setPrimary(itemId: string, imageId: string) {
    await fetch(`/api/inventory/images?imageId=${imageId}`, { method: "PATCH" });
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, images: it.images.map((i) => ({ ...i, isPrimary: i.id === imageId })) }
          : it
      )
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center space-y-3">
        <p className="text-sm text-destructive font-medium">Failed to load catalog items.</p>
        <button onClick={load} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card h-56 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catalog Items</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which items appear in the public catalog, manage photos, and edit details.
        </p>
      </div>

      {/* Stats strip */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{items.length}</span> total items
        </span>
        <span className="text-emerald-600">
          <span className="font-semibold">{items.filter((i) => i.catalogVisible).length}</span> in catalog
        </span>
        <span className="text-muted-foreground">
          <span className="font-semibold">{items.filter((i) => i.catalogVisible && i.images.length > 0).length}</span> with photos
        </span>
      </div>

      {/* Stone Type Cover Photos */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-foreground text-sm">Stone Type Cover Photos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">These images appear in the Amethyst, Garnet, etc. sections on the public catalog.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {stoneTypes.map((st) => {
            const img = stoneImages[st.name];
            const busy = uploadingStone[st.name];
            return (
              <div key={st.id} className="flex flex-col gap-1.5">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={st.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl opacity-20">💎</span>
                    </div>
                  )}
                  {busy && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-medium text-center text-foreground truncate">{st.name}</p>
                <label className={`text-[10px] text-center rounded border border-border cursor-pointer hover:bg-accent transition-colors py-0.5 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                  {img ? "Change" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { stoneFileRefs.current[st.name] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadStoneImage(st.name, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          {(["all", "on", "off"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs border transition-colors capitalize ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
              }`}
            >
              {f === "all" ? "All Items" : f === "on" ? "In Catalog" : "Hidden"}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, stone type, color…"
            className="ml-auto rounded-lg border bg-card px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
          />
        </div>
        {/* Stone type filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStoneFilter("all")}
            className={`rounded-full px-3 py-0.5 text-xs border transition-colors ${
              stoneFilter === "all" ? "bg-foreground text-background border-foreground" : "hover:bg-accent"
            }`}
          >
            All Types
          </button>
          {stoneTypes.map((st) => (
            <button
              key={st.id}
              onClick={() => setStoneFilter(stoneFilter === st.name ? "all" : st.name)}
              className={`rounded-full px-3 py-0.5 text-xs border transition-colors ${
                stoneFilter === st.name ? "bg-foreground text-background border-foreground" : "hover:bg-accent"
              }`}
            >
              {st.name}
              <span className="ml-1 opacity-50">
                {items.filter((i) => i.stoneType.name === st.name).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
          No items found.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map((item) => {
            const primary = item.images.find((i) => i.isPrimary) ?? item.images[0];
            const isExpanded = expanded === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col transition-all ${
                  item.catalogVisible ? "ring-1 ring-emerald-300" : ""
                }`}
              >
                {/* Image area */}
                <div
                  className="relative bg-muted aspect-square cursor-pointer group"
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                >
                  {primary ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={primary.url}
                      alt={item.sku}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <span className="text-3xl opacity-30">💎</span>
                      <span className="text-[10px] text-muted-foreground/50">No photo</span>
                    </div>
                  )}
                  {item.images.length > 1 && (
                    <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] rounded-full px-1.5 py-0.5">
                      {item.images.length}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-xs font-medium">
                      {isExpanded ? "Close photos" : "Manage photos"}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="px-2.5 py-2 flex-1 flex flex-col gap-1.5">
                  <div>
                    <p className="font-mono text-[11px] font-semibold text-foreground truncate">{item.sku}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.stoneType.name} · {item.color.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.shape.name} · {item.size.label} · {item.grade.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Qty: <span className="font-medium text-foreground">{item.qtyPieces}</span>
                      {item.sellingPriceEstimated
                        ? <> · <span className="font-medium text-foreground">{item.currency} {item.sellingPriceEstimated}</span></>
                        : null}
                    </p>
                    {(item.locationCabinet || item.locationTray) && (
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        📦 {[item.locationCabinet, item.locationTray, item.locationCompartment].filter(Boolean).join(" / ")}
                      </p>
                    )}
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(item)}
                    className="w-full rounded-lg py-1 text-[11px] font-medium border border-border hover:bg-accent transition-colors"
                  >
                    ✏️ Edit Details
                  </button>

                  {/* Catalog toggle */}
                  <button
                    onClick={() => toggleVisible(item)}
                    disabled={toggling[item.id]}
                    className={`w-full rounded-lg py-1 text-[11px] font-medium transition-colors border ${
                      item.catalogVisible
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    } ${toggling[item.id] ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {toggling[item.id] ? "…" : item.catalogVisible ? "✓ In Catalog" : "Hidden"}
                  </button>

                  {/* Upload button */}
                  <label className={`w-full rounded-lg py-1 text-[11px] font-medium text-center cursor-pointer border border-border hover:bg-accent transition-colors ${uploading[item.id] ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploading[item.id] ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Uploading…
                      </span>
                    ) : (
                      "＋ Add Photo"
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => { fileRefs.current[item.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(item.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {/* Expanded photo manager */}
                {isExpanded && item.images.length > 0 && (
                  <div className="border-t px-2.5 py-2.5 bg-muted/30 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Photos</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {item.images.map((img) => (
                        <div key={img.id} className="relative group aspect-square bg-muted rounded-lg overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {img.isPrimary && (
                            <span className="absolute top-0.5 left-0.5 bg-amber-400 text-[8px] text-white rounded px-1 font-bold">
                              MAIN
                            </span>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end justify-center gap-1 pb-1 opacity-0 group-hover:opacity-100">
                            {!img.isPrimary && (
                              <button
                                onClick={() => setPrimary(item.id, img.id)}
                                className="bg-white/90 text-[9px] rounded px-1 py-0.5 font-medium hover:bg-white"
                              >
                                Main
                              </button>
                            )}
                            <button
                              onClick={() => deleteImage(item.id, img.id)}
                              className="bg-red-500/90 text-white text-[9px] rounded px-1 py-0.5 font-medium hover:bg-red-600"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Details Modal */}
      {editItem && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-semibold text-foreground">Edit Item Details</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{editItem.sku}</p>
              </div>
              <button
                onClick={closeEdit}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className={`overflow-y-auto flex-1 px-6 py-5 space-y-4${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              {/* Item info (read-only) */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stone</span>
                  <span className="font-medium">{editItem.stoneType.name} · {editItem.color.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shape / Size</span>
                  <span className="font-medium">{editItem.shape.name} · {editItem.size.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grade</span>
                  <span className="font-medium">{editItem.grade.label}</span>
                </div>
                {editItem.weightPerPieceCarats && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight / pc</span>
                    <span className="font-medium">{editItem.weightPerPieceCarats} ct</span>
                  </div>
                )}
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Qty (pieces)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.qtyPieces}
                    onChange={(e) => setEditForm({ ...editForm, qtyPieces: e.target.value })}
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.lowStockThreshold}
                    onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })}
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Cost Price / pc ({editItem.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.costPricePerPiece}
                    onChange={(e) => setEditForm({ ...editForm, costPricePerPiece: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Selling Price / pc ({editItem.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.sellingPriceEstimated}
                    onChange={(e) => setEditForm({ ...editForm, sellingPriceEstimated: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Storage Location</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Cabinet</label>
                    <input
                      value={editForm.locationCabinet}
                      onChange={(e) => setEditForm({ ...editForm, locationCabinet: e.target.value })}
                      placeholder="A1"
                      className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Tray</label>
                    <input
                      value={editForm.locationTray}
                      onChange={(e) => setEditForm({ ...editForm, locationTray: e.target.value })}
                      placeholder="T3"
                      className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Compartment</label>
                    <input
                      value={editForm.locationCompartment}
                      onChange={(e) => setEditForm({ ...editForm, locationCompartment: e.target.value })}
                      placeholder="C2"
                      className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pt-3 pb-4 border-t space-y-2">
              {saveError && (
                <p className="text-xs text-destructive text-center">{saveError}</p>
              )}
              <div className="flex gap-2">
              <button
                onClick={closeEdit}
                disabled={saving}
                className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Saving…
                  </>
                ) : "Save Changes"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
