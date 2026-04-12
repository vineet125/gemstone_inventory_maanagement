import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const recordSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  paymentDate: z.string(),
  mode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"]).default("CASH"),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "ACCOUNTANT"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const overdue = searchParams.get("overdue") === "true";
  const upcoming = searchParams.get("upcoming") === "true";
  const paid = searchParams.get("paid") === "true";

  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const invoices = await db.invoice.findMany({
    where: {
      ...(paid
        ? { status: "PAID" }
        : { status: { not: "PAID" } }),
      ...(overdue && { dueDate: { lt: now } }),
      ...(upcoming && { dueDate: { gte: now, lte: weekFromNow } }),
    },
    orderBy: { dueDate: "asc" },
    include: {
      payments: { orderBy: { paymentDate: "desc" } },
      consignment: { include: { broker: { select: { name: true, phoneWhatsapp: true } } } },
      directSale: { include: { customer: { select: { name: true, phoneWhatsapp: true } } } },
    },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "ACCOUNTANT"]);
  if (error) return error;

  const body = await req.json();
  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payment = await db.$transaction(async (tx) => {
    // Fetch invoice BEFORE creating payment to get existing paid amount
    const invoice = await tx.invoice.findUnique({
      where: { id: parsed.data.invoiceId },
      select: { amountTotal: true, amountPaid: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    const p = await tx.payment.create({
      data: { ...parsed.data, paymentDate: new Date(parsed.data.paymentDate) },
    });

    const newTotalPaid = invoice.amountPaid + parsed.data.amount;
    const newStatus = newTotalPaid >= invoice.amountTotal ? "PAID" : "PARTIAL";

    await tx.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: { amountPaid: newTotalPaid, status: newStatus },
    });

    return p;
  });

  return NextResponse.json(payment, { status: 201 });
}
