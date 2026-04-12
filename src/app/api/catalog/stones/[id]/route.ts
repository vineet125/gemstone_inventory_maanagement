import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public API — no auth required
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const item = await db.inventoryItem.findUnique({
    where: { id: params.id, catalogVisible: true },
    select: {
      id: true,
      sku: true,
      qtyPieces: true,
      lowStockThreshold: true,
      weightPerPieceGrams: true,
      weightPerPieceCarats: true,
      stoneType: { select: { id: true, name: true, descriptionEn: true } },
      shape: { select: { name: true } },
      size: { select: { label: true } },
      color: { select: { name: true, hexCode: true } },
      grade: { select: { label: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, isPrimary: true } },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}
