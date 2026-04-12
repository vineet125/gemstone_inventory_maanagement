"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { useRole } from "@/hooks/useRole";

// ─── Types ─────────────────────────────────────────────────────────────────

interface PieceEntry {
  id: string;
  operation: string;
  detail: string;
  piecesCompleted: number;
  ratePerPiece: number;
  currency: string;
  notes: string | null;
  earning: number;
}

interface WorkerRow {
  id: string;
  name: string;
  phone: string | null;
  payType: string;
  dailyWageRate: number | null;
  departments: string[];
  attendance: { id: string; status: string; inTime: string | null; outTime: string | null } | null;
  pieceWork: PieceEntry[];
  totalPieces: number;
  totalEarning: number;
}

interface Summary {
  totalWorkers: number;
  totalPresent: number;
  totalAbsent: number;
  totalNotMarked: number;
  totalPieces: number;
  totalWages: number;
}

interface DailyData {
  date: string;
  workers: WorkerRow[];
  summary: Summary;
}

interface TimeInput {
  inTime: string;
  outTime: string;
  dirty: boolean;
}

const DEPT_COLORS: Record<string, string> = {
  Cutting:  "bg-orange-100 text-orange-700",
  Shaping:  "bg-sky-100 text-sky-700",
  Polishing:"bg-purple-100 text-purple-700",
  MM:       "bg-pink-100 text-pink-700",
  Sorting:  "bg-teal-100 text-teal-700",
  Packing:  "bg-lime-100 text-lime-700",
  Other:    "bg-gray-100 text-muted-foreground",
};

const OPERATIONS = ["Cutting", "Shaping", "Polishing", "Maal Checking", "Sorting", "Other"];

const STATUS_CONFIG = {
  PRESENT:  { full: "Present",  soft: "bg-green-50 text-green-700 border border-green-200" },
  HALF_DAY: { full: "Half Day", soft: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  ABSENT:   { full: "Absent",   soft: "bg-red-50 text-red-700 border border-red-200" },
} as const;

// Auto-compute status from in/out times
// 7+ hrs = PRESENT, 3.5+ hrs = HALF_DAY, else ABSENT
function computeStatus(inTime: string, outTime: string): string | null {
  if (!inTime) return null;
  if (!outTime) return "PRESENT"; // arrived, awaiting check-out
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  const mins = outH * 60 + outM - (inH * 60 + inM);
  if (mins <= 0) return null;
  if (mins >= 420) return "PRESENT";  // 7 hrs
  if (mins >= 210) return "HALF_DAY"; // 3.5 hrs
  return "ABSENT";
}

function hoursLabel(inTime: string, outTime: string): string | null {
  if (!inTime || !outTime) return null;
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  const mins = outH * 60 + outM - (inH * 60 + inM);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function DailyRegisterPage() {
  const role = useRole();
  const isStaff = role === "STAFF";
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pieceModal, setPieceModal] = useState<{ workerId: string; workerName: string } | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [timeInputs, setTimeInputs] = useState<Record<string, TimeInput>>({});
  const [search, setSearch] = useState("");
  const initializedDateRef = useRef<string>("");
  const [stoneTypes, setStoneTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [pieceWorkSizes, setPieceWorkSizes] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/stone-types").then((r) => r.json()),
      fetch("/api/settings/sizes").then((r) => r.json()),
    ]).then(([types, szs]) => { setStoneTypes(types); setPieceWorkSizes(szs); });
  }, []);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/workers/daily?date=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(dateStr); }, [dateStr, load]);

  // Sync time inputs from server data; re-init fully on date change
  useEffect(() => {
    if (!data) return;
    if (data.date !== initializedDateRef.current) {
      // Date changed — reset all time inputs from server
      initializedDateRef.current = data.date;
      const init: Record<string, TimeInput> = {};
      for (const w of data.workers) {
        init[w.id] = { inTime: w.attendance?.inTime ?? "", outTime: w.attendance?.outTime ?? "", dirty: false };
      }
      setTimeInputs(init);
    } else {
      // Same date, data reloaded (e.g. after save) — update only non-dirty entries
      setTimeInputs((prev) => {
        const next = { ...prev };
        for (const w of data.workers) {
          if (!next[w.id] || !next[w.id].dirty) {
            next[w.id] = { inTime: w.attendance?.inTime ?? "", outTime: w.attendance?.outTime ?? "", dirty: false };
          }
        }
        return next;
      });
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(dir: number) {
    const next = dir > 0 ? addDays(parseISO(dateStr), 1) : subDays(parseISO(dateStr), 1);
    setDateStr(format(next, "yyyy-MM-dd"));
  }

  function setTime(workerId: string, field: "inTime" | "outTime", value: string) {
    setTimeInputs((s) => ({ ...s, [workerId]: { ...s[workerId], [field]: value, dirty: true } }));
  }

  async function saveTime(workerId: string) {
    const t = timeInputs[workerId];
    if (!t) return;
    setSaving((s) => ({ ...s, [workerId]: true }));
    await fetch("/api/workers/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateStr,
        records: [{ workerId, inTime: t.inTime || null, outTime: t.outTime || null }],
      }),
    });
    setTimeInputs((s) => ({ ...s, [workerId]: { ...s[workerId], dirty: false } }));
    await load(dateStr);
    setSaving((s) => ({ ...s, [workerId]: false }));
  }

  async function markAllPresent() {
    if (!data) return;
    const records = data.workers.map((w) => ({ workerId: w.id, status: "PRESENT" }));
    await fetch("/api/workers/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateStr, records }),
    });
    initializedDateRef.current = ""; // force full reinit on next data load
    await load(dateStr);
  }

  const isToday = dateStr === new Date().toISOString().split("T")[0];
  const displayDate = format(parseISO(dateStr), "EEEE, dd MMMM yyyy");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Work Register</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Attendance (in/out time) + piece work for all workers</p>
        </div>
        <button
          onClick={markAllPresent}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          ✓ Mark All Present
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          ← Prev
        </button>
        <div className="flex-1 rounded-xl border bg-card px-4 py-2.5 text-center">
          <p className="font-semibold text-foreground text-sm">{displayDate}</p>
          {isToday && <p className="text-xs text-green-600 font-medium">Today</p>}
        </div>
        <button
          onClick={() => navigate(1)}
          disabled={isToday}
          className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        />
      </div>

      {/* Search */}
      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search worker by name…"
          className="w-full max-w-xs rounded-lg border bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Summary bar */}
      {data && !loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-green-50 border-green-200 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{data.summary.totalPresent}</p>
            <p className="text-xs text-green-600 font-medium">Present</p>
          </div>
          <div className="rounded-xl border bg-red-50 border-red-200 p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{data.summary.totalAbsent}</p>
            <p className="text-xs text-red-500 font-medium">Absent</p>
          </div>
          <div className="rounded-xl border bg-blue-50 border-blue-200 p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{data.summary.totalPieces}</p>
            <p className="text-xs text-blue-600 font-medium">Pieces Done</p>
          </div>
          {!isStaff && (
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">₹{data.summary.totalWages.toLocaleString()}</p>
            <p className="text-xs text-amber-600 font-medium">Total Wages</p>
          </div>
          )}
        </div>
      )}

      {/* Worker table */}
      {loading ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-3">Worker</th>
                <th className="text-left px-4 py-3">Dept</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">In</th>
                <th className="text-left px-4 py-3">Out</th>
                <th className="text-right px-4 py-3">Hrs</th>
                {!isStaff && <th className="text-right px-4 py-3">Earnings (₹)</th>}
                <th className="text-center px-4 py-3">Work Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5">
                    <div className="h-3.5 bg-muted rounded w-28 mb-1.5" />
                    <div className="h-2.5 bg-muted rounded w-20" />
                  </td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-16" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-20" /></td>
                  <td className="px-4 py-3.5"><div className="h-8 bg-muted rounded-lg w-24" /></td>
                  <td className="px-4 py-3.5"><div className="h-8 bg-muted rounded-lg w-24" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-8 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-16 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-7 bg-muted rounded-lg w-20 mx-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !data || data.workers.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
          <p className="text-3xl mb-2">👷</p>
          <p className="font-semibold text-foreground">No workers found</p>
          <p className="text-sm text-muted-foreground mt-1">Add workers under the Workers section first.</p>
        </div>
      ) : (() => {
        const displayWorkers = search.trim()
          ? data.workers.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
          : data.workers;
        if (displayWorkers.length === 0) return (
          <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No workers match &quot;{search}&quot;</p>
          </div>
        );
        return (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-3">Worker</th>
                <th className="text-center px-4 py-3">In / Out Time</th>
                <th className="text-right px-4 py-3">Pieces</th>
                {!isStaff && <th className="text-right px-4 py-3">Earnings (₹)</th>}
                <th className="text-center px-4 py-3">Work Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayWorkers.map((w) => {
                const expanded = expandedId === w.id;
                const t = timeInputs[w.id] ?? { inTime: "", outTime: "", dirty: false };
                const previewStatus = computeStatus(t.inTime, t.outTime);
                const shownStatus = previewStatus ?? w.attendance?.status ?? null;
                const statusCfg = shownStatus ? STATUS_CONFIG[shownStatus as keyof typeof STATUS_CONFIG] : null;
                const hours = hoursLabel(t.inTime, t.outTime);
                const isDaily = w.payType === "DAILY_WAGES";

                return (
                  <>
                    <tr key={w.id} className={`hover:bg-accent ${shownStatus === "ABSENT" ? "opacity-60" : ""}`}>

                      {/* Worker info */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{w.name}</p>
                        {w.phone && <p className="text-xs text-muted-foreground/60">{w.phone}</p>}
                        <p className="text-xs text-muted-foreground/60">
                          {w.payType === "DAILY_WAGES" ? (isStaff ? "Daily wage" : `₹${w.dailyWageRate}/day`) :
                           w.payType === "PER_PIECE" ? "Per piece" : "Mixed"}
                        </p>
                        {w.departments?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {w.departments.map((d) => (
                              <span key={d} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${DEPT_COLORS[d] ?? "bg-gray-100 text-muted-foreground"}`}>{d}</span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* In / Out time inputs */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 min-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground/60 w-7">In</span>
                            <input
                              type="time"
                              value={t.inTime}
                              onChange={(e) => setTime(w.id, "inTime", e.target.value)}
                              className="border rounded px-2 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground/60 w-7">Out</span>
                            <input
                              type="time"
                              value={t.outTime}
                              onChange={(e) => setTime(w.id, "outTime", e.target.value)}
                              className="border rounded px-2 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {statusCfg ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusCfg.soft}`}>
                                {statusCfg.full}
                                {hours && <span className="ml-1 opacity-70">({hours})</span>}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">Not marked</span>
                            )}
                            {t.dirty && (
                              <button
                                onClick={() => saveTime(w.id)}
                                disabled={saving[w.id]}
                                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90"
                              >
                                {saving[w.id] ? "…" : "Save"}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Pieces — hidden for daily wage workers */}
                      <td className="px-4 py-3 text-right">
                        {isDaily ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <span className={`font-semibold ${w.totalPieces > 0 ? "text-blue-700" : "text-muted-foreground/60"}`}>
                            {w.totalPieces || "—"}
                          </span>
                        )}
                      </td>

                      {/* Earnings */}
                      {!isStaff && (
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${w.totalEarning > 0 ? "text-amber-700" : "text-muted-foreground/60"}`}>
                          {w.totalEarning > 0 ? `₹${w.totalEarning.toLocaleString()}` : "—"}
                        </span>
                      </td>
                      )}

                      {/* Work log — piece actions hidden for daily wage workers */}
                      <td className="px-4 py-3 text-center">
                        {isDaily ? (
                          <span className="text-xs text-muted-foreground/60">Daily rate</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPieceModal({ workerId: w.id, workerName: w.name })}
                              className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              + Pieces
                            </button>
                            <button
                              onClick={() => setExpandedId(expanded ? null : w.id)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                                w.pieceWork.length > 0
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : "bg-gray-100 text-muted-foreground/60 hover:bg-gray-200"
                              }`}
                            >
                              {expanded ? "▲ Hide" : w.pieceWork.length > 0 ? `▼ Log (${w.pieceWork.length})` : "▼ Log"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expanded piece work log */}
                    {expanded && !isDaily && (
                      <tr key={`${w.id}-expanded`}>
                        <td colSpan={isStaff ? 4 : 5} className="bg-blue-50/60 px-4 py-3">
                          {w.pieceWork.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 italic text-center py-2">No work logged yet. Click "+ Pieces" to add.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {w.pieceWork.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 rounded-lg bg-card border border-blue-100 px-3 py-2 text-xs">
                                  <span className="font-semibold text-blue-800 min-w-[80px]">{p.operation}</span>
                                  {p.detail && <span className="text-muted-foreground/60">{p.detail}</span>}
                                  <span className="text-foreground font-medium">{p.piecesCompleted} pcs</span>
                                  {!isStaff && <span className="text-muted-foreground">@ ₹{p.ratePerPiece}/pc</span>}
                                  {!isStaff && <span className="ml-auto font-bold text-amber-700">₹{p.earning}</span>}
                                  {p.notes && <span className={`${isStaff ? "ml-auto" : ""} text-muted-foreground/60 italic truncate max-w-[120px]`}>{p.notes}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        );
      })()}

      {/* Piece Work Modal */}
      {pieceModal && (
        <PieceWorkModal
          workerId={pieceModal.workerId}
          workerName={pieceModal.workerName}
          date={dateStr}
          stoneTypes={stoneTypes}
          sizes={pieceWorkSizes}
          isStaff={isStaff}
          onClose={() => setPieceModal(null)}
          onSaved={() => { setPieceModal(null); load(dateStr); }}
        />
      )}
    </div>
  );
}

// ─── Piece Work Modal ──────────────────────────────────────────────────────

function PieceWorkModal({
  workerId,
  workerName,
  date,
  stoneTypes,
  sizes,
  isStaff,
  onClose,
  onSaved,
}: {
  workerId: string;
  workerName: string;
  date: string;
  stoneTypes: Array<{ id: string; name: string }>;
  sizes: Array<{ id: string; label: string }>;
  isStaff: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    operation: "Cutting",
    customOperation: "",
    stoneTypeId: "",
    sizeId: "",
    piecesCompleted: "",
    ratePerPiece: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const operationValue = form.operation === "Other" ? form.customOperation : form.operation;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!operationValue) { setError("Select operation type"); return; }
    if (!form.piecesCompleted || Number(form.piecesCompleted) < 1) { setError("Enter pieces count"); return; }
    if (!isStaff && (!form.ratePerPiece || Number(form.ratePerPiece) < 0)) { setError("Enter rate per piece"); return; }
    setSaving(true);
    setError("");
    const selectedStone = stoneTypes.find((s) => s.id === form.stoneTypeId);
    const selectedSize = sizes.find((s) => s.id === form.sizeId);
    const res = await fetch(`/api/workers/${workerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "piecework",
        date,
        stoneType: operationValue,
        shape: selectedStone?.name || "Various",
        size: selectedSize?.label || "Various",
        piecesCompleted: Number(form.piecesCompleted),
        ratePerPiece: Number(form.ratePerPiece),
        notes: form.notes || undefined,
      }),
    });
    if (res.ok) { onSaved(); } else { setError("Failed to save"); setSaving(false); }
  }

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-bold text-foreground text-lg">Record Work</h2>
            <p className="text-sm text-muted-foreground">{workerName} — {format(parseISO(date), "dd MMM yyyy")}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground text-xl">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Operation */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Operation *</label>
            <div className="grid grid-cols-3 gap-2">
              {OPERATIONS.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => f("operation", op)}
                  className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                    form.operation === op
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-card border-border text-foreground hover:border-amber-300"
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
            {form.operation === "Other" && (
              <input
                value={form.customOperation}
                onChange={(e) => f("customOperation", e.target.value)}
                placeholder="Describe the work"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            )}
          </div>

          {/* Stone type + Size dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Stone Type <span className="font-normal text-muted-foreground/60">(optional)</span></label>
              <select
                value={form.stoneTypeId}
                onChange={(e) => f("stoneTypeId", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">— Mixed / Any —</option>
                {stoneTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Size <span className="font-normal text-muted-foreground/60">(optional)</span></label>
              <select
                value={form.sizeId}
                onChange={(e) => f("sizeId", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">— Various —</option>
                {sizes.map((sz) => (
                  <option key={sz.id} value={sz.id}>{sz.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pieces + Rate row */}
          <div className={`grid ${isStaff ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Pieces Done *</label>
              <input
                type="number"
                min={1}
                value={form.piecesCompleted}
                onChange={(e) => f("piecesCompleted", e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            {!isStaff && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Rate per Piece (₹) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.ratePerPiece}
                onChange={(e) => f("ratePerPiece", e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            )}
          </div>

          {/* Earning preview */}
          {!isStaff && form.piecesCompleted && form.ratePerPiece && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm">
              <span className="text-amber-700">Earning for this entry: </span>
              <span className="font-bold text-amber-800">
                ₹{(Number(form.piecesCompleted) * Number(form.ratePerPiece)).toFixed(0)}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes <span className="font-normal text-muted-foreground/60">(optional)</span></label>
            <input
              value={form.notes}
              onChange={(e) => f("notes", e.target.value)}
              placeholder="Any remarks…"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
