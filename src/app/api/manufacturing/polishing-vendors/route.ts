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

  try {
    const vendors = await db.polishingVendor.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { records: true } } },
    });
    return NextResponse.json(vendors);
  } catch (e: unknown) {
    console.error("[GET /api/manufacturing/polishing-vendors]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const vendor = await db.polishingVendor.create({ data: parsed.data });
  return NextResponse.json(vendor, { status: 201 });
}
