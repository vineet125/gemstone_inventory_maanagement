"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface StoneType { id: string; name: string; active: boolean; }

// ── Suggested free Unsplash images ────────────────────────────────────────
const SUGGESTED_IMAGES: Record<string, string> = {
  Amethyst:    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80",
  Citrine:     "https://images.unsplash.com/photo-1596304040055-4c02ac24c6f8?auto=format&fit=crop&w=600&q=80",
  Garnet:      "https://images.unsplash.com/photo-1589674781759-c21c37956a44?auto=format&fit=crop&w=600&q=80",
  Peridot:     "https://images.unsplash.com/photo-1572635148818-ef6fd45eb394?auto=format&fit=crop&w=600&q=80",
  Aquamarine:  "https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?auto=format&fit=crop&w=600&q=80",
  Topaz:       "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=600&q=80",
  Tourmaline:  "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=600&q=80",
  Moonstone:   "https://images.unsplash.com/photo-1603561596112-0a132b757442?auto=format&fit=crop&w=600&q=80",
  Tanzanite:   "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=600&q=80",
};

const HERO_SUGGESTIONS = [
  { label: "Amethyst Crystals (dark purple)", url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1920&q=80" },
  { label: "Jewelry on dark background", url: "https://images.unsplash.com/photo-1573408301185-9519f94816ef?auto=format&fit=crop&w=1920&q=80" },
  { label: "Coloured gemstone collection", url: "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1920&q=80" },
  { label: "Crystal close-up", url: "https://images.unsplash.com/photo-1584302936820-ebac3d0c3a6d?auto=format&fit=crop&w=1920&q=80" },
];

const DEFAULTS = {
  company_name:    "GemStock Gems",
  company_tagline: "Premium Semi-Precious Gemstones",
  company_about:   "Wholesale semi-precious gemstones — precision-cut, quality-graded, and ready for jewellers & exporters worldwide.",
  whatsapp_number: "919999999999",
  hero_heading:    "Rare Brilliance, Refined to Perfection",
  hero_subtext:    "Wholesale semi-precious gemstones — Amethyst, Citrine, Garnet & more — precision-cut, quality-graded, and ready for your orders.",
  hero_image_url:  "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1920&q=80",
  logo_url:        "",
  stone_type_images: "{}",
};

export default function CatalogSettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [stoneImages, setStoneImages] = useState<Record<string, string>>({});
  const [stoneTypes, setStoneTypes] = useState<StoneType[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"company" | "hero" | "stones">("company");
  const isAdmin = useIsAdmin();

  // Load stone types + current settings
  useEffect(() => {
    fetch("/api/settings/stone-types")
      .then((r) => r.ok ? r.json() : [])
      .then(setStoneTypes);

    fetch("/api/settings/catalog-site")
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => {
        setSettings({ ...DEFAULTS, ...data });
        try {
          setStoneImages(JSON.parse(data.stone_type_images ?? "{}"));
        } catch { setStoneImages({}); }
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/catalog-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          stone_type_images: JSON.stringify(stoneImages),
        }),
      });
      if (res.ok) {
        toast.success("Catalog settings saved! Changes are live on the catalog immediately.");
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error ?? `Error ${res.status}`;
        toast.error(`Save failed: ${msg}`);
      }
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "Network error"}`);
    } finally {
      setSaving(false);
    }
  }

  function set(key: keyof typeof DEFAULTS, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function applyAllSuggested() {
    const newImages = { ...stoneImages };
    stoneTypes.forEach((st) => {
      if (SUGGESTED_IMAGES[st.name] && !newImages[st.name]) {
        newImages[st.name] = SUGGESTED_IMAGES[st.name];
      }
    });
    setStoneImages(newImages);
    toast.success("Suggested images applied — save to publish.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catalog Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controls your public catalog at{" "}
            <Link href="/catalog" target="_blank" className="text-primary hover:underline">
              /catalog ↗
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/catalog" target="_blank"
            className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">
            Preview →
          </Link>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving…" : "Save All"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(["company", "hero", "stones"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition-all ${
              activeTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "company" ? "🏢 Company" : t === "hero" ? "🖼 Hero Banner" : "💎 Stone Images"}
          </button>
        ))}
      </div>

      {/* ── Company & Contact ────────────────────────────────────────────── */}
      {activeTab === "company" && (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-foreground">Company Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Company Name *</label>
                <input value={settings.company_name} onChange={(e) => set("company_name", e.target.value)}
                  placeholder="GemStock Gems"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tagline</label>
                <input value={settings.company_tagline} onChange={(e) => set("company_tagline", e.target.value)}
                  placeholder="Premium Semi-Precious Gemstones"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">About / Description</label>
              <textarea rows={3} value={settings.company_about} onChange={(e) => set("company_about", e.target.value)}
                placeholder="Short description shown in catalog footer and hero"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-foreground">Contact & WhatsApp</h2>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input value={settings.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, ""))}
                  placeholder="919876543210 (with country code, no +)"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
                {settings.whatsapp_number && (
                  <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500">
                    Test ↗
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1">
                For India +91 98765 43210 → enter <code className="bg-gray-100 px-1 rounded">919876543210</code>
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-foreground">Logo</h2>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Logo Image URL</label>
              <input value={settings.logo_url} onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://your-cdn.com/logo.png (leave empty to use text logo)"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {settings.logo_url && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logo_url} alt="Logo" className="h-10 object-contain" />
                <p className="text-xs text-muted-foreground/60">Logo preview on dark background</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hero Banner ───────────────────────────────────────────────────── */}
      {activeTab === "hero" && (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-foreground">Hero Text</h2>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Main Heading</label>
              <input value={settings.hero_heading} onChange={(e) => set("hero_heading", e.target.value)}
                placeholder="Rare Brilliance, Refined to Perfection"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sub-heading</label>
              <textarea rows={3} value={settings.hero_subtext} onChange={(e) => set("hero_subtext", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-foreground">Background Image</h2>
            <p className="text-sm text-muted-foreground">
              Use any publicly accessible image URL. Paste from Google Images, Unsplash, or upload to your own server.
            </p>

            {/* Suggestion tiles */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Picks (free Unsplash images)</p>
              <div className="grid grid-cols-2 gap-2">
                {HERO_SUGGESTIONS.map(({ label, url }) => (
                  <button key={url} onClick={() => set("hero_image_url", url)}
                    className={`relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                      settings.hero_image_url === url ? "border-primary shadow-md" : "border-transparent hover:border-border"
                    }`}>
                    <div className="h-24 bg-gray-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url.replace("w=1920", "w=400")} alt={label}
                        className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-2">
                      <p className="text-white text-xs font-medium leading-tight">{label}</p>
                    </div>
                    {settings.hero_image_url === url && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Custom Image URL</label>
              <input value={settings.hero_image_url} onChange={(e) => set("hero_image_url", e.target.value)}
                placeholder="https://images.unsplash.com/photo-xxxxx?auto=format&fit=crop&w=1920&q=80"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* Live preview */}
            {settings.hero_image_url && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                <div className="relative h-48 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0.65)), url('${settings.hero_image_url}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}>
                  <div className="text-center px-4">
                    <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-1">Premium B2B Gemstone Supplier</p>
                    <p className="text-white text-xl font-bold">{settings.hero_heading}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stone Type Images ─────────────────────────────────────────────── */}
      {activeTab === "stones" && (
        <div className="space-y-5">
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 flex items-start gap-3">
            <span className="text-amber-600 text-lg">💡</span>
            <div>
              <p className="text-sm font-semibold text-amber-900">Images make your catalog stunning</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Each stone type can have a photo shown in the category grid on your catalog homepage.
                Use the Suggest All button to auto-fill with curated free images.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{stoneTypes.length} stone types configured</p>
            {isAdmin && (
              <button onClick={applyAllSuggested}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                ✨ Suggest All Images
              </button>
            )}
          </div>

          <div className="space-y-3">
            {stoneTypes.map((st) => {
              const imgUrl = stoneImages[st.name] ?? "";
              const hasSuggestion = !!SUGGESTED_IMAGES[st.name];
              return (
                <div key={st.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                      {imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl} alt={st.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl opacity-30">◆</span>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-foreground">{st.name}</span>
                        {!st.active && <span className="text-xs text-muted-foreground/60">(inactive)</span>}
                        {hasSuggestion && !imgUrl && (
                          <button onClick={() => setStoneImages({ ...stoneImages, [st.name]: SUGGESTED_IMAGES[st.name] })}
                            className="text-xs text-primary hover:underline">
                            Use suggested
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={imgUrl}
                          onChange={(e) => setStoneImages({ ...stoneImages, [st.name]: e.target.value })}
                          placeholder={hasSuggestion ? SUGGESTED_IMAGES[st.name].slice(0, 50) + "…" : "Paste image URL…"}
                          className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
                        />
                        {imgUrl && (
                          <button onClick={() => setStoneImages({ ...stoneImages, [st.name]: "" })}
                            className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Tip: Getting free images</p>
            <p>1. Go to <span className="font-mono text-xs bg-gray-100 px-1 rounded">unsplash.com</span> → search the stone name → right-click image → Copy image address</p>
            <p className="mt-1">2. Paste the URL above and append <span className="font-mono text-xs bg-gray-100 px-1 rounded">?auto=format&fit=crop&w=600&q=80</span> for best quality</p>
          </div>
        </div>
      )}

      {/* Save bar — admin only */}
      {isAdmin && (
        <div className="sticky bottom-0 bg-card border-t shadow-lg -mx-6 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Changes are published immediately when saved.</p>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {saving ? "Saving…" : "Save All Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
