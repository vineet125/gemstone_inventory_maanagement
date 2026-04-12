import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  // ── INVENTORY ─────────────────────────────────────────────────────────────
  const allItems = await db.inventoryItem.findMany({
    select: {
      id: true,
      sku: true,
      qtyPieces: true,
      lowStockThreshold: true,
      weightPerPieceCarats: true,
      sellingPriceEstimated: true,
      stoneType: { select: { name: true } },
    },
  });

  const totalPieces = allItems.reduce((s, i) => s + i.qtyPieces, 0);
  const totalCarats = allItems.reduce(
    (s, i) => s + i.qtyPieces * (i.weightPerPieceCarats ?? 0),
    0
  );
  const stockValue = allItems.reduce(
    (s, i) => s + i.qtyPieces * (i.sellingPriceEstimated ?? 0),
    0
  );
  const lowStockItems = allItems
    .filter((i) => i.qtyPieces > 0 && i.qtyPieces <= i.lowStockThreshold)
    .slice(0, 8);
  const outOfStockCount = allItems.filter((i) => i.qtyPieces === 0).length;

  const stoneMap: Record<string, { name: string; pieces: number; skus: number }> = {};
  for (const item of allItems) {
    const n = item.stoneType.name;
    if (!stoneMap[n]) stoneMap[n] = { name: n, pieces: 0, skus: 0 };
    stoneMap[n].pieces += item.qtyPieces;
    stoneMap[n].skus += 1;
  }
  const byStoneType = Object.values(stoneMap).sort((a, b) => b.pieces - a.pieces);

  // ── WORKERS ───────────────────────────────────────────────────────────────
  const [activeWorkerCount, presentTodayCount, weekPieceWork, monthPieceWork] =
    await Promise.all([
      db.worker.count({ where: { active: true } }),
      db.workerAttendance.count({
        where: { date: today, status: { in: ["PRESENT", "HALF_DAY"] } },
      }),
      db.workerPieceWork.findMany({
        where: { date: { gte: weekStart } },
        select: { piecesCompleted: true },
      }),
      db.workerPieceWork.findMany({
        where: { date: { gte: monthStart } },
        select: {
          workerId: true,
          piecesCompleted: true,
          ratePerPiece: true,
          worker: { select: { name: true } },
        },
      }),
    ]);

  const workerMap: Record<string, { name: string; pieces: number; earnings: number }> = {};
  for (const pw of monthPieceWork) {
    if (!workerMap[pw.workerId])
      workerMap[pw.workerId] = { name: pw.worker.name, pieces: 0, earnings: 0 };
    workerMap[pw.workerId].pieces += pw.piecesCompleted;
    workerMap[pw.workerId].earnings += pw.piecesCompleted * pw.ratePerPiece;
  }
  const topWorkers = Object.values(workerMap)
    .sort((a, b) => b.pieces - a.pieces)
    .slice(0, 6);
  const piecesThisWeek = weekPieceWork.reduce((s, p) => s + p.piecesCompleted, 0);

  // ── BROKERS ───────────────────────────────────────────────────────────────
  const [activeConsignments, outstandingInvoices] = await Promise.all([
    db.consignment.findMany({
      where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } },
      include: {
        broker: { select: { name: true } },
        lines: {
          select: { qtyIssued: true, qtySold: true, qtyReturned: true, estPricePerUnit: true },
        },
      },
    }),
    db.invoice.findMany({
      where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      select: { amountTotal: true, amountPaid: true, status: true },
    }),
  ]);

  const brokerMap: Record<string, { name: string; consignments: number; pendingValue: number }> =
    {};
  let totalConsignmentValue = 0;
  for (const c of activeConsignments) {
    const pending = c.lines.reduce(
      (s, l) => s + (l.qtyIssued - l.qtySold - l.qtyReturned) * l.estPricePerUnit,
      0
    );
    totalConsignmentValue += pending;
    const n = c.broker.name;
    if (!brokerMap[n]) brokerMap[n] = { name: n, consignments: 0, pendingValue: 0 };
    brokerMap[n].consignments += 1;
    brokerMap[n].pendingValue += pending;
  }
  const topBrokers = Object.values(brokerMap)
    .sort((a, b) => b.pendingValue - a.pendingValue)
    .slice(0, 6);

  const outstandingTotal = outstandingInvoices.reduce(
    (s, i) => s + (i.amountTotal - i.amountPaid),
    0
  );
  const overdueTotal = outstandingInvoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((s, i) => s + (i.amountTotal - i.amountPaid), 0);

  // ── SALES ─────────────────────────────────────────────────────────────────
  // Use custom date range if provided, otherwise default to current month
  const salesFrom = fromParam ? new Date(fromParam) : monthStart;
  const salesTo   = toParam   ? new Date(toParam)   : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [periodInvoices, recentInvoices] = await Promise.all([
    db.invoice.findMany({
      where: { createdAt: { gte: salesFrom, lte: salesTo } },
      select: { amountTotal: true, amountPaid: true },
    }),
    db.invoice.findMany({
      where: { createdAt: { gte: salesFrom, lte: salesTo } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        consignment: { include: { broker: { select: { name: true } } } },
        directSale: { include: { customer: { select: { name: true } } } },
      },
    }),
  ]);

  const monthBilled    = periodInvoices.reduce((s, i) => s + i.amountTotal, 0);
  const monthCollected = periodInvoices.reduce((s, i) => s + i.amountPaid, 0);

  return NextResponse.json({
    inventory: {
      totalSkus: allItems.length,
      totalPieces,
      totalCarats: Math.round(totalCarats * 100) / 100,
      stockValue: Math.round(stockValue),
      lowStockCount: lowStockItems.length,
      outOfStockCount,
      lowStockItems: lowStockItems.map((i) => ({
        sku: i.sku,
        qty: i.qtyPieces,
        threshold: i.lowStockThreshold,
      })),
      byStoneType,
    },
    workers: {
      activeCount: activeWorkerCount,
      presentToday: presentTodayCount,
      piecesThisWeek,
      topWorkers,
    },
    brokers: {
      activeCount: activeConsignments.length,
      totalValue: Math.round(totalConsignmentValue),
      outstandingAmount: Math.round(outstandingTotal),
      overdueAmount: Math.round(overdueTotal),
      topBrokers,
    },
    sales: {
      monthBilled: Math.round(monthBilled),
      monthCollected: Math.round(monthCollected),
      invoiceCount: periodInvoices.length,
      recentSales: recentInvoices.map((s) => ({
        id: s.id,
        type: s.type,
        party: s.consignment?.broker?.name ?? s.directSale?.customer?.name ?? "—",
        amount: s.amountTotal,
        paid: s.amountPaid,
        status: s.status,
        date: s.createdAt.toISOString(),
      })),
    },
  });
}
