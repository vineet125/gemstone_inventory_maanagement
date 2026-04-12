import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["OWNER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateFilter = (from || to) ? {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  } : undefined;

  const [invoices, batches, settlements] = await Promise.all([
    db.invoice.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: { amountTotal: true, amountPaid: true, type: true, createdAt: true, status: true },
    }),
    db.roughBatch.findMany({
      where: dateFilter ? { purchaseDate: dateFilter } : undefined,
      select: { costAmount: true, purchaseDate: true, stoneType: true, weightGrams: true },
    }),
    db.workerSettlement.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: { paidAmount: true, totalAmount: true, createdAt: true },
    }),
  ]);

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalBilled        = invoices.reduce((s, i) => s + i.amountTotal, 0);
  const totalCollected     = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding   = totalBilled - totalCollected;
  const consignmentRevenue = invoices.filter((i) => i.type === "CONSIGNMENT").reduce((s, i) => s + i.amountPaid, 0);
  const directRevenue      = invoices.filter((i) => i.type === "DIRECT_SALE").reduce((s, i) => s + i.amountPaid, 0);
  const materialCost       = batches.reduce((s, b) => s + b.costAmount, 0);
  const wageCost           = settlements.reduce((s, w) => s + w.paidAmount, 0);
  const totalCost          = materialCost + wageCost;
  const grossProfit        = totalCollected - materialCost;
  const netProfit          = totalCollected - totalCost;

  // ── Monthly breakdown ────────────────────────────────────────────────────
  type MonthEntry = { revenue: number; billed: number; materialCost: number; wages: number };
  const byMonth: Record<string, MonthEntry> = {};

  const getMonth = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM
  const ensureMonth = (m: string) => {
    if (!byMonth[m]) byMonth[m] = { revenue: 0, billed: 0, materialCost: 0, wages: 0 };
  };

  for (const inv of invoices) {
    const m = getMonth(inv.createdAt);
    ensureMonth(m);
    byMonth[m].revenue += inv.amountPaid;
    byMonth[m].billed  += inv.amountTotal;
  }
  for (const b of batches) {
    const m = getMonth(b.purchaseDate);
    ensureMonth(m);
    byMonth[m].materialCost += b.costAmount;
  }
  for (const w of settlements) {
    const m = getMonth(w.createdAt);
    ensureMonth(m);
    byMonth[m].wages += w.paidAmount;
  }

  const rows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      "Month":               month,
      "Revenue Collected (₹)": Math.round(d.revenue),
      "Total Billed (₹)":    Math.round(d.billed),
      "Material Cost (₹)":   Math.round(d.materialCost),
      "Wages Paid (₹)":      Math.round(d.wages),
      "Gross Profit (₹)":    Math.round(d.revenue - d.materialCost),
      "Net Profit (₹)":      Math.round(d.revenue - d.materialCost - d.wages),
    }));

  return NextResponse.json({
    summary: {
      totalBilled:        Math.round(totalBilled),
      totalCollected:     Math.round(totalCollected),
      totalOutstanding:   Math.round(totalOutstanding),
      consignmentRevenue: Math.round(consignmentRevenue),
      directRevenue:      Math.round(directRevenue),
      materialCost:       Math.round(materialCost),
      wageCost:           Math.round(wageCost),
      totalCost:          Math.round(totalCost),
      grossProfit:        Math.round(grossProfit),
      netProfit:          Math.round(netProfit),
    },
    rows,
  });
}
