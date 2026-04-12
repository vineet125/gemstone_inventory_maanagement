import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "ACCOUNTANT"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");
  const status = searchParams.get("status");

  const dateFilter = (from || to) ? {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  } : undefined;

  const invoices = await db.invoice.findMany({
    where: {
      ...(dateFilter ? { dueDate: dateFilter } : {}),
      ...(status ? { status: status as "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" } : {}),
    },
    include: {
      consignment: { select: { consignmentNo: true, broker: { select: { name: true } } } },
      directSale:  { select: { saleNo: true, customer: { select: { name: true } } } },
      payments:    { select: { amount: true, paymentDate: true, mode: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = invoices.map((inv) => {
    const party = inv.consignment?.broker.name ?? inv.directSale?.customer.name ?? "—";
    const ref   = inv.consignment?.consignmentNo ?? inv.directSale?.saleNo ?? "—";
    const paymentHistory = inv.payments
      .map((p) => `${p.paymentDate.toISOString().split("T")[0]}: ₹${p.amount} (${p.mode})`)
      .join("; ");

    return {
      "Invoice No":      inv.invoiceNo,
      "Type":            inv.type,
      "Ref No":          ref,
      "Party":           party,
      "Total (₹)":      inv.amountTotal,
      "Paid (₹)":       inv.amountPaid,
      "Outstanding (₹)": Math.round(inv.amountTotal - inv.amountPaid),
      "Due Date":        inv.dueDate.toISOString().split("T")[0],
      "Status":          inv.status,
      "Payment History": paymentHistory || "—",
    };
  });

  return NextResponse.json(rows);
}
