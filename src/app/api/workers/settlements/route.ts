import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

// ─── GET /api/workers/settlements
// Returns all active workers with their pending dues (from last settlement to today)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const workers = await db.worker.findMany({
    where: { active: true },
    include: {
      settlements: {
        orderBy: { toDate: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const result = await Promise.all(
    workers.map(async (w) => {
      const lastSettlement = w.settlements[0] ?? null;

      // Period starts day after last settlement, or join date, or 90 days ago
      let fromDate: Date;
      if (lastSettlement) {
        fromDate = new Date(lastSettlement.toDate);
        fromDate.setDate(fromDate.getDate() + 1);
      } else if (w.joinDate) {
        fromDate = new Date(w.joinDate);
      } else {
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);
      }
      fromDate.setHours(0, 0, 0, 0);

      // Carry forward any unpaid balance from the last settlement
      const carriedBalance = lastSettlement
        ? Math.max(0, Math.round(lastSettlement.totalAmount - lastSettlement.paidAmount))
        : 0;

      // Skip if from > today
      if (fromDate > today) {
        return {
          id: w.id, name: w.name, phone: w.phone,
          payType: w.payType, settlementCycle: w.settlementCycle,
          dailyWageRate: w.dailyWageRate,
          fromDate: fromDate.toISOString().split("T")[0],
          toDate: today.toISOString().split("T")[0],
          lastSettledOn: lastSettlement?.toDate?.toISOString().split("T")[0] ?? null,
          lastPaidAmount: lastSettlement?.paidAmount ?? null,
          lastTotalAmount: lastSettlement?.totalAmount ?? null,
          carriedBalance,
          daysPresent: 0, halfDays: 0, totalPieces: 0,
          wagesAmount: 0, pieceAmount: 0, totalAmount: carriedBalance,
          hasBalance: carriedBalance > 0,
        };
      }

      const [attendance, pieceWork] = await Promise.all([
        db.workerAttendance.findMany({
          where: { workerId: w.id, date: { gte: fromDate, lte: today } },
        }),
        db.workerPieceWork.findMany({
          where: { workerId: w.id, date: { gte: fromDate, lte: today } },
        }),
      ]);

      const daysPresent = attendance.filter((a) => a.status === "PRESENT").length;
      const halfDays = attendance.filter((a) => a.status === "HALF_DAY").length;
      const totalPieces = pieceWork.reduce((s, p) => s + p.piecesCompleted, 0);

      const wagesAmount =
        w.payType !== "PER_PIECE"
          ? daysPresent * (w.dailyWageRate ?? 0) + halfDays * (w.dailyWageRate ?? 0) * 0.5
          : 0;
      const pieceAmount =
        w.payType !== "DAILY_WAGES"
          ? pieceWork.reduce((s, p) => s + p.piecesCompleted * p.ratePerPiece, 0)
          : 0;
      const totalAmount = Math.round(wagesAmount + pieceAmount) + carriedBalance;

      return {
        id: w.id,
        name: w.name,
        phone: w.phone,
        payType: w.payType,
        settlementCycle: w.settlementCycle,
        dailyWageRate: w.dailyWageRate,
        fromDate: fromDate.toISOString().split("T")[0],
        toDate: today.toISOString().split("T")[0],
        lastSettledOn: lastSettlement?.toDate?.toISOString().split("T")[0] ?? null,
        lastPaidAmount: lastSettlement?.paidAmount ?? null,
        lastTotalAmount: lastSettlement?.totalAmount ?? null,
        carriedBalance,
        daysPresent,
        halfDays,
        totalPieces,
        wagesAmount: Math.round(wagesAmount),
        pieceAmount: Math.round(pieceAmount),
        totalAmount,
        hasBalance: totalAmount > 0,
      };
    })
  );

  return NextResponse.json(result);
}

// ─── POST /api/workers/settlements
// Create a settlement record
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    workerId, fromDate, toDate,
    daysPresent, halfDays, totalPieces,
    wagesAmount, pieceAmount, totalAmount, paidAmount,
    notes, paymentMode, paymentDate,
  } = body as {
    workerId: string; fromDate: string; toDate: string;
    daysPresent: number; halfDays: number; totalPieces: number;
    wagesAmount: number; pieceAmount: number; totalAmount: number; paidAmount: number;
    notes?: string; paymentMode?: string; paymentDate?: string;
  };

  const [y1, m1, d1] = fromDate.split("-").map(Number);
  const [y2, m2, d2] = toDate.split("-").map(Number);

  const settlement = await db.workerSettlement.create({
    data: {
      workerId,
      fromDate: new Date(Date.UTC(y1, m1 - 1, d1)),
      toDate: new Date(Date.UTC(y2, m2 - 1, d2)),
      daysPresent: daysPresent ?? 0,
      halfDays: halfDays ?? 0,
      totalPieces: totalPieces ?? 0,
      wagesAmount: wagesAmount ?? 0,
      pieceAmount: pieceAmount ?? 0,
      totalAmount,
      paidAmount,
      notes: notes ?? null,
      settledBy: session.user?.name ?? null,
    },
  });

  // Set paymentMode + paymentDate via raw SQL (new columns, Prisma client not regenerated)
  const mode = paymentMode ?? "CASH";
  const pd = paymentDate ? new Date(paymentDate) : new Date();
  await db.$executeRaw`
    UPDATE "WorkerSettlement"
    SET "paymentMode" = ${mode}, "paymentDate" = ${pd}
    WHERE id = ${settlement.id}
  `;

  return NextResponse.json(settlement, { status: 201 });
}
