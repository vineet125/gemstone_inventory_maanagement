import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from       = searchParams.get("from");
  const to         = searchParams.get("to");
  const stoneType  = searchParams.get("stoneType");  // plain string match

  const batches = await db.roughBatch.findMany({
    where: {
      ...((from || to) ? {
        purchaseDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        },
      } : {}),
      ...(stoneType ? { stoneType } : {}),
    },
    include: {
      stages: {
        select: {
          stage: true, entryDate: true, exitDate: true,
          weightIn: true, weightOut: true, piecesIn: true, piecesOut: true,
        },
        orderBy: { entryDate: "asc" },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: { purchaseDate: "desc" },
  });

  const rows = batches.map((b) => {
    const activeStage   = b.stages.filter((s) => !s.exitDate).at(-1) ?? b.stages.at(-1);
    const totalPiecesOut = b.stages.reduce((s, st) => s + (st.piecesOut ?? 0), 0);
    const lastWeightOut  = activeStage?.weightOut ?? null;
    const yieldPct = b.weightGrams > 0 && lastWeightOut
      ? `${((lastWeightOut / b.weightGrams) * 100).toFixed(1)}%`
      : "—";

    return {
      "Batch No":       b.batchNo,
      "Purchase Date":  b.purchaseDate.toISOString().split("T")[0],
      "Stone Type":     b.stoneType ?? "",
      "Purchase Type":  b.purchaseType,
      "Supplier":       b.supplierName,
      "Weight In (g)":  b.weightGrams,
      "Weight In (ct)": b.weightCarats,
      "Cost (₹)":      b.costAmount,
      "Total Stages":   b.stages.length,
      "Pieces Out":     totalPiecesOut || 0,
      "Yield %":        yieldPct,
      "Current Stage":  activeStage
        ? (activeStage.exitDate ? "Completed" : activeStage.stage)
        : "—",
      "Created By":     b.createdBy.name,
    };
  });

  return NextResponse.json(rows);
}
