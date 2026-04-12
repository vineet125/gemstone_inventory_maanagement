import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public API — no auth required — used by catalog client components
export async function GET() {
  const rows = await db.siteSettings.findMany();
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  let stoneImages: Record<string, string> = {};
  try { stoneImages = JSON.parse(m.stone_type_images ?? "{}"); } catch { /* use empty */ }

  return NextResponse.json({
    companyName:  m.company_name    ?? "GemStock Gems",
    tagline:      m.company_tagline ?? "Premium Semi-Precious Gemstones",
    about:        m.company_about   ?? "",
    waNumber:     m.whatsapp_number ?? "919999999999",
    heroHeading:  m.hero_heading    ?? "Rare Brilliance, Refined to Perfection",
    heroSubtext:  m.hero_subtext    ?? "Wholesale semi-precious gemstones — Amethyst, Citrine, Garnet & more — precision-cut, quality-graded, and ready for your orders.",
    heroImageUrl: m.hero_image_url  ?? "",
    logoUrl:      m.logo_url        ?? "",
    stoneImages,
  });
}
