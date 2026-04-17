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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const batch = await db.roughBatch.findUnique({
      where: { id },
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
    return NextResponse.json(batch);
  } catch (e: unknown) {
    console.error("[GET /api/manufacturing/batches/[id]]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { purchaseDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (purchaseDate) data.purchaseDate = new Date(purchaseDate);

  try {
    const batch = await db.roughBatch.update({ where: { id }, data });
    return NextResponse.json(batch);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[PUT /api/manufacturing/batches/[id]]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
