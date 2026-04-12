"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface StageRecord {
  id: string;
  stage: string;
  entryDate: string;
  exitDate: string | null;
  weightIn: number;
  weightOut: number | null;
  piecesOut: number | null;
  batch: { batchNo: string; id: string };
  workers: Array<{ user: { name: string } }>;
}

const STAGES = ["ROUGH_COLLECTION", "CUTTING", "SHAPING", "POLISHING", "INVENTORY_IN"];
const STAGE_LABELS: Record<string, string> = {
  ROUGH_COLLECTION: "Material Received",
  CUTTING: "Cutting",
  SHAPING: "Shaping",
  POLISHING: "Polishing",
  INVENTORY_IN: "Inventory In",
};
const STAGE_COLORS: Record<string, string> = {
  ROUGH_COLLECTION: "bg-stone-100 border-stone-300",
  CUTTING: "bg-blue-50 border-blue-200",
  SHAPING: "bg-purple-50 border-purple-200",
  POLISHING: "bg-amber-50 border-amber-200",
  INVENTORY_IN: "bg-green-50 border-green-200",
};
const STAGE_EMOJIS: Record<string, string> = {
  ROUGH_COLLECTION: "🪨", CUTTING: "✂️", SHAPING: "💎", POLISHING: "✨", INVENTORY_IN: "📦",
};

export default function StagesPage() {
  const [stages, setStages] = useState<StageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/manufacturing/batches");
      if (!res.ok) { setLoading(false); return; }
      const batches = await res.json();

      const details = await Promise.all(
        batches.slice(0, 30).map((b: { id: string }) =>
          fetch(`/api/manufacturing/batches/${b.id}`).then((r) => r.json())
        )
      );

      const allStages: StageRecord[] = [];
      for (const batch of details) {
        for (const stage of batch.stages ?? []) {
          allStages.push({ ...stage, batch: { batchNo: batch.batchNo, id: batch.id } });
        }
      }

      setStages(allStages);
      setLoading(false);
    }
    load();
  }, []);

  // For each batch, find its LATEST active (no exitDate) stage → show only that one
  // This prevents a batch appearing in multiple columns
  const batchCurrentStage = new Map<string, StageRecord>();
  for (const stage of stages) {
    if (!stage.exitDate) {
      const existing = batchCurrentStage.get(stage.batch.id);
      if (!existing || new Date(stage.entryDate) > new Date(existing.entryDate)) {
        batchCurrentStage.set(stage.batch.id, stage);
      }
    }
  }
  const activeStages = Array.from(batchCurrentStage.values());

  const grouped = STAGES.reduce<Record<string, StageRecord[]>>((acc, s) => {
    acc[s] = activeStages.filter((st) => st.stage === s);
    return acc;
  }, {});

  const total = activeStages.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stage Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each batch shown in its <strong>current active stage</strong> — {total} batch{total !== 1 ? "es" : ""} on the floor
          </p>
        </div>
        <Link href="/manufacturing/batches"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          + New Batch
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {STAGES.map((s) => (
            <div key={s} className={`rounded-xl border p-4 ${STAGE_COLORS[s]}`}>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <span>{STAGE_EMOJIS[s]}</span>
                {STAGE_LABELS[s]}
                <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-bold shadow-sm">
                  {grouped[s].length}
                </span>
              </h2>
              {grouped[s].length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-4">None active</p>
              ) : (
                <div className="space-y-2">
                  {grouped[s].map((stage) => (
                    <Link key={stage.id} href={`/manufacturing/batches/${stage.batch.id}`}
                      className="block rounded-lg bg-card p-3 shadow-sm hover:shadow-md transition-shadow text-xs border border-white/60">
                      <p className="font-bold text-foreground text-sm">{stage.batch.batchNo}</p>
                      <p className="text-muted-foreground mt-0.5">In: {format(new Date(stage.entryDate), "dd MMM")}</p>
                      <p className="text-muted-foreground">{stage.weightIn.toLocaleString()} g</p>
                      {stage.workers.length > 0 && (
                        <p className="text-muted-foreground/60 truncate mt-0.5">{stage.workers.map((w) => w.user.name).join(", ")}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && total === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
          <p className="text-3xl mb-2">🏭</p>
          <p className="font-semibold text-foreground">No active batches on the floor</p>
          <p className="text-sm text-muted-foreground mt-1">Add a new batch from the Batches page to start tracking.</p>
          <Link href="/manufacturing/batches"
            className="mt-4 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go to Batches →
          </Link>
        </div>
      )}
    </div>
  );
}
