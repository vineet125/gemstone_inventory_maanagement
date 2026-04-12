import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  qtyPieces: z.number().int().min(0).optional(),
  weightPerPieceGrams: z.number().positive().optional(),
  weightPerPieceCarats: z.number().positive().optional(),
  costPricePerPiece: z.number().positive().optional(),
  sellingPriceEstimated: z.number().positive().optional(),
  locationCabinet: z.string().optional(),
  locationTray: z.string().optional(),
  locationCompartment: z.string().optional(),
  lowStockThreshold: z.number().int().optional(),
  catalogVisible: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  const item = await db.inventoryItem.findUnique({
    where: { id: params.id },
    include: {
      stoneType: true,
      shape: true,
      size: true,
      color: true,
      grade: true,
      images: { orderBy: { sortOrder: "asc" } },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await db.inventoryItem.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER"]);
  if (error) return error;
  await db.inventoryItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
