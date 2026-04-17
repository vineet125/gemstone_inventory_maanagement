import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, resolveUserId } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  batchNo: z.string().optional(),
  stoneType: z.string().optional(),
  purchaseType: z.string().optional(),
  supplierName: z.string().min(1).max(200),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  weightGrams: z.number().positive(),
  weightCarats: z.number().positive(),
  costAmount: z.number().nonnegative().optional(),   // optional — STAFF may omit
  currency: z.string().default("INR"),
  notes: z.string().optional(),
});

function nextPoNo() {
  const d = new Date();
  return `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const batches = await db.roughBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        stages: {
          select: { stage: true, exitDate: true, weightIn: true },
          orderBy: { entryDate: "asc" },
        },
        _count: { select: { stages: true } },
      },
    });

    return NextResponse.json(batches);
  } catch (e: unknown) {
    console.error("[GET /api/manufacturing/batches]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Auto-generate PO number if not provided
  const batchNo = parsed.data.batchNo || nextPoNo();

  // Check unique batch number
  const exists = await db.roughBatch.findUnique({ where: { batchNo } });
  if (exists) return NextResponse.json({ error: "Batch number already exists" }, { status: 409 });

  const { stoneType, purchaseType, batchNo: _bn, ...batchData } = parsed.data;
  const pt = purchaseType || "ROUGH_COLLECTION";

  const createdById = await resolveUserId(session!.user.email!);
  if (!createdById) return NextResponse.json({ error: "User not found" }, { status: 401 });

  try {
    const batch = await db.roughBatch.create({
      data: {
        ...batchData,
        batchNo,
        stoneType: stoneType ?? null,
        purchaseType: pt,
        costAmount: batchData.costAmount ?? 0,
        purchaseDate: new Date(batchData.purchaseDate),
        createdById,
      },
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (e: unknown) {
    console.error("[POST /api/manufacturing/batches]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
