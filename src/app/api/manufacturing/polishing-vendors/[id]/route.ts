import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  contactPhone: z.string().optional(),
  phoneWhatsapp: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  specialization: z.string().optional(),
  active: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendor = await (db.polishingVendor as any).update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(vendor);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER"]);
  if (error) return error;
  await db.polishingVendor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
