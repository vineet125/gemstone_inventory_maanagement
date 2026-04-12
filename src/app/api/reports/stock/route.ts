import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const stoneTypeId = searchParams.get("stoneTypeId");
  const gradeId     = searchParams.get("gradeId");
  const lowStock    = searchParams.get("lowStock") === "true";

  const where = {
    ...(stoneTypeId ? { stoneTypeId } : {}),
    ...(gradeId     ? { gradeId }     : {}),
    ...(lowStock    ? { qtyPieces: { lte: 10 } } : {}),
  };

  const items = await db.inventoryItem.findMany({
    where,
    orderBy: [{ stoneType: { name: "asc" } }, { grade: { sortOrder: "asc" } }],
    include: {
      stoneType: { select: { name: true } },
      shape:     { select: { name: true } },
      size:      { select: { label: true } },
      color:     { select: { name: true } },
      grade:     { select: { label: true } },
    },
  });

  const rows = items.map((item) => ({
    "SKU":               item.sku,
    "Stone Type":        item.stoneType.name,
    "Shape":             item.shape.name,
    "Size":              item.size.label,
    "Color":             item.color.name,
    "Grade":             item.grade.label,
    "Qty (pieces)":      item.qtyPieces,
    "Cost Price (₹)":    item.costPricePerPiece ?? "",
    "Selling Price (₹)": item.sellingPriceEstimated ?? "",
  }));

  return NextResponse.json(rows);
}
