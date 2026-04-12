import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // All active stages (no exit date yet) — these are "in progress"
  const activeStages = await db.manufacturingStage.findMany({
    where: { exitDate: null },
    include: {
      batch: { select: { id: true, batchNo: true, supplierName: true } },
      workers: { include: { user: { select: { id: true, name: true } } } },
      polishingRecord: { include: { vendor: { select: { name: true } } } },
    },
    orderBy: { entryDate: "asc" },
  });

  // Count active items per stage
  const stageCounts: Record<string, number> = {};
  for (const s of activeStages) {
    stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
  }

  // Build per-worker summary: what each worker is currently assigned to
  const workerMap = new Map<
    string,
    {
      workerId: string;
      workerName: string;
      assignments: Array<{
        stageId: string;
        batchNo: string;
        batchId: string;
        stage: string;
        weightIn: number;
        piecesIn: number | null;
        entryDate: string;
      }>;
    }
  >();

  for (const stage of activeStages) {
    for (const sw of stage.workers) {
      if (!workerMap.has(sw.user.id)) {
        workerMap.set(sw.user.id, {
          workerId: sw.user.id,
          workerName: sw.user.name,
          assignments: [],
        });
      }
      workerMap.get(sw.user.id)!.assignments.push({
        stageId: stage.id,
        batchNo: stage.batch.batchNo,
        batchId: stage.batch.id,
        stage: stage.stage,
        weightIn: stage.weightIn,
        piecesIn: stage.piecesIn,
        entryDate: stage.entryDate.toISOString(),
      });
    }
  }

  // Recent completions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentCompletions = await db.manufacturingStage.findMany({
    where: {
      exitDate: { gte: sevenDaysAgo },
      stage: { not: "INVENTORY_IN" },
    },
    include: {
      batch: { select: { id: true, batchNo: true } },
      workers: { include: { user: { select: { name: true } } } },
    },
    orderBy: { exitDate: "desc" },
    take: 10,
  });

  return NextResponse.json({
    activeStages: activeStages.map((s) => ({
      id: s.id,
      stage: s.stage,
      entryDate: s.entryDate.toISOString(),
      weightIn: s.weightIn,
      piecesIn: s.piecesIn,
      batch: s.batch,
      workers: s.workers,
      polishingRecord: s.polishingRecord,
    })),
    stageCounts,
    workers: Array.from(workerMap.values()),
    recentCompletions: recentCompletions.map((s) => ({
      id: s.id,
      stage: s.stage,
      exitDate: s.exitDate?.toISOString(),
      weightIn: s.weightIn,
      weightOut: s.weightOut,
      batch: s.batch,
      workers: s.workers,
    })),
  });
}
