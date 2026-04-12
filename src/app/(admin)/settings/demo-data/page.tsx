"use client";

import { useState } from "react";
import Link from "next/link";

export default function DemoDataPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);

  async function runSeed() {
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/seed/demo", { method: "POST" });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: `Server returned non-JSON: ${text.slice(0, 200)}` }; }
      setResult(data);
      setStatus(res.ok && !data?.error ? "done" : "error");
    } catch (e) {
      setStatus("error");
      setResult({ error: String(e) });
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href="/settings" className="text-sm text-muted-foreground/60 hover:text-muted-foreground">← Settings</Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">Demo Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Populate the portal with realistic test data for full-depth testing.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="space-y-2 text-sm text-foreground">
          <p className="font-medium text-foreground">This will create:</p>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            <li>100 Brokers across 20 Indian cities</li>
            <li>50 Workers with attendance & piece-work history (last 90 days)</li>
            <li>60+ Inventory SKUs across all stone type / shape / size / grade combinations</li>
            <li>300 Consignments (mix of Active, Partially Returned, Fully Sold, Closed) spread over 2 years</li>
            <li>150 Direct Sales with invoices and payment history</li>
          </ul>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
          ⚠ Safe to run only once. If brokers already exist (&gt; 30), it will abort without changes.
        </div>

        {status === "done" && result && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
            <p className="font-semibold">✅ {result.message}</p>
            {result.created && (
              <ul className="text-xs space-y-0.5">
                {Object.entries(result.created).map(([k, v]) => (
                  <li key={k}><span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>: <strong>{String(v)}</strong></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            ❌ {result?.error ?? result?.message ?? "Failed"}
          </div>
        )}

        <button
          onClick={runSeed}
          disabled={status === "loading" || status === "done"}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {status === "loading" ? "Seeding data… (may take 30–60 seconds)" : status === "done" ? "✅ Done" : "🚀 Seed Demo Data"}
        </button>
      </div>
    </div>
  );
}
