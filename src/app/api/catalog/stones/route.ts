import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public API — no auth required
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeId = searchParams.get("typeId");
  const colorId = searchParams.get("colorId");
  const shapeId = searchParams.get("shapeId");
  const gradeId = searchParams.get("gradeId");

  const items = await db.inventoryItem.findMany({
    where: {
      catalogVisible: true,
      qtyPieces: { gt: 0 },
      ...(typeId && { stoneTypeId: typeId }),
      ...(colorId && { colorId }),
      ...(shapeId && { shapeId }),
      ...(gradeId && { gradeId }),
    },
    select: {
      id: true,
      sku: true,
      qtyPieces: true,
      lowStockThreshold: true,
      weightPerPieceCarats: true,
      catalogVisible: true,
      stoneType: { select: { id: true, name: true, descriptionEn: true } },
      shape: { select: { id: true, name: true } },
      size: { select: { id: true, label: true } },
      color: { select: { id: true, name: true, hexCode: true } },
      grade: { select: { id: true, label: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: [{ stoneType: { name: "asc" } }, { grade: { sortOrder: "asc" } }],
  });

  return NextResponse.json(items);
}
