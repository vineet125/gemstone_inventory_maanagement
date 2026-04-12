import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const brokerId = searchParams.get("brokerId");

  const dateFilter = (from || to) ? {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  } : undefined;

  const brokers = await db.broker.findMany({
    where: {
      active: true,
      ...(brokerId ? { id: brokerId } : {}),
    },
    include: {
      consignments: {
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          lines: {
            select: {
              qtyIssued: true, qtySold: true, qtyReturned: true,
              estPricePerUnit: true, actualPricePerUnit: true,
            },
          },
          invoices: {
            include: {
              payments: { select: { amount: true, paymentDate: true, mode: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = brokers.map((b) => {
    const allLines    = b.consignments.flatMap((c) => c.lines);
    const allInvoices = b.consignments.flatMap((c) => c.invoices);
    const allPayments = allInvoices.flatMap((i) => i.payments);

    const qtyIssued   = allLines.reduce((s, l) => s + l.qtyIssued, 0);
    const qtySold     = allLines.reduce((s, l) => s + l.qtySold, 0);
    const qtyReturned = allLines.reduce((s, l) => s + l.qtyReturned, 0);
    const qtyPending  = qtyIssued - qtySold - qtyReturned;

    const issuedValue = allLines.reduce((s, l) => s + l.qtyIssued * l.estPricePerUnit, 0);
    const soldValue   = allLines.reduce((s, l) => s + l.qtySold * (l.actualPricePerUnit ?? l.estPricePerUnit), 0);
    const billed      = allInvoices.reduce((s, i) => s + i.amountTotal, 0);
    const collected   = allInvoices.reduce((s, i) => s + i.amountPaid, 0);

    const lastPayment = allPayments
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0];

    return {
      "Broker":          b.name,
      "City":            b.city ?? "",
      "Phone":           b.contactPhone ?? "",
      "Consignments":    b.consignments.length,
      "Qty Issued":      qtyIssued,
      "Qty Sold":        qtySold,
      "Qty Returned":    qtyReturned,
      "Qty Pending":     qtyPending,
      "Issued Value (₹)": Math.round(issuedValue),
      "Sold Value (₹)":  Math.round(soldValue),
      "Billed (₹)":      Math.round(billed),
      "Collected (₹)":   Math.round(collected),
      "Outstanding (₹)": Math.round(billed - collected),
      "Last Payment":    lastPayment
        ? `${lastPayment.paymentDate.toISOString().split("T")[0]} — ₹${lastPayment.amount} (${lastPayment.mode})`
        : "—",
    };
  });

  return NextResponse.json(rows);
}
