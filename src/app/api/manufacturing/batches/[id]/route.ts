import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  batchNo: z.string().min(1).optional(),
  stoneType: z.string().nullable().optional(),
  purchaseType: z.string().nullable().optional(),
  supplierName: z.string().min(1).optional(),
  purchaseDate: z.string().optional(),
  weightGrams: z.number().positive().optional(),
  weightCarats: z.number().positive().optional(),
  costAmount: z.number().positive().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  const batch = await db.roughBatch.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      purchaseOrder: true,
      stages: {
        orderBy: { entryDate: "asc" },
        include: {
          workers: { include: { user: { select: { id: true, name: true } } } },
          polishingRecord: { include: { vendor: { select: { name: true } } } },
        },
      },
    },
  });

  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prisma client not yet regenerated — fetch stoneType and purchaseType via raw SQL
  const [row] = await db.$queryRaw<Array<{ stoneType: string | null; purchaseType: string | null }>>`
    SELECT "stoneType", "purchaseType" FROM "RoughBatch" WHERE id = ${params.id}
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (batch as any).stoneType = row?.stoneType ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (batch as any).purchaseType = row?.purchaseType ?? "ROUGH_COLLECTION";

  // Fetch new PolishingRecord fields (not yet in generated Prisma client)
  const stageIds = batch.stages.filter((s) => s.polishingRecord).map((s) => s.id);
  if (stageIds.length > 0) {
    const polishRows = await db.$queryRaw<Array<{
      stageId: string;
      completionStatus: string;
      defectPieces: number;
      defectNotes: string | null;
      paidAmount: number;
      paidDate: Date | null;
    }>>`
      SELECT "stageId", "completionStatus", "defectPieces", "defectNotes", "paidAmount", "paidDate"
      FROM "PolishingRecord"
      WHERE "stageId" = ANY(${stageIds}::text[])
    `;
    const polishMap = new Map(polishRows.map((r) => [r.stageId, r]));
    for (const stage of batch.stages) {
      if (stage.polishingRecord) {
        const extra = polishMap.get(stage.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pr = stage.polishingRecord as any;
        pr.completionStatus = extra?.completionStatus ?? "PENDING";
        pr.defectPieces = extra?.defectPieces ?? 0;
        pr.defectNotes = extra?.defectNotes ?? null;
        pr.paidAmount = extra?.paidAmount ?? 0;
        pr.paidDate = extra?.paidDate ?? null;
      }
    }
  }

  return NextResponse.json(batch);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { stoneType, purchaseType, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (rest.purchaseDate) data.purchaseDate = new Date(rest.purchaseDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batch = await (db.roughBatch as any).update({ where: { id: params.id }, data });

  // Update stoneType and purchaseType via raw SQL (Prisma client may not yet be regenerated)
  if (stoneType !== undefined || purchaseType !== undefined) {
    if (stoneType !== undefined && purchaseType !== undefined) {
      await db.$executeRaw`UPDATE "RoughBatch" SET "stoneType" = ${stoneType}, "purchaseType" = ${purchaseType} WHERE id = ${params.id}`;
    } else if (stoneType !== undefined) {
      await db.$executeRaw`UPDATE "RoughBatch" SET "stoneType" = ${stoneType} WHERE id = ${params.id}`;
    } else {
      await db.$executeRaw`UPDATE "RoughBatch" SET "purchaseType" = ${purchaseType} WHERE id = ${params.id}`;
    }
    batch.stoneType = stoneType ?? undefined;
    batch.purchaseType = purchaseType ?? undefined;
  }

  return NextResponse.json(batch);
}
