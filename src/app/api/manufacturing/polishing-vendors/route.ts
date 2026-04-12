import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  contactPhone: z.string().optional(),
  phoneWhatsapp: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  specialization: z.string().optional(),
  notifyWhatsapp: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  const vendors = await db.polishingVendor.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { records: true } } },
  });

  // Fetch new fields via raw SQL (Prisma client not yet regenerated)
  if (vendors.length > 0) {
    const ids = vendors.map((v) => v.id);
    const rows = await db.$queryRaw<Array<{ id: string; phoneWhatsapp: string | null; notifyWhatsapp: boolean }>>`
      SELECT id, "phoneWhatsapp", "notifyWhatsapp" FROM "PolishingVendor" WHERE id = ANY(${ids}::text[])
    `;
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    for (const v of vendors) {
      const r = rowMap.get(v.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v as any).phoneWhatsapp = r?.phoneWhatsapp ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v as any).notifyWhatsapp = r?.notifyWhatsapp ?? true;
    }
  }

  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendor = await (db.polishingVendor as any).create({ data: parsed.data });
  return NextResponse.json(vendor, { status: 201 });
}
