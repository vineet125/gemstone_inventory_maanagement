"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";

interface ActiveStage {
  id: string;
  stage: string;
  entryDate: string;
  weightIn: number;
  piecesIn: number | null;
  batch: { id: string; batchNo: string; supplierName: string };
  workers: Array<{ user: { id: string; name: string } }>;
  polishingRecord: { vendor: { name: string } } | null;
}

interface RecentCompletion {
  id: string;
  stage: string;
  exitDate: string;
  weightIn: number;
  weightOut: number | null;
  batch: { id: string; batchNo: string };
  workers: Array<{ user: { name: string } }>;
}

interface WorkerAssignment {
  stageId: string;
  batchNo: string;
  batchId: string;
  stage: string;
  weightIn: number;
  piecesIn: number | null;
  entryDate: string;
}

interface WorkerSummary {
  workerId: string;
  workerName: string;
  assignments: WorkerAssignment[];
}

interface DashboardData {
  activeStages: ActiveStage[];
  stageCounts: Record<string, number>;
  workers: WorkerSummary[];
  recentCompletions: RecentCompletion[];
}

const STAGE_META: Record<string, { label: string; emoji: string; bg: string; border: string; badge: string; dot: string }> = {
  ROUGH_COLLECTION: {
    label: "Received in Office",
    emoji: "🪨",
    bg: "bg-stone-50",
    border: "border-stone-300",
    badge: "bg-stone-100 text-stone-800",
    dot: "bg-stone-500",
  },
  CUTTING: {
    label: "Cutting",
    emoji: "✂️",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
  SHAPING: {
    label: "Shaping",
    emoji: "💎",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-800",
    dot: "bg-purple-500",
  },
  POLISHING: {
    label: "Polishing",
    emoji: "✨",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  INVENTORY_IN: {
    label: "Ready → Inventory",
    emoji: "📦",
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-500",
  },
};

const FLOW = ["ROUGH_COLLECTION", "CUTTING", "SHAPING", "POLISHING", "INVENTORY_IN"];

export default function ManufacturingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/manufacturing/dashboard");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  const byStage = (stage: string) =>
    data?.activeStages.filter((s) => s.stage === stage) ?? [];

  const totalActive = data?.activeStages.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manufacturing Floor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live view — received material → cutting → shaping → polishing → inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/manufacturing/batches"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            All Orders
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground/60">Loading floor data…</div>
      ) : (
        <>
          {/* Pipeline overview */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-4">
              Processing Pipeline — {totalActive} batches active
            </p>
            <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
              {FLOW.map((stage, i) => {
                const count = data?.stageCounts[stage] ?? 0;
                const m = STAGE_META[stage];
                return (
                  <div key={stage} className="flex items-center flex-1 min-w-[100px]">
                    <div
                      className={`flex-1 rounded-xl border-2 p-3 text-center cursor-default select-none ${m.bg} ${m.border}`}
                    >
                      <p className="text-xl">{m.emoji}</p>
                      <p className="text-xs font-semibold text-muted-foreground mt-1 leading-tight">{m.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${count > 0 ? "text-foreground" : "text-gray-300"}`}>
                        {count}
                      </p>
                    </div>
                    {i < FLOW.length - 1 && (
                      <div className="px-1 text-gray-300 text-lg shrink-0">→</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active work by stage */}
          {totalActive === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center">
              <p className="text-4xl mb-3">🏭</p>
              <p className="font-semibold text-foreground text-lg">No active work on the floor</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Create a purchase order to start tracking material through cutting, shaping, and polishing stages.
              </p>
              <Link
                href="/manufacturing/batches"
                className="mt-5 inline-block rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Go to Batches → Add New
              </Link>
            </div>
          ) : (
            <>
              {["ROUGH_COLLECTION", "CUTTING", "SHAPING", "POLISHING"].map((stage) => {
                const items = byStage(stage);
                if (items.length === 0) return null;
                const m = STAGE_META[stage];
                return (
                  <div key={stage} className={`rounded-xl border-2 ${m.border} ${m.bg} p-4`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">{m.emoji}</span>
                      <h2 className="font-bold text-foreground text-base">{m.label}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.badge}`}>
                        {items.length} batch{items.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((item) => {
                        const days = differenceInDays(new Date(), new Date(item.entryDate));
                        const isOld = days > 3;
                        return (
                          <Link
                            key={item.id}
                            href={`/manufacturing/batches/${item.batch.id}`}
                            className="block rounded-xl bg-card border border-gray-100 p-3.5 hover:shadow-md hover:border-border transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-foreground text-sm">{item.batch.batchNo}</p>
                                <p className="text-xs text-muted-foreground truncate">{item.batch.supplierName}</p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isOld
                                    ? "bg-red-100 text-red-700"
                                    : days === 0
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-muted-foreground"
                                }`}
                              >
                                {days === 0 ? "Today" : `${days}d ago`}
                              </span>
                            </div>

                            <div className="mt-2.5 flex gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="text-muted-foreground/60">⚖</span> {item.weightIn} g
                              </span>
                              {item.piecesIn != null && (
                                <span className="flex items-center gap-1">
                                  <span className="text-muted-foreground/60">📦</span> {item.piecesIn} pcs
                                </span>
                              )}
                            </div>

                            {item.workers.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.workers.map((w) => (
                                  <span
                                    key={w.user.id}
                                    className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-foreground"
                                  >
                                    {w.user.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-orange-500 font-medium">⚠ No worker assigned</p>
                            )}

                            {stage === "POLISHING" && item.polishingRecord && (
                              <p className="mt-1.5 text-xs text-amber-700 font-medium">
                                🏭 {item.polishingRecord.vendor.name}
                              </p>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Worker table */}
              {data!.workers.length > 0 && (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <h2 className="font-bold text-foreground">Workers On Floor Right Now</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Who is holding which batch at which stage</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-5 py-3">Worker</th>
                          <th className="text-left px-4 py-3">Stage</th>
                          <th className="text-left px-4 py-3">Batch</th>
                          <th className="text-left px-4 py-3">Weight</th>
                          <th className="text-left px-4 py-3">Pieces</th>
                          <th className="text-left px-4 py-3">Since</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data!.workers.flatMap((w) =>
                          w.assignments.map((a, i) => {
                            const m = STAGE_META[a.stage];
                            const days = differenceInDays(new Date(), new Date(a.entryDate));
                            return (
                              <tr key={`${w.workerId}-${i}`} className="hover:bg-accent">
                                <td className="px-5 py-3 font-semibold text-foreground whitespace-nowrap">
                                  {i === 0 ? w.workerName : ""}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.badge}`}>
                                    {m.emoji} {m.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Link
                                    href={`/manufacturing/batches/${a.batchId}`}
                                    className="font-medium text-amber-600 hover:text-amber-700 hover:underline"
                                  >
                                    {a.batchNo}
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{a.weightIn} g</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {a.piecesIn != null ? a.piecesIn : "—"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground/60">
                                  {days === 0
                                    ? "Today"
                                    : days === 1
                                    ? "Yesterday"
                                    : format(new Date(a.entryDate), "dd MMM")}
                                  {days > 3 && (
                                    <span className="ml-1 text-red-500 font-medium">(!)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent completions */}
              {data!.recentCompletions.length > 0 && (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <h2 className="font-bold text-foreground">Recently Completed (Last 7 Days)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-5 py-3">Batch</th>
                          <th className="text-left px-4 py-3">Stage Done</th>
                          <th className="text-left px-4 py-3">Weight In → Out</th>
                          <th className="text-left px-4 py-3">Yield</th>
                          <th className="text-left px-4 py-3">Workers</th>
                          <th className="text-left px-4 py-3">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data!.recentCompletions.map((c) => {
                          const m = STAGE_META[c.stage];
                          const yield_ =
                            c.weightOut && c.weightIn
                              ? Math.round((c.weightOut / c.weightIn) * 100)
                              : null;
                          return (
                            <tr key={c.id} className="hover:bg-accent">
                              <td className="px-5 py-3">
                                <Link
                                  href={`/manufacturing/batches/${c.batch.id}`}
                                  className="font-semibold text-amber-600 hover:underline"
                                >
                                  {c.batch.batchNo}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.badge}`}>
                                  {m.emoji} {m.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {c.weightIn} g → {c.weightOut ?? "?"} g
                              </td>
                              <td className="px-4 py-3">
                                {yield_ != null ? (
                                  <span
                                    className={`font-semibold ${
                                      yield_ < 70 ? "text-red-600" : "text-green-600"
                                    }`}
                                  >
                                    {yield_}%
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {c.workers.map((w) => w.user.name).join(", ") || "—"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground/60">
                                {c.exitDate ? format(new Date(c.exitDate), "dd MMM") : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Quick navigation */}
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/manufacturing/batches"
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow text-center"
            >
              <p className="text-xl mb-1">📋</p>
              <p className="font-semibold text-foreground text-sm">Purchase Orders</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add & manage purchase orders</p>
            </Link>
            <Link
              href="/manufacturing/stages"
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow text-center"
            >
              <p className="text-xl mb-1">🗂️</p>
              <p className="font-semibold text-foreground text-sm">Stage Board</p>
              <p className="text-xs text-muted-foreground mt-0.5">Kanban view of all stages</p>
            </Link>
            <Link
              href="/manufacturing/polishing"
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow text-center"
            >
              <p className="text-xl mb-1">✨</p>
              <p className="font-semibold text-foreground text-sm">Polishing Vendors</p>
              <p className="text-xs text-muted-foreground mt-0.5">External polishing partners</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
