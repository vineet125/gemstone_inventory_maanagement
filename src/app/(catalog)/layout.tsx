import { db } from "@/lib/db";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CatalogFooter } from "@/components/catalog/CatalogFooter";

async function getSettings() {
  try {
    const rows = await db.siteSettings.findMany({ select: { key: true, value: true } });
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      waNumber: m.whatsapp_number ?? "919999999999",
      companyName: m.company_name ?? "GemStock Gems",
    };
  } catch {
    return { waNumber: "919999999999", companyName: "GemStock Gems" };
  }
}

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const { waNumber, companyName } = await getSettings();
  return (
    <div className="min-h-screen flex flex-col">
      <CatalogHeader waNumber={waNumber} companyName={companyName} />
      <main className="flex-1">{children}</main>
      <CatalogFooter waNumber={waNumber} companyName={companyName} />
    </div>
  );
}
