import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";
import { queueWhatsapp, getWaSettings } from "@/lib/whatsapp";

const schema = z.object({
  stage: z.enum(["ROUGH_COLLECTION", "CUTTING", "SHAPING", "POLISHING", "INVENTORY_IN"]).optional(),
  entryDate: z.string().optional(),
  exitDate: z.string().nullable().optional(),
  weightIn: z.number().positive().optional(),
  weightOut: z.number().nullable().optional(),
  piecesIn: z.number().int().nullable().optional(),
  piecesOut: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  workerIds: z.array(z.string()).optional(),
  // Polishing vendor fields
  vendorId: z.string().nullable().optional(),
  dateSent: z.string().nullable().optional(),
  dateReceived: z.string().nullable().optional(),
  polishingCost: z.number().nullable().optional(),
  polishingCurrency: z.string().optional(),
  qualityNotes: z.string().nullable().optional(),
  // New polishing completion/payment fields
  completionStatus: z.string().optional(),
  defectPieces: z.number().int().optional(),
  defectNotes: z.string().nullable().optional(),
  paidAmount: z.number().optional(),
  paidDate: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "STAFF", "WORKER"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    workerIds, vendorId, dateSent, dateReceived, polishingCost, polishingCurrency, qualityNotes,
    completionStatus, defectPieces, defectNotes, paidAmount, paidDate,
    ...data
  } = parsed.data;

  const updateData: Record<string, unknown> = { ...data };
  if (data.entryDate) updateData.entryDate = new Date(data.entryDate);
  if (data.exitDate) updateData.exitDate = new Date(data.exitDate);
  if (data.exitDate === null) updateData.exitDate = null;

  if (workerIds !== undefined) {
    await db.manufacturingStageWorker.deleteMany({ where: { stageId: id } });
    if (workerIds.length > 0) {
      await db.manufacturingStageWorker.createMany({
        data: workerIds.map((uid) => ({ stageId: id, userId: uid })),
      });
    }
  }

  // Check existing polishing record to detect newly-set dateReceived
  let prevDateReceived: Date | null = null;
  if (dateReceived !== undefined && vendorId && dateSent) {
    const existing = await db.polishingRecord.findUnique({ where: { stageId: id }, select: { dateReceived: true } });
    prevDateReceived = existing?.dateReceived ?? null;
  }

  // Upsert or delete polishing record
  if (vendorId && dateSent) {
    const polishingData = {
      vendorId,
      dateSent: new Date(dateSent),
      dateReceived: dateReceived ? new Date(dateReceived) : null,
      costAmount: polishingCost ?? null,
      currency: polishingCurrency ?? "INR",
      qualityNotes: qualityNotes ?? null,
      ...(completionStatus !== undefined && { completionStatus }),
      ...(defectPieces !== undefined && { defectPieces }),
      ...(defectNotes !== undefined && { defectNotes }),
      ...(paidAmount !== undefined && { paidAmount }),
      ...(paidDate !== undefined && { paidDate: paidDate ? new Date(paidDate) : null }),
    };
    await db.polishingRecord.upsert({
      where: { stageId: id },
      create: { stageId: id, ...polishingData },
      update: polishingData,
    });

    // Queue WA for vendor when dateReceived is newly set
    const newlyReceived = dateReceived && !prevDateReceived;
    if (newlyReceived) {
      const wa = await getWaSettings();
      if (wa.vendors) {
        const vendor = await db.polishingVendor.findUnique({
          where: { id: vendorId },
          select: { contactPhone: true, phoneWhatsapp: true, notifyWhatsapp: true },
        });
        if (vendor?.notifyWhatsapp) {
          const phone = vendor.phoneWhatsapp ?? vendor.contactPhone;
          if (phone) {
            const receivedDateStr = new Date(dateReceived!).toLocaleDateString("en-IN");
            await queueWhatsapp(phone, `Items received: polishing job completed/returned on ${receivedDateStr}.`, id, "STAGE_POLISHING_RECEIVE");
          }
        }
      }
    }
  } else if (vendorId === null) {
    await db.polishingRecord.deleteMany({ where: { stageId: id } });
  }

  // Queue WhatsApp for newly assigned workers
  if (workerIds?.length) {
    const wa = await getWaSettings();
    if (wa.workers) {
      const users = await db.user.findMany({ where: { id: { in: workerIds } }, select: { phone: true } });
      const stageInfo = await db.manufacturingStage.findUnique({
        where: { id },
        select: { stage: true, entryDate: true, batch: { select: { batchNo: true } } },
      });
      if (stageInfo) {
        const entryDateStr = stageInfo.entryDate.toLocaleDateString("en-IN");
        for (const u of users) {
          if (u.phone) {
            await queueWhatsapp(u.phone, `New job assigned: ${stageInfo.stage} on ${entryDateStr} for PO ${stageInfo.batch.batchNo}. Report to office.`, id, "STAGE_ASSIGNMENT");
          }
        }
      }
    }
  }

  try {
    const stage = await db.manufacturingStage.update({
      where: { id },
      data: updateData,
      include: {
        workers: { include: { user: { select: { id: true, name: true } } } },
        polishingRecord: { include: { vendor: { select: { name: true } } } },
      },
    });
    return NextResponse.json(stage);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[PUT /api/manufacturing/stages/[id]]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const { id } = await params;
  await db.manufacturingStageWorker.deleteMany({ where: { stageId: id } });
  await db.polishingRecord.deleteMany({ where: { stageId: id } });
  await db.manufacturingStage.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
