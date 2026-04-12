import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";
import { queueWhatsapp, getWaSettings } from "@/lib/whatsapp";

// ─── Meta helpers ──────────────────────────────────────────────────────────────

interface LineMeta {
  unit: "PC" | "WEIGHT" | "BOTH";
  weightUnit: "g" | "ct" | "kg";
  weightIssued: number;
  weightSold: number;
  weightReturned: number;
  notes: string;
}

const META_DEFAULTS: LineMeta = {
  unit: "PC", weightUnit: "g", weightIssued: 0, weightSold: 0, weightReturned: 0, notes: "",
};

function parseMeta(s: string | null | undefined): LineMeta {
  if (!s) return { ...META_DEFAULTS };
  try { return { ...META_DEFAULTS, ...JSON.parse(s) }; }
  catch { return { ...META_DEFAULTS }; }
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const updateSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PARTIALLY_RETURNED", "FULLY_SOLD", "CLOSED"]).optional(),
  notes: z.string().optional(),
  // Mark items sold: supports piece qty, weight, or both
  soldLines: z.array(z.object({
    lineId: z.string(),
    qtySold: z.number().int().min(0).default(0),
    weightSold: z.number().nonnegative().optional(),
    actualPricePerUnit: z.number().positive().optional(),
  })).optional(),
  // Return items: supports piece qty, weight, or both
  returnLines: z.array(z.object({
    lineId: z.string(),
    qtyReturned: z.number().int().min(0).default(0),
    weightReturned: z.number().nonnegative().optional(),
  })).optional(),
  // Update per-line unit/weight settings and notes (no qty tracking)
  updateLineMeta: z.array(z.object({
    lineId: z.string(),
    unit: z.enum(["PC", "WEIGHT", "BOTH"]).optional(),
    weightUnit: z.enum(["g", "ct", "kg"]).optional(),
    weightIssued: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  })).optional(),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  const consignment = await db.consignment.findUnique({
    where: { id: params.id },
    include: {
      broker: true,
      lines: {
        include: {
          item: {
            select: { sku: true, stoneType: { select: { name: true } }, shape: { select: { name: true } }, size: { select: { label: true } }, color: { select: { name: true, hexCode: true } }, grade: { select: { label: true } } }
          },
        },
      },
      invoices: { include: { payments: { orderBy: { paymentDate: "desc" } } } },
    },
  });
  if (!consignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Supplement with meta field (not in generated Prisma client)
  const metas = await db.$queryRaw<Array<{ id: string; meta: string | null }>>`
    SELECT id, meta FROM "ConsignmentLine" WHERE "consignmentId" = ${params.id}
  `;
  const metaMap = new Map(metas.map((m) => [m.id, m.meta]));

  return NextResponse.json({
    ...consignment,
    lines: consignment.lines.map((l) => ({ ...l, meta: metaMap.get(l.id) ?? null })),
  });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { soldLines, returnLines, updateLineMeta, ...data } = parsed.data;

  // Neon serverless recycles connections, making Prisma interactive transactions
  // unreliable (Transaction not found). Use sequential ORM operations instead.

  try {
    // ── Update per-line meta (unit / weight settings / notes) ──────────────
    if (updateLineMeta?.length) {
      for (const um of updateLineMeta) {
        const [metaRow] = await db.$queryRaw<Array<{ meta: string | null }>>`
          SELECT meta FROM "ConsignmentLine" WHERE id = ${um.lineId}
        `;
        const newMeta = {
          ...parseMeta(metaRow?.meta ?? null),
          ...(um.unit !== undefined && { unit: um.unit }),
          ...(um.weightUnit !== undefined && { weightUnit: um.weightUnit }),
          ...(um.weightIssued !== undefined && { weightIssued: um.weightIssued }),
          ...(um.notes !== undefined && { notes: um.notes }),
        };
        await db.$executeRaw`
          UPDATE "ConsignmentLine" SET meta = ${JSON.stringify(newMeta)} WHERE id = ${um.lineId}
        `;
      }
    }

    // ── Process sold lines ─────────────────────────────────────────────────
    if (soldLines?.length) {
      for (const sl of soldLines) {
        const line = await db.consignmentLine.findUnique({ where: { id: sl.lineId } });
        if (!line) throw new Error(`Line ${sl.lineId} not found`);
        const [metaRow] = await db.$queryRaw<Array<{ meta: string | null }>>`
          SELECT meta FROM "ConsignmentLine" WHERE id = ${sl.lineId}
        `;
        const meta = parseMeta(metaRow?.meta ?? null);

        if (meta.unit !== "WEIGHT") {
          if (sl.qtySold < 1) throw new Error("Qty sold must be at least 1");
          const maxCanSell = line.qtyIssued - line.qtySold - line.qtyReturned;
          if (sl.qtySold > maxCanSell) {
            throw new Error(`Cannot mark ${sl.qtySold} as sold — only ${maxCanSell} pieces pending`);
          }
          await db.consignmentLine.update({
            where: { id: sl.lineId },
            data: {
              qtySold: { increment: sl.qtySold },
              ...(sl.actualPricePerUnit && { actualPricePerUnit: sl.actualPricePerUnit }),
            },
          });
        } else {
          if (sl.actualPricePerUnit) {
            await db.consignmentLine.update({
              where: { id: sl.lineId },
              data: { actualPricePerUnit: sl.actualPricePerUnit },
            });
          }
        }

        if (sl.weightSold !== undefined && sl.weightSold > 0) {
          const newMeta = { ...meta, weightSold: meta.weightSold + sl.weightSold };
          await db.$executeRaw`
            UPDATE "ConsignmentLine" SET meta = ${JSON.stringify(newMeta)} WHERE id = ${sl.lineId}
          `;
        }

        await db.stockMovement.create({
          data: {
            itemId: line.itemId,
            movementType: "STOCK_OUT_DIRECT_SALE",
            qtyChange: meta.unit === "WEIGHT" ? 0 : -sl.qtySold,
            referenceId: params.id,
            referenceType: "CONSIGNMENT_SALE",
            createdById: session!.user.id,
          },
        });
      }
    }

    // ── Process returns ────────────────────────────────────────────────────
    if (returnLines?.length) {
      for (const rl of returnLines) {
        const line = await db.consignmentLine.findUnique({ where: { id: rl.lineId } });
        if (!line) throw new Error(`Line ${rl.lineId} not found`);
        const [metaRow] = await db.$queryRaw<Array<{ meta: string | null }>>`
          SELECT meta FROM "ConsignmentLine" WHERE id = ${rl.lineId}
        `;
        const meta = parseMeta(metaRow?.meta ?? null);

        if (meta.unit !== "WEIGHT") {
          if (rl.qtyReturned < 1) throw new Error("Qty returned must be at least 1");
          const maxCanReturn = line.qtyIssued - line.qtySold - line.qtyReturned;
          if (rl.qtyReturned > maxCanReturn) {
            throw new Error(`Cannot return ${rl.qtyReturned} — only ${maxCanReturn} pieces pending`);
          }
          await db.consignmentLine.update({
            where: { id: rl.lineId },
            data: { qtyReturned: { increment: rl.qtyReturned } },
          });
          await db.inventoryItem.update({
            where: { id: line.itemId },
            data: { qtyPieces: { increment: rl.qtyReturned } },
          });
        }

        if (rl.weightReturned !== undefined && rl.weightReturned > 0) {
          const newMeta = { ...meta, weightReturned: meta.weightReturned + rl.weightReturned };
          await db.$executeRaw`
            UPDATE "ConsignmentLine" SET meta = ${JSON.stringify(newMeta)} WHERE id = ${rl.lineId}
          `;
        }

        await db.stockMovement.create({
          data: {
            itemId: line.itemId,
            movementType: "RETURN_FROM_BROKER",
            qtyChange: meta.unit === "WEIGHT" ? 0 : rl.qtyReturned,
            referenceId: params.id,
            referenceType: "CONSIGNMENT",
            createdById: session!.user.id,
          },
        });
      }
    }

    // ── Fetch all lines with meta for status + invoice computation ─────────
    const allLines = await db.$queryRaw<Array<{
      qtyIssued: number; qtySold: number; qtyReturned: number;
      actualPricePerUnit: number | null; estPricePerUnit: number; meta: string | null;
    }>>`
      SELECT "qtyIssued", "qtySold", "qtyReturned", "actualPricePerUnit", "estPricePerUnit", meta
      FROM "ConsignmentLine" WHERE "consignmentId" = ${params.id}
    `;

    // ── Auto-compute status ─────────────────────────────────────────────────
    let newStatus = data.status;
    if (!newStatus && (soldLines?.length || returnLines?.length || updateLineMeta?.length)) {
      const totalIssued  = allLines.reduce((s, l) => s + l.qtyIssued, 0);
      const totalSold    = allLines.reduce((s, l) => s + l.qtySold, 0);
      const totalRet     = allLines.reduce((s, l) => s + l.qtyReturned, 0);
      const piecePending = totalIssued - totalSold - totalRet;

      const weightPending = allLines.reduce((s, l) => {
        const m = parseMeta(l.meta);
        if (m.unit === "WEIGHT" || m.unit === "BOTH") {
          return s + (m.weightIssued - m.weightSold - m.weightReturned);
        }
        return s;
      }, 0);

      const existing = await db.consignment.findUnique({ where: { id: params.id }, select: { status: true } });
      if (existing?.status !== "CLOSED") {
        if (piecePending > 0 || weightPending > 0.001) {
          newStatus = "ACTIVE";
        } else if (totalSold === totalIssued && weightPending <= 0) {
          newStatus = "FULLY_SOLD";
        } else {
          newStatus = "PARTIALLY_RETURNED";
        }
      }
    }

    // ── Auto-create / update invoice when items sold ────────────────────────
    if (soldLines?.length) {
      const totalSoldAmount = allLines.reduce((s, l) => {
        const m = parseMeta(l.meta);
        const price = l.actualPricePerUnit ?? l.estPricePerUnit;
        if (m.unit === "WEIGHT") return s + m.weightSold * price;
        return s + l.qtySold * price;
      }, 0);

      if (totalSoldAmount > 0) {
        const conData = await db.consignment.findUnique({
          where: { id: params.id },
          select: { consignmentNo: true, invoices: { select: { id: true, amountPaid: true } } },
        });
        if (conData) {
          const roundedTotal = Math.round(totalSoldAmount * 100) / 100;
          const existingInv = conData.invoices[0];
          if (!existingInv) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 90);
            await db.invoice.create({
              data: {
                invoiceNo: `INV-${conData.consignmentNo}`,
                type: "CONSIGNMENT",
                consignmentId: params.id,
                amountTotal: roundedTotal,
                currency: "INR",
                paymentDays: 90,
                dueDate,
                status: "PENDING",
              },
            });
          } else {
            const newInvStatus = existingInv.amountPaid >= roundedTotal ? "PAID"
              : existingInv.amountPaid > 0 ? "PARTIAL" : "PENDING";
            await db.invoice.update({
              where: { id: existingInv.id },
              data: { amountTotal: roundedTotal, status: newInvStatus },
            });
          }
        }
      }
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const result = await db.consignment.update({
    where: { id: params.id },
    data: { status: data.status, notes: data.notes },
  });

  // Queue WhatsApp notification for broker on return
  if (returnLines?.length) {
    const wa = await getWaSettings();
    if (wa.brokers) {
      const [con] = await db.$queryRaw<Array<{ consignmentNo: string; brokerId: string }>>`
        SELECT "consignmentNo", "brokerId" FROM "Consignment" WHERE id = ${params.id}
      `;
      if (con) {
        const [brokerRow] = await db.$queryRaw<Array<{ phoneWhatsapp: string | null; notifyWhatsapp: boolean }>>`
          SELECT "phoneWhatsapp", "notifyWhatsapp" FROM "Broker" WHERE id = ${con.brokerId}
        `;
        if (brokerRow?.notifyWhatsapp && brokerRow.phoneWhatsapp) {
          const totalReturned = returnLines.reduce((sum, rl) => sum + rl.qtyReturned, 0);
          const today = new Date().toLocaleDateString("en-IN");
          await queueWhatsapp(
            brokerRow.phoneWhatsapp,
            `Return confirmed for ${con.consignmentNo}: ${totalReturned} pieces received back on ${today}.`,
            params.id,
            "CONSIGNMENT"
          );
        }
      }
    }
  }

  return NextResponse.json(result);
}
