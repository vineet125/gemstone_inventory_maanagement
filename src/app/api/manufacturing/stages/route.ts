import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";
import { queueWhatsapp, getWaSettings } from "@/lib/whatsapp";

const schema = z.object({
  batchId: z.string().min(1),
  stage: z.enum(["ROUGH_COLLECTION", "CUTTING", "SHAPING", "POLISHING", "INVENTORY_IN"]),
  entryDate: z.string(),
  exitDate: z.string().nullable().optional(),
  weightIn: z.number().positive(),
  weightOut: z.number().nullable().optional(),
  piecesIn: z.number().int().nullable().optional(),
  piecesOut: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  workerIds: z.array(z.string()).optional(),
  // Polishing vendor fields (only meaningful when stage=POLISHING)
  vendorId: z.string().optional(),
  dateSent: z.string().optional(),
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

export async function POST(req: NextRequest) {
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

  const stage = await db.manufacturingStage.create({
    data: {
      ...data,
      entryDate: new Date(data.entryDate),
      exitDate: data.exitDate ? new Date(data.exitDate) : undefined,
      workers: workerIds?.length
        ? { create: workerIds.map((uid) => ({ userId: uid })) }
        : undefined,
    },
    include: {
      workers: { include: { user: { select: { name: true } } } },
      polishingRecord: { include: { vendor: { select: { name: true } } } },
    },
  });

  // Create polishing record if vendor provided
  if (vendorId && dateSent) {
    await db.polishingRecord.create({
      data: {
        stageId: stage.id,
        vendorId,
        dateSent: new Date(dateSent),
        dateReceived: dateReceived ? new Date(dateReceived) : null,
        costAmount: polishingCost ?? null,
        currency: polishingCurrency ?? "INR",
        qualityNotes: qualityNotes ?? null,
      },
    });

    // Set new fields via raw SQL (Prisma client not yet regenerated)
    const cs = completionStatus ?? "PENDING";
    const dp = defectPieces ?? 0;
    const pa = paidAmount ?? 0;
    const dn = defectNotes ?? null;
    const pd = paidDate ? new Date(paidDate) : null;
    await db.$executeRaw`
      UPDATE "PolishingRecord"
      SET "completionStatus" = ${cs},
          "defectPieces" = ${dp},
          "defectNotes" = ${dn},
          "paidAmount" = ${pa},
          "paidDate" = ${pd}
      WHERE "stageId" = ${stage.id}
    `;

    // Queue WhatsApp for vendor
    const wa = await getWaSettings();
    if (wa.vendors) {
      const [vendorRow] = await db.$queryRaw<Array<{ contactPhone: string | null; phoneWhatsapp: string | null; notifyWhatsapp: boolean }>>`
        SELECT "contactPhone", "phoneWhatsapp", "notifyWhatsapp" FROM "PolishingVendor" WHERE id = ${vendorId}
      `;
      if (vendorRow?.notifyWhatsapp) {
        const phone = vendorRow.phoneWhatsapp ?? vendorRow.contactPhone;
        if (phone) {
          const [batchRow] = await db.$queryRaw<Array<{ batchNo: string }>>`
            SELECT "batchNo" FROM "RoughBatch" WHERE id = ${data.batchId}
          `;
          const dateStr = new Date(dateSent).toLocaleDateString("en-IN");
          await queueWhatsapp(
            phone,
            `Polishing job received: ${data.weightIn}g from PO ${batchRow?.batchNo ?? data.batchId} sent on ${dateStr}.`,
            stage.id,
            "STAGE_POLISHING_SEND"
          );
        }
      }
    }
  }

  // Queue WhatsApp for assigned workers
  if (workerIds?.length) {
    const wa = await getWaSettings();
    if (wa.workers) {
      const users = await db.user.findMany({
        where: { id: { in: workerIds } },
        select: { phone: true },
      });
      const [batchRow] = await db.$queryRaw<Array<{ batchNo: string }>>`
        SELECT "batchNo" FROM "RoughBatch" WHERE id = ${data.batchId}
      `;
      const entryDateStr = new Date(data.entryDate).toLocaleDateString("en-IN");
      for (const u of users) {
        if (u.phone) {
          await queueWhatsapp(
            u.phone,
            `New job assigned: ${data.stage} on ${entryDateStr} for PO ${batchRow?.batchNo ?? data.batchId}. Report to office.`,
            stage.id,
            "STAGE_ASSIGNMENT"
          );
        }
      }
    }
  }

  return NextResponse.json(stage, { status: 201 });
}
