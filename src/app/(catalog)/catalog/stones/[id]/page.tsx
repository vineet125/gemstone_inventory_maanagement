"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ── Stone gradient helper ─────────────────────────────────────────────────
function stoneGradient(name: string): string {
  const map: Record<string, string> = {
    Amethyst:   "linear-gradient(135deg,#3b0764,#6d28d9)",
    Citrine:    "linear-gradient(135deg,#7c2d12,#b45309)",
    Garnet:     "linear-gradient(135deg,#4c0519,#9f1239)",
    Peridot:    "linear-gradient(135deg,#052e16,#166534)",
    Aquamarine: "linear-gradient(135deg,#082f49,#0e7490)",
    Topaz:      "linear-gradient(135deg,#1e1b4b,#1d4ed8)",
    Moonstone:  "linear-gradient(135deg,#0f172a,#334155)",
    Tanzanite:  "linear-gradient(135deg,#2e1065,#4c1d95)",
  };
  return map[name] ?? "linear-gradient(135deg,#1c1917,#292524)";
}

const WA_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────
interface ItemImage { id: string; url: string; isPrimary: boolean; }
interface StoneItem {
  id: string; sku: string; qtyPieces: number; lowStockThreshold: number;
  weightPerPieceGrams: number | null; weightPerPieceCarats: number | null;
  stoneType: { id: string; name: string; descriptionEn: string | null };
  shape: { name: string };
  size: { label: string };
  color: { name: string; hexCode: string | null };
  grade: { label: string };
  images: ItemImage[];
}

export default function StoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<StoneItem | null>(null);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [waNumber, setWaNumber] = useState("919999999999");

  useEffect(() => {
    fetch("/api/catalog/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((s) => { if (s?.waNumber) setWaNumber(s.waNumber); });
  }, []);

  useEffect(() => {
    fetch(`/api/catalog/stones/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setItem(data);
          const primary = data.images.find((i: ItemImage) => i.isPrimary);
          setSelectedImg(primary?.url ?? data.images[0]?.url ?? null);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading stone details…</p>
        </div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-5xl mb-4">💎</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Stone not found</h2>
          <p className="text-gray-500 mb-6 text-sm">This item may no longer be available in the catalog.</p>
          <Link href="/catalog/stones"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-500 font-medium">
            ← Back to collection
          </Link>
        </div>
      </div>
    );
  }

  const isLow = item.qtyPieces > 0 && item.qtyPieces <= item.lowStockThreshold;
  const isOut = item.qtyPieces === 0;
  const gradient = stoneGradient(item.stoneType.name);

  const waInquiryMsg = encodeURIComponent(
    `Hi, I'm interested in: ${item.stoneType.name} — ${item.shape.name} — ${item.size.label} — Grade ${item.grade.label}${item.weightPerPieceCarats ? ` — ${item.weightPerPieceCarats}ct` : ""}.\nRef: ${item.sku}\n\nPlease share pricing and availability.`
  );
  const waAvailMsg = encodeURIComponent(
    `Hi, I'm looking for ${item.stoneType.name} — ${item.shape.name} — Grade ${item.grade.label}. Is it available or coming soon? Ref: ${item.sku}`
  );

  const specs = [
    { label: "Stone Type", value: item.stoneType.name },
    { label: "Shape", value: item.shape.name },
    { label: "Size", value: item.size.label },
    { label: "Grade", value: item.grade.label },
    { label: "Colour", value: item.color.name, hex: item.color.hexCode },
    ...(item.weightPerPieceCarats ? [{ label: "Weight / piece", value: `${item.weightPerPieceCarats} ct` }] : []),
    ...(item.weightPerPieceGrams ? [{ label: "Weight (g) / piece", value: `${item.weightPerPieceGrams} g` }] : []),
    ...(item.weightPerPieceCarats && item.qtyPieces > 0
      ? [{ label: "Total Stock Weight", value: `${(item.qtyPieces * item.weightPerPieceCarats).toFixed(2)} ct` }]
      : []),
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-[#0f0e0c] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <nav className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/catalog" className="hover:text-amber-400 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/catalog/stones" className="hover:text-amber-400 transition-colors">Collection</Link>
            <span>/</span>
            <span className="text-gray-300 font-medium">{item.stoneType.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">

          {/* ── Left: Image Gallery ─────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Main image */}
            <div className="aspect-square rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative"
              style={{ background: selectedImg ? "#f9f9f9" : gradient }}>
              {selectedImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedImg} alt={item.stoneType.name}
                  className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <span className="text-8xl opacity-20 text-white">◆</span>
                  <p className="text-white/40 text-sm mt-3">No photo available</p>
                </div>
              )}
              {/* Grade badge overlaid on image */}
              <div className="absolute top-4 right-4">
                <span className="rounded-full px-3 py-1 text-sm font-bold text-white shadow-lg"
                  style={{ background: "linear-gradient(135deg,#d4822a,#b45309)" }}>
                  Grade {item.grade.label}
                </span>
              </div>
            </div>

            {/* Thumbnail strip */}
            {item.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {item.images.map((img) => (
                  <button key={img.id} onClick={() => setSelectedImg(img.url)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImg === img.url
                        ? "border-amber-500 shadow-md"
                        : "border-gray-100 hover:border-gray-300"
                    }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Details ──────────────────────────────────────────── */}
          <div className="space-y-7">
            {/* Status + title */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  isOut ? "bg-red-50 text-red-600 border border-red-100"
                    : isLow ? "bg-amber-50 text-amber-700 border border-amber-100"
                    : "bg-green-50 text-green-700 border border-green-100"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isOut ? "bg-red-500" : isLow ? "bg-amber-500 animate-pulse" : "bg-green-500"
                  }`} />
                  {isOut ? "Out of Stock" : isLow ? "Limited Stock" : "In Stock"}
                </span>
              </div>

              <h1 className="text-4xl font-bold text-gray-900 leading-tight">
                {item.stoneType.name}
              </h1>
              <p className="text-lg text-gray-500 mt-1">
                {item.shape.name} · {item.size.label} · Grade {item.grade.label}
              </p>
              {item.stoneType.descriptionEn && (
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                  {item.stoneType.descriptionEn}
                </p>
              )}
            </div>

            {/* Spec grid */}
            <div className="grid grid-cols-2 gap-3">
              {specs.map(({ label, value, hex }) => (
                <div key={label} className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5">{label}</p>
                  <div className="flex items-center gap-2">
                    {hex && (
                      <span className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                        style={{ backgroundColor: hex }} />
                    )}
                    <p className="font-semibold text-gray-900 text-sm">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* CTA Buttons */}
            {!isOut ? (
              <div className="space-y-3">
                <a href={`https://wa.me/${waNumber}?text=${waInquiryMsg}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] py-4 text-base font-semibold text-white transition-colors shadow-lg"
                  style={{ boxShadow: "0 8px 24px rgba(37,211,102,0.2)" }}>
                  {WA_ICON} Inquire on WhatsApp
                </a>
                <Link href={`/catalog/contact`}
                  className="flex items-center justify-center w-full rounded-2xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 py-4 text-base font-semibold text-gray-700 hover:text-amber-700 transition-all">
                  Send Inquiry Form
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-500">
                    This item is currently out of stock. Contact us to check restocking dates or find alternatives.
                  </p>
                </div>
                <a href={`https://wa.me/${waNumber}?text=${waAvailMsg}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-gray-900 hover:bg-gray-800 py-4 text-base font-semibold text-white transition-colors">
                  {WA_ICON} Ask About Availability
                </a>
              </div>
            )}

            {/* Reference */}
            <p className="text-xs text-gray-300 text-center">Product Reference: {item.sku}</p>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-16 pt-8 border-t border-gray-100">
          <Link href="/catalog/stones"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-500 font-medium text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back to Collection
          </Link>
        </div>
      </div>
    </div>
  );
}
