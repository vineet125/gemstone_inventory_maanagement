"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { toast } from "sonner";

interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY";
  notes: string | null;
}

interface PieceWorkRecord {
  id: string;
  date: string;
  stoneType: string;
  shape: string;
  size: string;
  piecesCompleted: number;
  ratePerPiece: number;
  currency: string;
  notes: string | null;
}

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  payType: "PER_PIECE" | "DAILY_WAGES" | "MIXED";
  dailyWageRate: number | null;
  active: boolean;
  notifyWhatsapp: boolean;
  notes: string | null;
  attendance: AttendanceRecord[];
  pieceWork: PieceWorkRecord[];
}

const PAY_TYPE_LABELS: Record<string, string> = {
  PER_PIECE: "Per Piece",
  DAILY_WAGES: "Daily Wages",
  MIXED: "Mixed",
};

const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: "bg-green-400",
  ABSENT: "bg-red-300",
  HALF_DAY: "bg-yellow-300",
};

export default function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const [calendarMonth] = useState(today);

  // Attendance modal
  const [showAttModal, setShowAttModal] = useState(false);
  const [attForm, setAttForm] = useState({ date: format(today, "yyyy-MM-dd"), status: "PRESENT", notes: "" });

  // Piece work modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ date: format(today, "yyyy-MM-dd"), stoneType: "", shape: "", size: "", piecesCompleted: 1, ratePerPiece: 0, currency: "INR", notes: "" });

  async function load() {
    const res = await fetch(`/api/workers/${id}`);
    if (res.ok) setWorker(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function toggleNotify() {
    if (!worker) return;
    await fetch(`/api/workers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyWhatsapp: !worker.notifyWhatsapp }),
    });
    load();
  }

  async function saveAttendance() {
    setSaving(true);
    const res = await fetch(`/api/workers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "attendance", ...attForm }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Attendance saved"); setShowAttModal(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  async function savePieceWork() {
    if (!pwForm.stoneType || !pwForm.shape || !pwForm.size || !pwForm.piecesCompleted || !pwForm.ratePerPiece) {
      toast.error("Fill all required fields");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/workers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "piecework", ...pwForm }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Piece work recorded"); setShowPwModal(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>;
  if (!worker) return <div className="p-8 text-center text-sm text-red-400">Worker not found.</div>;

  // Earnings calculations
  const presentDays = worker.attendance.filter((a) => a.status === "PRESENT").length;
  const halfDays = worker.attendance.filter((a) => a.status === "HALF_DAY").length;
  const dailyEarnings = worker.dailyWageRate ? (presentDays + halfDays * 0.5) * worker.dailyWageRate : 0;
  const pieceEarnings = worker.pieceWork.reduce((s, p) => s + p.piecesCompleted * p.ratePerPiece, 0);
  const totalEarnings = dailyEarnings + pieceEarnings;

  // Calendar for current month
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  function getAttendanceForDay(day: Date) {
    return worker?.attendance.find((a) => isSameDay(new Date(a.date), day));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/workers" className="text-sm text-muted-foreground/60 hover:text-muted-foreground">← All Workers</Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{worker.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {PAY_TYPE_LABELS[worker.payType]}
            {worker.dailyWageRate ? ` · ₹${worker.dailyWageRate.toLocaleString("en-IN")}/day` : ""}
            {worker.phone ? ` · ${worker.phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${worker.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
            {worker.active ? "Active" : "Inactive"}
          </span>
          <button
            onClick={toggleNotify}
            title={worker.notifyWhatsapp ? "Click to disable WA notifications" : worker.phone ? "Click to enable WA notifications" : "Add phone number first"}
            disabled={!worker.phone}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${worker.notifyWhatsapp ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-muted-foreground hover:bg-gray-200"} disabled:opacity-40 disabled:cursor-not-allowed`}>
            {worker.notifyWhatsapp ? "💬 WA On" : "💬 WA Off"}
          </button>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Days Present</p>
          <p className="text-2xl font-bold text-green-600">{presentDays}</p>
          {halfDays > 0 && <p className="text-xs text-yellow-500">{halfDays} half-days</p>}
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Daily Earnings</p>
          <p className="text-2xl font-bold text-foreground">₹{dailyEarnings.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Piece Work</p>
          <p className="text-2xl font-bold text-foreground">₹{pieceEarnings.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Earnings</p>
          <p className="text-2xl font-bold text-primary">₹{totalEarnings.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Calendar */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Attendance — {format(calendarMonth, "MMMM yyyy")}
            </h2>
            <button onClick={() => setShowAttModal(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              + Add
            </button>
          </div>

          {/* Legend */}
          <div className="flex gap-3 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Present</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-300 inline-block" />Half Day</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" />Absent</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-xs text-muted-foreground/60 font-medium py-1">{d}</div>
            ))}
            {/* Offset for first day of month */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`offset-${i}`} />
            ))}
            {daysInMonth.map((day) => {
              const att = getAttendanceForDay(day);
              return (
                <div key={day.toISOString()}
                  className="relative flex items-center justify-center aspect-square rounded-lg text-xs font-medium"
                  title={att ? att.status : undefined}>
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs
                    ${att ? `${ATTENDANCE_COLORS[att.status]} text-white` : "text-muted-foreground"}`}>
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Recent attendance list */}
          {worker.attendance.length > 0 && (
            <div className="mt-4 border-t pt-3 space-y-1.5 max-h-40 overflow-y-auto">
              {worker.attendance.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{format(new Date(a.date), "dd MMM yyyy")}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 font-medium
                    ${a.status === "PRESENT" ? "bg-green-100 text-green-700" : a.status === "HALF_DAY" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                    {a.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Piece Work Log */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Piece Work Log</h2>
            <button onClick={() => setShowPwModal(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              + Record
            </button>
          </div>
          {worker.pieceWork.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 py-4 text-center">No piece work recorded</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {worker.pieceWork.map((pw) => (
                <div key={pw.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {pw.stoneType} · {pw.shape} · {pw.size}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pw.piecesCompleted} pcs × ₹{pw.ratePerPiece}/pc
                      </p>
                      {pw.notes && <p className="text-xs text-muted-foreground/60 mt-0.5">{pw.notes}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-foreground">₹{(pw.piecesCompleted * pw.ratePerPiece).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground/60">{format(new Date(pw.date), "dd MMM")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {worker.notes && (
        <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-800">
          <span className="font-medium">Notes: </span>{worker.notes}
        </div>
      )}

      {/* Attendance Modal */}
      {showAttModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Record Attendance</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date *</label>
                <input type="date" value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status *</label>
                <select value={attForm.status} onChange={(e) => setAttForm({ ...attForm, status: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="PRESENT">Present</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <input value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAttModal(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={saveAttendance} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Piece Work Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Record Piece Work</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date *</label>
                <input type="date" value={pwForm.date} onChange={(e) => setPwForm({ ...pwForm, date: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Stone Type *</label>
                  <input value={pwForm.stoneType} onChange={(e) => setPwForm({ ...pwForm, stoneType: e.target.value })}
                    className="w-full rounded-lg border border-border px-2 py-2 text-sm" placeholder="Citrine" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Shape *</label>
                  <input value={pwForm.shape} onChange={(e) => setPwForm({ ...pwForm, shape: e.target.value })}
                    className="w-full rounded-lg border border-border px-2 py-2 text-sm" placeholder="Oval" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Size *</label>
                  <input value={pwForm.size} onChange={(e) => setPwForm({ ...pwForm, size: e.target.value })}
                    className="w-full rounded-lg border border-border px-2 py-2 text-sm" placeholder="6x4" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Pieces *</label>
                  <input type="number" value={pwForm.piecesCompleted} onChange={(e) => setPwForm({ ...pwForm, piecesCompleted: Number(e.target.value) })}
                    min={1} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Rate / pc (₹) *</label>
                  <input type="number" value={pwForm.ratePerPiece} onChange={(e) => setPwForm({ ...pwForm, ratePerPiece: Number(e.target.value) })}
                    min={0} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
              </div>
              {pwForm.piecesCompleted > 0 && pwForm.ratePerPiece > 0 && (
                <p className="text-sm font-medium text-foreground">
                  Total: ₹{(pwForm.piecesCompleted * pwForm.ratePerPiece).toLocaleString("en-IN")}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <input value={pwForm.notes} onChange={(e) => setPwForm({ ...pwForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowPwModal(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={savePieceWork} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
