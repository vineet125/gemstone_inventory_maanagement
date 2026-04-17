import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const patchSchema = z.object({
  catalogVisible: z.boolean().optional(),
  qtyPieces: z.number().int().min(0).optional(),
  costPricePerPiece: z.number().nonnegative().nullable().optional(),
  sellingPriceEstimated: z.number().nonnegative().nullable().optional(),
  locationCabinet: z.string().nullable().optional(),
  locationTray: z.string().nullable().optional(),
  locationCompartment: z.string().nullable().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  try {
    const item = await db.inventoryItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json(item);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const { id } = await params;
  try {
    await db.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
