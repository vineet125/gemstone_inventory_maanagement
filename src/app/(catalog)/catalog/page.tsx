import Link from "next/link";
import { db } from "@/lib/db";

// ── Stone type colour map ─────────────────────────────────────────────────
function stoneStyle(name: string): { bg: string; accent: string } {
  const map: Record<string, { bg: string; accent: string }> = {
    Amethyst:   { bg: "linear-gradient(135deg,#3b0764,#6d28d9)", accent: "#c084fc" },
    Citrine:    { bg: "linear-gradient(135deg,#7c2d12,#b45309)", accent: "#fbbf24" },
    Garnet:     { bg: "linear-gradient(135deg,#4c0519,#9f1239)", accent: "#f87171" },
    Peridot:    { bg: "linear-gradient(135deg,#052e16,#166534)", accent: "#4ade80" },
    Aquamarine: { bg: "linear-gradient(135deg,#082f49,#0e7490)", accent: "#38bdf8" },
    Topaz:      { bg: "linear-gradient(135deg,#1e1b4b,#1d4ed8)", accent: "#818cf8" },
    Moonstone:  { bg: "linear-gradient(135deg,#0f172a,#334155)", accent: "#e2e8f0" },
    Tanzanite:  { bg: "linear-gradient(135deg,#2e1065,#4c1d95)", accent: "#a78bfa" },
    Tourmaline: { bg: "linear-gradient(135deg,#14532d,#be185d)", accent: "#fb7185" },
  };
  return map[name] ?? { bg: "linear-gradient(135deg,#1c1917,#292524)", accent: "#d4822a" };
}

// ── Data fetching ─────────────────────────────────────────────────────────
async function getData() {
  const [stoneTypes, featured, settingsRows] = await Promise.all([
    db.stoneType.findMany({
      where: { active: true },
      select: {
        id: true, name: true, descriptionEn: true,
        _count: {
          select: {
            inventoryItems: { where: { catalogVisible: true, qtyPieces: { gt: 0 } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.inventoryItem.findMany({
      where: { catalogVisible: true, qtyPieces: { gt: 0 } },
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, sku: true, qtyPieces: true, lowStockThreshold: true,
        weightPerPieceCarats: true,
        stoneType: { select: { name: true } },
        shape: { select: { name: true } },
        size: { select: { label: true } },
        color: { select: { name: true, hexCode: true } },
        grade: { select: { label: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
    }),
    db.siteSettings.findMany({ select: { key: true, value: true } }),
  ]);
  const m = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  let stoneImages: Record<string, string> = {};
  try { stoneImages = JSON.parse(m.stone_type_images ?? "{}"); } catch { /* use empty */ }
  return {
    stoneTypes, featured,
    settings: {
      waNumber: m.whatsapp_number ?? "919999999999",
      heroHeading: m.hero_heading ?? "Rare Brilliance, Refined to Perfection",
      heroSubtext: m.hero_subtext ?? "Wholesale semi-precious gemstones — Amethyst, Citrine, Garnet & more — precision-cut, quality-graded, and ready for your orders.",
      heroImageUrl: m.hero_image_url ?? "",
      stoneImages,
    },
  };
}

const ARROW = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const WA_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default async function CatalogHomePage() {
  const { stoneTypes, featured, settings } = await getData();
  const availableTypes = stoneTypes.filter((t) => t._count.inventoryItems > 0);
  const { waNumber, heroHeading, heroSubtext, heroImageUrl, stoneImages } = settings;
  const waDefaultMsg = encodeURIComponent(
    "Hi, I'm interested in your gemstone collection. Please share your catalog and pricing."
  );
  // Split heading: text before first comma stays white, text after gets amber gradient
  const commaIdx = heroHeading.indexOf(",");
  const headingLine1 = commaIdx >= 0 ? heroHeading.slice(0, commaIdx + 1) : heroHeading;
  const headingLine2 = commaIdx >= 0 ? heroHeading.slice(commaIdx + 1).trim() : "";

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center bg-[#0a0908] overflow-hidden">
        {/* Hero background image (if set) */}
        {heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImageUrl} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
        )}
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(212,130,42,0.14) 0%,transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(212,130,42,0.07) 0%,transparent 70%)" }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-28 w-full">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 mb-8"
              style={{ borderColor: "rgba(212,130,42,0.35)", background: "rgba(212,130,42,0.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300 text-xs font-semibold tracking-[0.25em] uppercase">
                Premium B2B Gemstone Supplier
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-bold text-white leading-[1.08] mb-6 tracking-tight">
              {headingLine1}{" "}
              {headingLine2 && (
                <span className="block" style={{
                  backgroundImage: "linear-gradient(135deg,#fbbf24 0%,#d4822a 50%,#b45309 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  {headingLine2}
                </span>
              )}
            </h1>

            <p className="text-gray-300 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl">
              {heroSubtext}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link href="/catalog/stones"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-all hover:brightness-110 shadow-lg"
                style={{ background: "linear-gradient(135deg,#d4822a,#b45309)", boxShadow: "0 8px 24px rgba(212,130,42,0.3)" }}>
                Browse Collection {ARROW}
              </Link>
              <a href={`https://wa.me/${waNumber}?text=${waDefaultMsg}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10 backdrop-blur-sm"
                style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}>
                {WA_ICON} WhatsApp Inquiry
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-20 flex flex-wrap gap-6 sm:gap-10">
            {[
              { n: `${availableTypes.length}+`, label: "Stone Varieties" },
              { n: "AA", label: "Top Grade Available" },
              { n: "B2B", label: "Wholesale Supply" },
              { n: "100%", label: "Graded & Certified" },
            ].map(({ n, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="h-8 w-px" style={{ background: "rgba(212,130,42,0.35)" }} />
                <div>
                  <p className="text-2xl font-bold text-amber-400">{n}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stone Type Categories ────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0f0e0c]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="text-amber-400 text-xs font-semibold tracking-[0.25em] uppercase mb-2">Our Specialities</p>
              <h2 className="text-3xl font-bold text-white">Browse by Stone Type</h2>
            </div>
            <Link href="/catalog/stones"
              className="hidden sm:block text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {stoneTypes.map((type) => {
              const s = stoneStyle(type.name);
              const typeImg = stoneImages[type.name];
              return (
                <Link key={type.id} href={`/catalog/stones?typeId=${type.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                  style={{ background: s.bg }}>
                  {typeImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={typeImg} alt={type.name} aria-hidden
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none" />
                  )}
                  <div className="p-5 sm:p-6">
                    <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-lg"
                      style={{ background: `${s.accent}25` }}>
                      <span style={{ color: s.accent }}>◆</span>
                    </div>
                    <h3 className="font-bold text-white text-sm sm:text-base mb-1">{type.name}</h3>
                    {type.descriptionEn && (
                      <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: `${s.accent}99` }}>
                        {type.descriptionEn}
                      </p>
                    )}
                    <p className="text-xs font-semibold" style={{ color: s.accent }}>
                      {type._count.inventoryItems > 0
                        ? `${type._count.inventoryItems} items available →`
                        : "Coming soon"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Featured Stones ──────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-20 px-6" style={{ background: "#fafaf9" }}>
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 flex items-end justify-between">
              <div>
                <p className="text-amber-600 text-xs font-semibold tracking-[0.25em] uppercase mb-2">
                  Handpicked Selection
                </p>
                <h2 className="text-3xl font-bold text-gray-900">Featured Stones</h2>
              </div>
              <Link href="/catalog/stones"
                className="hidden sm:block text-amber-600 hover:text-amber-500 text-sm font-medium transition-colors">
                Full collection →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((item) => {
                const isLow = item.qtyPieces <= item.lowStockThreshold;
                const gradient = stoneStyle(item.stoneType.name).bg;
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
                      ) : (
                        <span className="text-5xl opacity-25 text-white">◆</span>
                      )}
                      <span className="absolute top-2.5 right-2.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
                        {item.grade.label}
                      </span>
                      <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isLow ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLow ? "bg-amber-500" : "bg-green-500"}`} />
                        {isLow ? "Limited" : "Available"}
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
                      <h3 className="font-bold text-gray-900">{item.stoneType.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {item.shape.name} · {item.size.label}
                        {item.weightPerPieceCarats ? ` · ${item.weightPerPieceCarats}ct` : ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Why Us ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-600 text-xs font-semibold tracking-[0.25em] uppercase mb-2">Why Choose Us</p>
            <h2 className="text-3xl font-bold text-gray-900">Trusted by Jewellers &amp; Exporters</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: "✦",
                title: "Premium Quality",
                desc: "Every stone is hand-inspected and graded from AA to commercial. Consistent standards across all batches — no surprises.",
                color: "#d4822a",
              },
              {
                icon: "◈",
                title: "Wide Selection",
                desc: "Amethyst, Citrine, Garnet, Peridot and more — multiple cuts, sizes and colour grades to meet every specification.",
                color: "#6d28d9",
              },
              {
                icon: "⬡",
                title: "Reliable Supply",
                desc: "Steady stock maintained year-round. Bulk orders fulfilled with consistent quality and prompt delivery.",
                color: "#0e7490",
              },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} className="rounded-2xl border border-gray-100 p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-5"
                  style={{ background: `${color}15`, color }}>
                  {icon}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WhatsApp CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0a0908] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 100%,rgba(212,130,42,0.1) 0%,transparent 70%)" }} />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-amber-400 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Ready to Order?</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Let&apos;s Talk Gemstones
          </h2>
          <p className="text-gray-400 mb-10 leading-relaxed max-w-xl mx-auto">
            Contact us for bulk pricing, custom specifications, or to request samples.
            We typically respond within a few hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={`https://wa.me/${waNumber}?text=${waDefaultMsg}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] px-8 py-4 text-base font-semibold text-white transition-colors shadow-lg"
              style={{ boxShadow: "0 8px 24px rgba(37,211,102,0.25)" }}>
              {WA_ICON} Chat on WhatsApp
            </a>
            <Link href="/catalog/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}>
              Send Inquiry Form
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
