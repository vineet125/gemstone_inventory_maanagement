import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";
import { queueWhatsapp, getWaSettings } from "@/lib/whatsapp";

const lineSchema = z.object({
  itemId: z.string().min(1),
  qtyIssued: z.number().int().min(0).default(0),
  weightIssued: z.number().min(0).optional(),
  estPricePerUnit: z.number().positive(),
  priceUnit: z.enum(["per_pc", "per_ct"]).default("per_pc"),
  currency: z.string().default("INR"),
});

const schema = z.object({
  brokerId: z.string().min(1),
  date: z.string(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

function nextConsignmentNo() {
  const d = new Date();
  return `CON-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const brokerId = searchParams.get("brokerId");
  const status = searchParams.get("status");

  const items = await db.consignment.findMany({
    where: {
      ...(brokerId && { brokerId }),
      ...(status && { status: status as "DRAFT" | "ACTIVE" | "PARTIALLY_RETURNED" | "FULLY_SOLD" | "CLOSED" }),
    },
    orderBy: { date: "desc" },
    include: {
      broker: { select: { name: true } },
      lines: { select: { qtyIssued: true, qtySold: true, estPricePerUnit: true } },
      invoices: { select: { amountTotal: true, amountPaid: true, status: true } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Return the first field error as a readable string
    const flat = parsed.error.flatten();
    const firstFieldError = Object.values(flat.fieldErrors).flat()[0];
    const firstLineError = Object.values(
      (flat.fieldErrors as Record<string, unknown>)
    ).flat().find((v) => typeof v === "string");
    const msg = flat.formErrors[0] ?? firstFieldError ?? firstLineError ?? "Invalid request";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }

  const { lines, ...data } = parsed.data;
  const consignmentNo = nextConsignmentNo();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consignment: any;

  try {
    consignment = await db.$transaction(async (tx) => {
      const c = await tx.consignment.create({
        data: {
          consignmentNo,
          brokerId: data.brokerId,
          date: new Date(data.date),
          status: "ACTIVE",
          notes: data.notes,
        },
      });

      // Create each line separately so we can update meta via raw SQL
      for (const l of lines) {
        const created = await (tx.consignmentLine as any).create({
          data: {
            consignmentId: c.id,
            itemId: l.itemId,
            qtyIssued: l.qtyIssued,
            estPricePerUnit: l.estPricePerUnit,
            currency: l.currency,
          },
        });

        // Store weight + priceUnit in meta column via raw SQL
        if (l.weightIssued != null || l.priceUnit !== "per_pc") {
          const metaJson = JSON.stringify({ weightIssued: l.weightIssued, priceUnit: l.priceUnit });
          try {
            await tx.$executeRaw`UPDATE "ConsignmentLine" SET meta = ${metaJson} WHERE id = ${created.id}`;
          } catch { /* meta column not yet migrated — ignored */ }
        }

        // Deduct stock (only if qty > 0)
        if (l.qtyIssued > 0) {
          await tx.inventoryItem.update({
            where: { id: l.itemId },
            data: { qtyPieces: { decrement: l.qtyIssued } },
          });
          await tx.stockMovement.create({
            data: {
              itemId: l.itemId,
              movementType: "STOCK_OUT_CONSIGNMENT",
              qtyChange: -l.qtyIssued,
              referenceId: c.id,
              referenceType: "CONSIGNMENT",
              createdById: session!.user.id,
            },
          });
        }
      }

      return c;
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Queue WhatsApp notification for broker (non-blocking — never fail the response)
  try {
    const wa = await getWaSettings();
    if (wa.brokers) {
      const [brokerRow] = await db.$queryRaw<Array<{ phoneWhatsapp: string | null; notifyWhatsapp: boolean }>>`
        SELECT "phoneWhatsapp", "notifyWhatsapp" FROM "Broker" WHERE id = ${data.brokerId}
      `;
      if (brokerRow?.notifyWhatsapp && brokerRow.phoneWhatsapp) {
        const totalQty = lines.reduce((sum, l) => sum + l.qtyIssued, 0);
        const totalWt = lines.reduce((sum, l) => sum + (l.weightIssued ?? 0), 0);
        const estTotal = lines.reduce((sum, l) => {
          const t = l.priceUnit === "per_ct"
            ? (l.weightIssued ?? 0) * l.estPricePerUnit
            : l.qtyIssued * l.estPricePerUnit;
          return sum + t;
        }, 0);
        const dateStr = new Date(data.date).toLocaleDateString("en-IN");
        const detail = [totalQty > 0 && `${totalQty} pcs`, totalWt > 0 && `${totalWt} ct`].filter(Boolean).join(", ");
        await queueWhatsapp(
          brokerRow.phoneWhatsapp,
          `Consignment ${consignmentNo}: ${detail || "items"} issued to you on ${dateStr}. Est. value: ₹${Math.round(estTotal).toLocaleString("en-IN")}.${data.notes ? `\nNote: ${data.notes}` : ""}`,
          consignment.id,
          "CONSIGNMENT"
        );
      }
    }
  } catch { /* WhatsApp failure must never fail the save */ }

  return NextResponse.json(consignment, { status: 201 });
}
