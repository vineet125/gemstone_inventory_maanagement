import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

// Compute attendance status from in/out times
// 7+ hours = PRESENT, 3.5+ hours = HALF_DAY, else ABSENT
function computeStatusFromTimes(inTime: string, outTime: string): string {
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  const mins = outH * 60 + outM - (inH * 60 + inM);
  if (mins <= 0) return "PRESENT"; // same time or midnight crossover — give benefit of doubt
  if (mins >= 420) return "PRESENT";  // 7+ hours
  if (mins >= 210) return "HALF_DAY"; // 3.5+ hours
  return "ABSENT";
}

// GET /api/workers/daily?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const [y, m, d] = dateStr.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d));
  const dayEnd = new Date(Date.UTC(y, m - 1, d + 1));

  const workers = await db.worker.findMany({
    where: { active: true },
    include: {
      attendance: {
        where: { date: { gte: dayStart, lt: dayEnd } },
        take: 1,
      },
      pieceWork: {
        where: { date: { gte: dayStart, lt: dayEnd } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  let totalPresent = 0, totalAbsent = 0, totalPieces = 0, totalWages = 0;

  const result = workers.map((w) => {
    const att = w.attendance[0] ?? null;

    // Parse inTime / outTime stored as JSON in notes: { "in": "09:00", "out": "17:30" }
    let attInTime: string | null = null;
    let attOutTime: string | null = null;
    if (att?.notes) {
      try {
        const parsed = JSON.parse(att.notes);
        attInTime = parsed.in ?? null;
        attOutTime = parsed.out ?? null;
      } catch { /* notes is plain text, not time JSON */ }
    }

    const pieces = w.pieceWork.reduce((s, p) => s + p.piecesCompleted, 0);
    const pieceEarning = w.pieceWork.reduce((s, p) => s + p.piecesCompleted * p.ratePerPiece, 0);

    let dayEarning = 0;
    if (att?.status === "PRESENT") {
      dayEarning = w.payType !== "PER_PIECE" ? (w.dailyWageRate ?? 0) : 0;
      totalPresent++;
    } else if (att?.status === "HALF_DAY") {
      dayEarning = w.payType !== "PER_PIECE" ? (w.dailyWageRate ?? 0) / 2 : 0;
      totalPresent++;
    } else if (att?.status === "ABSENT") {
      totalAbsent++;
    }
    if (w.payType === "PER_PIECE") dayEarning = pieceEarning;
    else if (w.payType === "MIXED") dayEarning += pieceEarning;

    totalPieces += pieces;
    totalWages += dayEarning;

    return {
      id: w.id,
      name: w.name,
      phone: w.phone,
      payType: w.payType,
      dailyWageRate: w.dailyWageRate,
      departments: (() => { try { return JSON.parse(w.departments) as string[]; } catch { return []; } })(),
      attendance: att
        ? { id: att.id, status: att.status, inTime: attInTime, outTime: attOutTime }
        : null,
      pieceWork: w.pieceWork.map((p) => ({
        id: p.id,
        operation: p.stoneType,
        detail: [p.shape, p.size].filter(Boolean).join(" "),
        piecesCompleted: p.piecesCompleted,
        ratePerPiece: p.ratePerPiece,
        currency: p.currency,
        notes: p.notes,
        earning: Math.round(p.piecesCompleted * p.ratePerPiece),
      })),
      totalPieces: pieces,
      totalEarning: Math.round(dayEarning),
    };
  });

  return NextResponse.json({
    date: dateStr,
    workers: result,
    summary: {
      totalWorkers: workers.length,
      totalPresent,
      totalAbsent,
      totalNotMarked: workers.length - totalPresent - totalAbsent,
      totalPieces,
      totalWages: Math.round(totalWages),
    },
  });
}

// POST /api/workers/daily  — bulk attendance upsert
// Accepts: { date, records: [{ workerId, status?, inTime?, outTime? }] }
// If inTime + outTime provided: status is auto-computed from hours worked
// If only inTime: status = "PRESENT" (arrived but not yet left)
// If only status: stored as-is (used by "Mark All Present")
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, records } = (await req.json()) as {
    date: string;
    records: Array<{
      workerId: string;
      status?: string;
      inTime?: string | null;
      outTime?: string | null;
    }>;
  };

  const [y, m, d] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(y, m - 1, d));

  await Promise.all(
    records.map((r) => {
      let status = r.status ?? "PRESENT";
      let notes: string | null = null;

      if (r.inTime && r.outTime) {
        status = computeStatusFromTimes(r.inTime, r.outTime);
        notes = JSON.stringify({ in: r.inTime, out: r.outTime });
      } else if (r.inTime) {
        status = r.status ?? "PRESENT";
        notes = JSON.stringify({ in: r.inTime });
      }

      return db.workerAttendance.upsert({
        where: { workerId_date: { workerId: r.workerId, date: parsedDate } },
        update: { status, ...(notes !== null ? { notes } : {}) },
        create: { workerId: r.workerId, date: parsedDate, status, notes },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
