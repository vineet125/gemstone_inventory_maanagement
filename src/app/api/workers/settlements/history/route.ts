import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

// GET /api/workers/settlements/history?workerId=xxx  (omit for all)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("workerId");
  const from = searchParams.get("from");   // YYYY-MM-DD
  const to   = searchParams.get("to");     // YYYY-MM-DD

  const dateFilter = (from || to) ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    },
  } : {};

  const settlements = await db.workerSettlement.findMany({
    where: { ...(workerId ? { workerId } : {}), ...dateFilter },
    include: { worker: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  if (!settlements.length) return NextResponse.json([]);

  return NextResponse.json(
    settlements.map((s) => ({
      id: s.id,
      workerId: s.workerId,
      workerName: s.worker.name,
      fromDate: s.fromDate.toISOString().split("T")[0],
      toDate: s.toDate.toISOString().split("T")[0],
      daysPresent: s.daysPresent,
      halfDays: s.halfDays,
      totalPieces: s.totalPieces,
      wagesAmount: s.wagesAmount,
      pieceAmount: s.pieceAmount,
      totalAmount: s.totalAmount,
      paidAmount: s.paidAmount,
      balance: Math.round(s.totalAmount - s.paidAmount),
      notes: s.notes,
      settledBy: s.settledBy,
      paymentMode: s.paymentMode ?? "CASH",
      paymentDate: s.paymentDate ? s.paymentDate.toISOString().split("T")[0] : null,
      createdAt: s.createdAt.toISOString(),
    }))
  );
}
