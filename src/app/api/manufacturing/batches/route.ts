import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  batchNo: z.string().optional(),
  stoneType: z.string().optional(),
  purchaseType: z.string().optional(),
  supplierName: z.string().min(1),
  purchaseDate: z.string(),
  weightGrams: z.number().positive(),
  weightCarats: z.number().positive(),
  costAmount: z.number().positive(),
  currency: z.string().default("INR"),
  notes: z.string().optional(),
});

function nextPoNo() {
  const d = new Date();
  return `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

export async function GET() {
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

  // Prisma client not yet regenerated — fetch stoneType and purchaseType via raw SQL
  if (batches.length > 0) {
    const ids = batches.map((b) => b.id);
    const rows = await db.$queryRaw<Array<{ id: string; stoneType: string | null; purchaseType: string | null }>>`
      SELECT id, "stoneType", "purchaseType" FROM "RoughBatch" WHERE id = ANY(${ids}::text[])
    `;
    const typeMap = new Map(rows.map((r) => [r.id, r]));
    for (const batch of batches) {
      const r = typeMap.get(batch.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batch as any).stoneType = r?.stoneType ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batch as any).purchaseType = r?.purchaseType ?? "ROUGH_COLLECTION";
    }
  }

  return NextResponse.json(batches);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batch = await (db.roughBatch as any).create({
    data: {
      ...batchData,
      batchNo,
      purchaseDate: new Date(batchData.purchaseDate),
      createdById: session!.user.id,
    },
  });

  // Set stoneType and purchaseType via raw SQL (Prisma client may not yet be regenerated)
  const pt = purchaseType || "ROUGH_COLLECTION";
  await db.$executeRaw`UPDATE "RoughBatch" SET "stoneType" = ${stoneType ?? null}, "purchaseType" = ${pt} WHERE id = ${batch.id}`;
  batch.stoneType = stoneType ?? null;
  batch.purchaseType = pt;

  return NextResponse.json(batch, { status: 201 });
}
