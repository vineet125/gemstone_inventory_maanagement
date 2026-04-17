import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, resolveUserId } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  stoneTypeId: z.string().min(1),
  shapeId: z.string().min(1),
  sizeId: z.string().min(1),
  colorId: z.string().min(1),
  gradeId: z.string().min(1),
  qtyPieces: z.number().int().min(0).default(0),
  weightPerPieceGrams: z.number().positive().optional(),
  weightPerPieceCarats: z.number().positive().optional(),
  costPricePerPiece: z.number().positive().optional(),
  sellingPriceEstimated: z.number().positive().optional(),
  currency: z.string().default("INR"),
  locationCabinet: z.string().optional(),
  locationTray: z.string().optional(),
  locationCompartment: z.string().optional(),
  lowStockThreshold: z.number().int().default(10),
  catalogVisible: z.boolean().default(false),
});

function generateSku(type: string, shape: string, size: string, color: string, grade: string) {
  const abbrev = (s: string, n: number) => s.replace(/\s+/g, "").substring(0, n).toUpperCase();
  return `${abbrev(type, 3)}-${abbrev(shape, 3)}-${size.toUpperCase()}-${abbrev(color, 3)}-${abbrev(grade, 3)}`;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const typeId = searchParams.get("typeId");
  const colorId = searchParams.get("colorId");
  const shapeId = searchParams.get("shapeId");
  const gradeId = searchParams.get("gradeId");
  const lowStock = searchParams.get("lowStock") === "true";
  const search = searchParams.get("search");

  const items = await db.inventoryItem.findMany({
    where: {
      ...(typeId && { stoneTypeId: typeId }),
      ...(colorId && { colorId }),
      ...(shapeId && { shapeId }),
      ...(gradeId && { gradeId }),
      ...(lowStock && { qtyPieces: { gt: 0, lte: 10 } }),
      ...(search && { sku: { contains: search, mode: "insensitive" } }),
    },
    include: {
      stoneType: { select: { name: true } },
      shape: { select: { name: true } },
      size: { select: { label: true } },
      color: { select: { name: true, hexCode: true } },
      grade: { select: { label: true } },
      images: { select: { id: true, url: true, isPrimary: true }, orderBy: { sortOrder: "asc" as const } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;
  const createdById = await resolveUserId(session!.user.email!);
  if (!createdById) return NextResponse.json({ error: "User not found" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Fetch names for SKU generation
  const [type, shape, size, color, grade] = await Promise.all([
    db.stoneType.findUnique({ where: { id: parsed.data.stoneTypeId }, select: { name: true } }),
    db.stoneShape.findUnique({ where: { id: parsed.data.shapeId }, select: { name: true } }),
    db.stoneSize.findUnique({ where: { id: parsed.data.sizeId }, select: { label: true } }),
    db.stoneColor.findUnique({ where: { id: parsed.data.colorId }, select: { name: true } }),
    db.stoneGrade.findUnique({ where: { id: parsed.data.gradeId }, select: { label: true } }),
  ]);

  const sku = generateSku(type!.name, shape!.name, size!.label, color!.name, grade!.label);

  // Check if SKU exists
  const exists = await db.inventoryItem.findUnique({ where: { sku } });
  if (exists) {
    return NextResponse.json({ error: `SKU ${sku} already exists` }, { status: 409 });
  }

  const item = await db.inventoryItem.create({ data: { sku, ...parsed.data } });

  // Create initial stock movement if qty > 0
  if (parsed.data.qtyPieces > 0) {
    await db.stockMovement.create({
      data: {
        itemId: item.id,
        movementType: "STOCK_IN_PURCHASE",
        qtyChange: parsed.data.qtyPieces,
        notes: "Initial stock entry",
        createdById,
      },
    });
  }

  return NextResponse.json(item, { status: 201 });
}
