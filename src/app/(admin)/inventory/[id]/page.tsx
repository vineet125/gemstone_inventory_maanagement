"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

interface ItemImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface StockMovement {
  id: string;
  movementType: string;
  qtyChange: number;
  notes: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
}

interface InventoryItem {
  id: string;
  sku: string;
  qtyPieces: number;
  lowStockThreshold: number;
  weightPerPieceGrams: number | null;
  weightPerPieceCarats: number | null;
  costPricePerPiece: number | null;
  sellingPriceEstimated: number | null;
  currency: string;
  locationCabinet: string | null;
  locationTray: string | null;
  locationCompartment: string | null;
  catalogVisible: boolean;
  stoneType: { name: string };
  shape: { name: string };
  size: { label: string };
  color: { name: string; hexCode: string | null };
  grade: { label: string };
  images: ItemImage[];
  stockMovements: StockMovement[];
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  STOCK_IN_PURCHASE: { label: "Purchase In", color: "text-green-700" },
  STOCK_IN_RETURN: { label: "Return In", color: "text-green-600" },
  STOCK_OUT_SALE: { label: "Sale Out", color: "text-red-600" },
  STOCK_OUT_CONSIGNMENT: { label: "Consignment Out", color: "text-orange-600" },
  ADJUSTMENT: { label: "Adjustment", color: "text-blue-600" },
};

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/inventory/${id}`);
    if (res.ok) {
      const data = await res.json();
      setItem(data);
      const primary = data.images.find((i: ItemImage) => i.isPrimary);
      setSelectedImg(primary?.url ?? data.images[0]?.url ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function uploadFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/inventory/images?itemId=${id}`, { method: "POST", body: fd });
    if (res.ok) await load();
    setUploading(false);
  }

  async function addUrl() {
    if (!urlInput.trim()) return;
    setUploading(true);
    const res = await fetch(`/api/inventory/images?itemId=${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.trim() }),
    });
    if (res.ok) { setUrlInput(""); setShowUrlInput(false); await load(); }
    setUploading(false);
  }

  async function setPrimary(imageId: string) {
    await fetch(`/api/inventory/images?imageId=${imageId}`, { method: "PATCH" });
    await load();
  }

  async function deleteImage(imageId: string) {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/inventory/images?imageId=${imageId}`, { method: "DELETE" });
    await load();
  }

  function onFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground/60">Loading…</div>;
  if (!item) return <div className="py-16 text-center text-sm text-red-500">Item not found.</div>;

  const location = [item.locationCabinet, item.locationTray, item.locationCompartment].filter(Boolean).join(" / ");
  const isLowStock = item.qtyPieces > 0 && item.qtyPieces <= item.lowStockThreshold;
  const isOutOfStock = item.qtyPieces === 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => router.back()} className="text-muted-foreground/60 hover:text-muted-foreground">←</button>
        <Link href="/inventory" className="text-muted-foreground hover:text-foreground">Inventory</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-foreground">{item.sku}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── Left: Photos ─────────────────────────────── */}
        <div className="space-y-3">
          {/* Main photo viewer */}
          <div
            className="relative rounded-2xl border-2 border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center"
            style={{ minHeight: 280 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onFileDrop}
          >
            {selectedImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedImg}
                alt={item.sku}
                className="w-full h-full object-contain max-h-72"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-gray-300">
                <span className="text-6xl">💎</span>
                <p className="text-sm font-medium text-muted-foreground/60">No photo yet</p>
                <p className="text-xs text-gray-300">Drag & drop an image here</p>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-card/80 flex items-center justify-center rounded-2xl">
                <p className="text-sm font-semibold text-amber-600">Uploading…</p>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {item.images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {item.images.map((img) => (
                <div key={img.id} className="relative group shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    onClick={() => setSelectedImg(img.url)}
                    className={`w-16 h-16 object-cover rounded-xl cursor-pointer border-2 transition-all ${
                      selectedImg === img.url
                        ? "border-amber-500 shadow-md"
                        : "border-transparent hover:border-border"
                    }`}
                  />
                  {img.isPrimary && (
                    <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-[9px]">★</span>
                  )}
                  {/* Hover actions */}
                  <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!img.isPrimary && (
                      <button onClick={() => setPrimary(img.id)} title="Set as main" className="text-yellow-300 text-sm hover:scale-110 transition-transform">★</button>
                    )}
                    <button onClick={() => deleteImage(img.id)} title="Delete" className="text-red-300 text-sm hover:scale-110 transition-transform">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload controls */}
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadFile(f); e.target.value = ""; } }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              📷 Upload Photo
            </button>
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${showUrlInput ? "bg-gray-100 text-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}
            >
              🔗 URL
            </button>
          </div>

          {showUrlInput && (
            <div className="flex gap-2">
              <input
                autoFocus
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
                placeholder="Paste image URL and press Enter…"
                className="flex-1 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={addUrl} disabled={uploading || !urlInput.trim()}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
                Add
              </button>
            </div>
          )}

          {item.images.length > 0 && (
            <p className="text-xs text-muted-foreground/60 text-center">
              ★ = main photo shown in catalog · hover thumbnail to set/delete
            </p>
          )}
        </div>

        {/* ── Right: Item Details ───────────────────────── */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground font-mono tracking-wide">{item.sku}</h1>
              {item.catalogVisible && (
                <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-semibold mt-1">
                  ✓ In Catalog
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {item.stoneType.name} — {item.shape.name} — {item.size.label} — Grade {item.grade.label}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {item.color.hexCode && (
                <div className="w-4 h-4 rounded-full border border-border" style={{ background: item.color.hexCode }} />
              )}
              <span className="text-sm text-muted-foreground">{item.color.name}</span>
            </div>
          </div>

          {/* Stock */}
          <div className="rounded-xl bg-card border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stock</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground/60">Available</p>
                <p className={`text-3xl font-bold ${isOutOfStock ? "text-red-500" : isLowStock ? "text-orange-500" : "text-foreground"}`}>
                  {item.qtyPieces}
                  <span className="text-base font-normal text-muted-foreground/60 ml-1">pcs</span>
                </p>
                {item.weightPerPieceCarats && item.qtyPieces > 0 && (
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    = {(item.qtyPieces * item.weightPerPieceCarats).toFixed(2)} ct total
                  </p>
                )}
                {isOutOfStock && <p className="text-xs text-red-500 font-medium">Out of stock</p>}
                {isLowStock && <p className="text-xs text-orange-500 font-medium">Low stock ({item.lowStockThreshold} threshold)</p>}
              </div>
              {item.weightPerPieceCarats && (
                <div>
                  <p className="text-xs text-muted-foreground/60">Per piece</p>
                  <p className="text-lg font-semibold text-foreground">{item.weightPerPieceCarats} ct</p>
                  {item.weightPerPieceGrams && <p className="text-xs text-muted-foreground/60">{item.weightPerPieceGrams} g</p>}
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          {(item.costPricePerPiece || item.sellingPriceEstimated) && (
            <div className="rounded-xl bg-card border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing</p>
              <div className="grid grid-cols-2 gap-4">
                {item.costPricePerPiece && (
                  <div>
                    <p className="text-xs text-muted-foreground/60">Cost/piece</p>
                    <p className="text-lg font-bold text-foreground">₹{item.costPricePerPiece.toLocaleString()}</p>
                  </div>
                )}
                {item.sellingPriceEstimated && (
                  <div>
                    <p className="text-xs text-muted-foreground/60">Selling/piece</p>
                    <p className="text-lg font-bold text-amber-600">₹{item.sellingPriceEstimated.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {location && (
            <div className="rounded-xl bg-card border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Storage Location</p>
              <p className="text-sm font-medium text-foreground">{location}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock movement history */}
      {item.stockMovements.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold text-foreground">Stock Movement History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-right px-4 py-2.5">Qty Change</th>
                  <th className="text-left px-4 py-2.5">Notes</th>
                  <th className="text-left px-4 py-2.5">By</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {item.stockMovements.map((m) => {
                  const meta = MOVEMENT_LABELS[m.movementType] ?? { label: m.movementType, color: "text-foreground" };
                  return (
                    <tr key={m.id} className="hover:bg-accent">
                      <td className={`px-4 py-2.5 font-medium ${meta.color}`}>{meta.label}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${m.qtyChange > 0 ? "text-green-700" : "text-red-600"}`}>
                        {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{m.notes ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.createdBy?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground/60 whitespace-nowrap">
                        {format(new Date(m.createdAt), "dd MMM yyyy")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
