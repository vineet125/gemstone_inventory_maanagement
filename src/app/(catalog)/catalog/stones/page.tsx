"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────
interface FilterItem { id: string; name?: string; label?: string; }
interface StoneItem {
  id: string; sku: string; qtyPieces: number; lowStockThreshold: number;
  weightPerPieceCarats: number | null;
  stoneType: { id: string; name: string };
  shape: { id: string; name: string };
  size: { id: string; label: string };
  color: { id: string; name: string; hexCode: string | null };
  grade: { id: string; label: string };
  images: Array<{ url: string }>;
}

// ── Stone gradient helper ─────────────────────────────────────────────────
function stoneGradient(name: string): string {
  const map: Record<string, string> = {
    Amethyst: "linear-gradient(135deg,#3b0764,#6d28d9)",
    Citrine: "linear-gradient(135deg,#7c2d12,#b45309)",
    Garnet: "linear-gradient(135deg,#4c0519,#9f1239)",
    Peridot: "linear-gradient(135deg,#052e16,#166534)",
    Aquamarine: "linear-gradient(135deg,#082f49,#0e7490)",
    Topaz: "linear-gradient(135deg,#1e1b4b,#1d4ed8)",
    Moonstone: "linear-gradient(135deg,#0f172a,#334155)",
    Tanzanite: "linear-gradient(135deg,#2e1065,#4c1d95)",
  };
  return map[name] ?? "linear-gradient(135deg,#1c1917,#292524)";
}

// ── Main component (needs to be wrapped for useSearchParams) ──────────────
function StonesContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<StoneItem[]>([]);
  const [types, setTypes] = useState<FilterItem[]>([]);
  const [shapes, setShapes] = useState<FilterItem[]>([]);
  const [grades, setGrades] = useState<FilterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    typeId: searchParams.get("typeId") ?? "",
    shapeId: "",
    gradeId: "",
  });
  const [mobileFilter, setMobileFilter] = useState(false);
  const [stoneImages, setStoneImages] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/catalog/stone-types").then((r) => r.ok ? r.json() : []),
      fetch("/api/settings/shapes").then((r) => r.ok ? r.json() : []),
      fetch("/api/settings/grades").then((r) => r.ok ? r.json() : []),
      fetch("/api/catalog/settings").then((r) => r.ok ? r.json() : null),
    ]).then(([t, s, g, cfg]) => {
      setTypes(t); setShapes(s); setGrades(g);
      if (cfg?.stoneImages) setStoneImages(cfg.stoneImages);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.typeId) params.set("typeId", filters.typeId);
    if (filters.shapeId) params.set("shapeId", filters.shapeId);
    if (filters.gradeId) params.set("gradeId", filters.gradeId);
    fetch(`/api/catalog/stones?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setItems(data); setLoading(false); });
  }, [filters]);

  const filtered = search.trim()
    ? items.filter((i) =>
        i.stoneType.name.toLowerCase().includes(search.toLowerCase()) ||
        i.color.name.toLowerCase().includes(search.toLowerCase()) ||
        i.shape.name.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const activeType = types.find((t) => t.id === filters.typeId);

  return (
    <div className="bg-white min-h-screen">
      {/* Page header */}
      <div className="bg-[#0f0e0c] py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-amber-400 text-xs font-semibold tracking-[0.25em] uppercase mb-2">
            {activeType ? `Filtered by: ${activeType.name}` : "Full Collection"}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            {activeType ? `${activeType.name} Collection` : "Our Stone Collection"}
          </h1>
          {/* Search bar */}
          <div className="relative max-w-xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by stone type, colour, shape…"
              className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/8"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Mobile filter toggle */}
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <p className="text-sm text-gray-500">
            {loading ? "Loading…" : `${filtered.length} stones`}
          </p>
          <button onClick={() => setMobileFilter(!mobileFilter)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {(filters.typeId || filters.shapeId || filters.gradeId) && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                {[filters.typeId, filters.shapeId, filters.gradeId].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-8">
          {/* ── Filter Sidebar ─────────────────────────────────────────── */}
          <aside className={`${mobileFilter ? "block" : "hidden"} lg:block w-full lg:w-56 shrink-0`}>
            <div className="sticky top-24 space-y-6">
              {/* Clear filters */}
              {(filters.typeId || filters.shapeId || filters.gradeId) && (
                <button
                  onClick={() => setFilters({ typeId: "", shapeId: "", gradeId: "" })}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                  ✕ Clear all filters
                </button>
              )}

              {/* Stone Type */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Stone Type</h3>
                <div className="space-y-0.5">
                  <button onClick={() => setFilters({ ...filters, typeId: "" })}
                    className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      !filters.typeId
                        ? "bg-amber-50 text-amber-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}>
                    All Types
                  </button>
                  {types.map((t) => (
                    <button key={t.id} onClick={() => setFilters({ ...filters, typeId: t.id })}
                      className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        filters.typeId === t.id
                          ? "bg-amber-50 text-amber-700 font-semibold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shape */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Shape</h3>
                <div className="space-y-0.5">
                  <button onClick={() => setFilters({ ...filters, shapeId: "" })}
                    className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      !filters.shapeId ? "bg-gray-100 text-gray-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}>
                    All Shapes
                  </button>
                  {shapes.map((s) => (
                    <button key={s.id} onClick={() => setFilters({ ...filters, shapeId: s.id })}
                      className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        filters.shapeId === s.id
                          ? "bg-amber-50 text-amber-700 font-semibold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Grade</h3>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setFilters({ ...filters, gradeId: "" })}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      !filters.gradeId
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    All
                  </button>
                  {grades.map((g) => (
                    <button key={g.id} onClick={() => setFilters({ ...filters, gradeId: g.id })}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        filters.gradeId === g.id
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── Stone Grid ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="hidden lg:flex items-center justify-between mb-6">
              <p className="text-sm text-gray-400">
                {loading ? "Loading…" : `${filtered.length} stone${filtered.length !== 1 ? "s" : ""} found`}
              </p>
            </div>

            {loading ? (
              /* Skeleton */
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                    <div className="aspect-[4/3] bg-gray-100" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="h-4 w-28 bg-gray-100 rounded" />
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-5xl mb-4">💎</p>
                <p className="text-lg font-semibold text-gray-900 mb-1">No stones found</p>
                <p className="text-sm text-gray-400 mb-6">Try adjusting your filters or search</p>
                <button onClick={() => { setFilters({ typeId: "", shapeId: "", gradeId: "" }); setSearch(""); }}
                  className="text-amber-600 hover:text-amber-500 text-sm font-medium underline">
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map((item) => {
                  const isLow = item.qtyPieces > 0 && item.qtyPieces <= item.lowStockThreshold;
                  const isOut = item.qtyPieces === 0;
                  const gradient = stoneGradient(item.stoneType.name);
                  const typeImg = stoneImages[item.stoneType.name];

                  return (
                    <Link key={item.id} href={`/catalog/stones/${item.id}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      {/* Image */}
                      <div className="aspect-[4/3] relative overflow-hidden flex items-center justify-center"
                        style={{ background: item.images[0] ? undefined : gradient }}>
                        {item.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.images[0].url} alt={item.stoneType.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : typeImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={typeImg} alt={item.stoneType.name}
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <span className="text-4xl opacity-20 text-white">◆</span>
                        )}
                        {/* Grade badge */}
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                          {item.grade.label}
                        </span>
                        {/* Stock badge */}
                        <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isOut ? "bg-red-100 text-red-600"
                            : isLow ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-green-500"
                          }`} />
                          {isOut ? "Out of Stock" : isLow ? "Limited" : "Available"}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {item.color.hexCode && (
                            <span className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                              style={{ backgroundColor: item.color.hexCode }} />
                          )}
                          <span className="text-xs text-gray-400">{item.color.name}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 leading-tight">{item.stoneType.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {item.shape.name} · {item.size.label}
                        </p>
                        {item.weightPerPieceCarats && (
                          <p className="text-xs font-semibold text-amber-600 mt-1.5">
                            {item.weightPerPieceCarats} ct / piece
                          </p>
                        )}
                        <div className="mt-3 text-xs text-amber-600 font-medium group-hover:underline">
                          View Details →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StonesPage() {
  return (
    <Suspense>
      <StonesContent />
    </Suspense>
  );
}
