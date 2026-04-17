import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, resolveUserId } from "@/lib/api-auth";
import { z } from "zod";

const lineSchema = z.object({
  itemId: z.string().min(1),
  qty: z.number().int().positive(),
  pricePerUnit: z.number().positive(),
  currency: z.string().default("INR"),
});

const schema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  date: z.string(),
  notes: z.string().optional(),
  paymentDays: z.number().int().default(90),
  lines: z.array(lineSchema).min(1),
});

function nextSaleNo() {
  const d = new Date();
  return `SALE-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const sales = await db.directSale.findMany({
    where: status ? { status: status as "COMPLETED" | "PARTIALLY_PAID" | "PAID" } : undefined,
    orderBy: { date: "desc" },
    include: {
      customer: { select: { name: true } },
      lines: { select: { qty: true, pricePerUnit: true } },
      invoices: { select: { amountTotal: true, amountPaid: true, status: true, dueDate: true } },
    },
  });
  return NextResponse.json(sales);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;
  const createdById = await resolveUserId(session!.user.email!);
  if (!createdById) return NextResponse.json({ error: "User not found" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { lines, customerName, customerPhone, paymentDays, ...data } = parsed.data;

  const sale = await db.$transaction(async (tx) => {
    // Find or create customer
    let customer = await tx.customer.findFirst({ where: { name: customerName } });
    if (!customer) {
      customer = await tx.customer.create({
        data: { name: customerName, phoneWhatsapp: customerPhone, contactPhone: customerPhone },
      });
    }

    const saleNo = nextSaleNo();
    const totalAmount = lines.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0);
    const dueDate = new Date(data.date);
    dueDate.setDate(dueDate.getDate() + paymentDays);

    const s = await tx.directSale.create({
      data: {
        saleNo,
        customerId: customer.id,
        date: new Date(data.date),
        status: "COMPLETED",
        notes: data.notes,
        lines: {
          create: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, pricePerUnit: l.pricePerUnit, currency: l.currency })),
        },
        invoices: {
          create: {
            invoiceNo: `INV-${saleNo}`,
            type: "DIRECT_SALE",
            amountTotal: totalAmount,
            currency: "INR",
            paymentDays,
            dueDate,
            status: "PENDING",
          },
        },
      },
    });

    // Deduct stock
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { id: line.itemId },
        data: { qtyPieces: { decrement: line.qty } },
      });
      await tx.stockMovement.create({
        data: {
          itemId: line.itemId,
          movementType: "STOCK_OUT_DIRECT_SALE",
          qtyChange: -line.qty,
          referenceId: s.id,
          referenceType: "DIRECT_SALE",
          createdById,
        },
      });
    }

    return s;
  });

  return NextResponse.json(sale, { status: 201 });
}
