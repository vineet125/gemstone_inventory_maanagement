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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "STAFF", "WORKER"]);
  if (error) return error;

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
    await db.manufacturingStageWorker.deleteMany({ where: { stageId: params.id } });
    if (workerIds.length > 0) {
      await db.manufacturingStageWorker.createMany({
        data: workerIds.map((uid) => ({ stageId: params.id, userId: uid })),
      });
    }
  }

  // Check existing polishing record to detect newly-set dateReceived
  let prevDateReceived: Date | null = null;
  if (dateReceived !== undefined && vendorId && dateSent) {
    const [existing] = await db.$queryRaw<Array<{ dateReceived: Date | null }>>`
      SELECT "dateReceived" FROM "PolishingRecord" WHERE "stageId" = ${params.id}
    `;
    prevDateReceived = existing?.dateReceived ?? null;
  }

  // Upsert or delete polishing record
  if (vendorId && dateSent) {
    await db.polishingRecord.upsert({
      where: { stageId: params.id },
      create: {
        stageId: params.id,
        vendorId,
        dateSent: new Date(dateSent),
        dateReceived: dateReceived ? new Date(dateReceived) : null,
        costAmount: polishingCost ?? null,
        currency: polishingCurrency ?? "INR",
        qualityNotes: qualityNotes ?? null,
      },
      update: {
        vendorId,
        dateSent: new Date(dateSent),
        dateReceived: dateReceived ? new Date(dateReceived) : null,
        costAmount: polishingCost ?? null,
        currency: polishingCurrency ?? "INR",
        qualityNotes: qualityNotes ?? null,
      },
    });

    // Update new fields via raw SQL
    const fieldsToUpdate: string[] = [];
    const updateValues: Record<string, unknown> = {};
    if (completionStatus !== undefined) { fieldsToUpdate.push("completionStatus"); updateValues.completionStatus = completionStatus; }
    if (defectPieces !== undefined) { fieldsToUpdate.push("defectPieces"); updateValues.defectPieces = defectPieces; }
    if (defectNotes !== undefined) { fieldsToUpdate.push("defectNotes"); updateValues.defectNotes = defectNotes; }
    if (paidAmount !== undefined) { fieldsToUpdate.push("paidAmount"); updateValues.paidAmount = paidAmount; }
    if (paidDate !== undefined) { fieldsToUpdate.push("paidDate"); updateValues.paidDate = paidDate ? new Date(paidDate) : null; }

    if (fieldsToUpdate.includes("completionStatus") || fieldsToUpdate.includes("defectPieces") ||
        fieldsToUpdate.includes("defectNotes") || fieldsToUpdate.includes("paidAmount") || fieldsToUpdate.includes("paidDate")) {
      const cs = updateValues.completionStatus as string | undefined;
      const dp = updateValues.defectPieces as number | undefined;
      const dn = updateValues.defectNotes as string | null | undefined;
      const pa = updateValues.paidAmount as number | undefined;
      const pd = updateValues.paidDate as Date | null | undefined;

      // Build dynamic update using individual conditional updates
      if (cs !== undefined) await db.$executeRaw`UPDATE "PolishingRecord" SET "completionStatus" = ${cs} WHERE "stageId" = ${params.id}`;
      if (dp !== undefined) await db.$executeRaw`UPDATE "PolishingRecord" SET "defectPieces" = ${dp} WHERE "stageId" = ${params.id}`;
      if (dn !== undefined) await db.$executeRaw`UPDATE "PolishingRecord" SET "defectNotes" = ${dn} WHERE "stageId" = ${params.id}`;
      if (pa !== undefined) await db.$executeRaw`UPDATE "PolishingRecord" SET "paidAmount" = ${pa} WHERE "stageId" = ${params.id}`;
      if (pd !== undefined) await db.$executeRaw`UPDATE "PolishingRecord" SET "paidDate" = ${pd} WHERE "stageId" = ${params.id}`;
    }

    // Queue WA for vendor when dateReceived is newly set
    const newlyReceived = dateReceived && !prevDateReceived;
    if (newlyReceived) {
      const wa = await getWaSettings();
      if (wa.vendors) {
        const [vendorRow] = await db.$queryRaw<Array<{ contactPhone: string | null; phoneWhatsapp: string | null; notifyWhatsapp: boolean }>>`
          SELECT "contactPhone", "phoneWhatsapp", "notifyWhatsapp" FROM "PolishingVendor" WHERE id = ${vendorId}
        `;
        if (vendorRow?.notifyWhatsapp) {
          const phone = vendorRow.phoneWhatsapp ?? vendorRow.contactPhone;
          if (phone) {
            const receivedDateStr = new Date(dateReceived!).toLocaleDateString("en-IN");
            await queueWhatsapp(
              phone,
              `Items received: polishing job completed/returned on ${receivedDateStr}.`,
              params.id,
              "STAGE_POLISHING_RECEIVE"
            );
          }
        }
      }
    }
  } else if (vendorId === null) {
    await db.polishingRecord.deleteMany({ where: { stageId: params.id } });
  }

  // Queue WhatsApp for newly assigned workers
  if (workerIds?.length) {
    const wa = await getWaSettings();
    if (wa.workers) {
      const users = await db.user.findMany({
        where: { id: { in: workerIds } },
        select: { phone: true },
      });
      const stageInfo = await db.manufacturingStage.findUnique({
        where: { id: params.id },
        select: { stage: true, entryDate: true, batchId: true },
      });
      if (stageInfo) {
        const [batchRow] = await db.$queryRaw<Array<{ batchNo: string }>>`
          SELECT "batchNo" FROM "RoughBatch" WHERE id = ${stageInfo.batchId}
        `;
        const entryDateStr = stageInfo.entryDate.toLocaleDateString("en-IN");
        for (const u of users) {
          if (u.phone) {
            await queueWhatsapp(
              u.phone,
              `New job assigned: ${stageInfo.stage} on ${entryDateStr} for PO ${batchRow?.batchNo ?? stageInfo.batchId}. Report to office.`,
              params.id,
              "STAGE_ASSIGNMENT"
            );
          }
        }
      }
    }
  }

  const stage = await db.manufacturingStage.update({
    where: { id: params.id },
    data: updateData,
    include: {
      workers: { include: { user: { select: { id: true, name: true } } } },
      polishingRecord: { include: { vendor: { select: { name: true } } } },
    },
  });
  return NextResponse.json(stage);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  // Delete dependent records first
  await db.manufacturingStageWorker.deleteMany({ where: { stageId: params.id } });
  await db.polishingRecord.deleteMany({ where: { stageId: params.id } });
  await db.manufacturingStage.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
