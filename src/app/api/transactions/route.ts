import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth(["OWNER", "MANAGER", "ACCOUNTANT", "STAFF"]);
  if (error) return error;

  const [batches, consignments, directSales] = await Promise.all([
    db.roughBatch.findMany({
      orderBy: { purchaseDate: "desc" },
      include: { purchaseOrder: { select: { status: true, totalAmount: true } } },
    }),
    db.consignment.findMany({
      orderBy: { date: "desc" },
      include: {
        broker: { select: { name: true } },
        lines: { select: { qtyIssued: true, estPricePerUnit: true, meta: true } },
        invoices: { select: { amountTotal: true, amountPaid: true, status: true } },
      },
    }),
    db.directSale.findMany({
      orderBy: { date: "desc" },
      include: {
        customer: { select: { name: true } },
        lines: { select: { qty: true, pricePerUnit: true } },
        invoices: { select: { amountTotal: true, amountPaid: true, status: true } },
      },
    }),
  ]);

  const purchases = batches.map((b) => ({
    id: b.id,
    type: "PURCHASE" as const,
    refNo: b.batchNo,
    date: b.purchaseDate.toISOString(),
    party: b.supplierName,
    stoneType: b.stoneType ?? "—",
    linesCount: 1,
    amount: b.purchaseOrder?.totalAmount ?? b.costAmount,
    amountPaid: b.purchaseOrder?.status === "PAID" ? (b.purchaseOrder?.totalAmount ?? b.costAmount) : 0,
    status: b.purchaseOrder?.status ?? "NO_PO",
    currency: b.currency,
    href: `/manufacturing/batches/${b.id}`,
  }));

  const consignmentTx = consignments.map((c) => {
    const amount = c.invoices[0]?.amountTotal
      ?? c.lines.reduce((s, l) => {
        try {
          const m = l.meta ? JSON.parse(l.meta) : null;
          if (m && (m.unit === "WEIGHT" || (!m.unit && m.priceUnit === "per_ct"))) {
            return s + (Number(m.weightIssued) || 0) * l.estPricePerUnit;
          }
        } catch { /* ignore */ }
        return s + l.qtyIssued * l.estPricePerUnit;
      }, 0);
    return {
      id: c.id,
      type: "CONSIGNMENT" as const,
      refNo: c.consignmentNo,
      date: c.date.toISOString(),
      party: c.broker.name,
      stoneType: "—",
      linesCount: c.lines.length,
      amount,
      amountPaid: c.invoices[0]?.amountPaid ?? 0,
      status: c.status,
      currency: "INR",
      href: `/sales/consignments/${c.id}`,
    };
  });

  const directSaleTx = directSales.map((s) => {
    const amount = s.invoices[0]?.amountTotal
      ?? s.lines.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0);
    return {
      id: s.id,
      type: "DIRECT_SALE" as const,
      refNo: s.saleNo,
      date: s.date.toISOString(),
      party: s.customer.name,
      stoneType: "—",
      linesCount: s.lines.length,
      amount,
      amountPaid: s.invoices[0]?.amountPaid ?? 0,
      status: s.status,
      currency: "INR",
      href: `/sales/direct?id=${s.id}`,
    };
  });

  const all = [...purchases, ...consignmentTx, ...directSaleTx].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json(all);
}
