"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";

export const DEPARTMENTS = ["Cutting", "Shaping", "Polishing", "MM", "Sorting", "Packing", "Other"];

const DEPT_COLORS: Record<string, string> = {
  Cutting:  "bg-orange-100 text-orange-700",
  Shaping:  "bg-sky-100 text-sky-700",
  Polishing:"bg-purple-100 text-purple-700",
  MM:       "bg-pink-100 text-pink-700",
  Sorting:  "bg-teal-100 text-teal-700",
  Packing:  "bg-lime-100 text-lime-700",
  Other:    "bg-gray-100 text-muted-foreground",
};
function deptColor(d: string) { return DEPT_COLORS[d] ?? "bg-gray-100 text-muted-foreground"; }

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  payType: string;
  settlementCycle: string;
  dailyWageRate: number | null;
  active: boolean;
  departments: string[];
  _count: { pieceWork: number; attendance: number };
}

const PAY_TYPE_LABELS: Record<string, string> = {
  PER_PIECE: "Per Piece",
  DAILY_WAGES: "Daily Wages",
  MIXED: "Mixed",
};

const CYCLE_LABELS: Record<string, { label: string; color: string }> = {
  WEEKLY:   { label: "Weekly",   color: "bg-blue-100 text-blue-700" },
  MONTHLY:  { label: "Monthly",  color: "bg-purple-100 text-purple-700" },
  PER_WORK: { label: "Per Work", color: "bg-amber-100 text-amber-700" },
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", payType: "DAILY_WAGES", settlementCycle: "MONTHLY",
    dailyWageRate: "", joinDate: "", notes: "", departments: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    const res = await fetch("/api/workers");
    if (res.ok) setWorkers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", phone: "", payType: "DAILY_WAGES", settlementCycle: "MONTHLY", dailyWageRate: "", joinDate: "", notes: "", departments: [] });
    setShowForm(true);
  }
  function openEdit(w: Worker) {
    setEditing(w);
    setForm({
      name: w.name, phone: w.phone ?? "", payType: w.payType,
      settlementCycle: w.settlementCycle ?? "MONTHLY",
      dailyWageRate: w.dailyWageRate ? String(w.dailyWageRate) : "",
      joinDate: "", notes: "", departments: w.departments ?? [],
    });
    setShowForm(true);
  }

  function toggleDept(d: string) {
    setForm((f) => ({
      ...f,
      departments: f.departments.includes(d) ? f.departments.filter((x) => x !== d) : [...f.departments, d],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = editing ? `/api/workers/${editing.id}` : "/api/workers";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone || undefined,
        payType: form.payType,
        settlementCycle: form.settlementCycle,
        dailyWageRate: form.dailyWageRate ? Number(form.dailyWageRate) : undefined,
        joinDate: form.joinDate || undefined,
        notes: form.notes || undefined,
        departments: form.departments,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); setShowForm(false); load(); }
    else toast.error("Something went wrong");
  }

  async function toggleActive(w: Worker) {
    await fetch(`/api/workers/${w.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !w.active }),
    });
    load();
  }

  const filtered = search.trim()
    ? workers.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    : workers;
  const PAGE_SIZE = 10;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage worker profiles, attendance, and payroll</p>
        </div>
        <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          + Add Worker
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search workers by name…"
          className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 text-foreground">{editing ? "Edit Worker" : "Add Worker"}</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="+91 98765 43210" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Pay Type</label>
                  <select value={form.payType} onChange={(e) => setForm({ ...form, payType: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="DAILY_WAGES">Daily Wages</option>
                    <option value="PER_PIECE">Per Piece</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Settlement Cycle</label>
                  <select value={form.settlementCycle} onChange={(e) => setForm({ ...form, settlementCycle: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="PER_WORK">Per Work Done</option>
                  </select>
                </div>
              </div>
              {(form.payType === "DAILY_WAGES" || form.payType === "MIXED") && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Daily Wage Rate (₹)</label>
                  <input type="number" value={form.dailyWageRate} onChange={(e) => setForm({ ...form, dailyWageRate: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Join Date</label>
                <input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              {/* Departments */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Departments</label>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENTS.map((d) => {
                    const on = form.departments.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDept(d)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          on ? `${deptColor(d)} border-transparent` : "bg-background border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {on ? "✓ " : ""}{d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
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

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Departments</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pay Type</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Settlement</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Daily Rate</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5"><div className="h-3.5 bg-muted rounded w-32" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-28" /></td>
                  <td className="px-4 py-3.5"><div className="flex gap-1"><div className="h-5 bg-muted rounded-full w-16" /><div className="h-5 bg-muted rounded-full w-14" /></div></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-20 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-16 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-muted rounded w-12 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 bg-muted rounded-full w-14 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="flex gap-2 justify-end"><div className="h-3 bg-muted rounded w-8" /><div className="h-3 bg-muted rounded w-14" /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Departments</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pay Type</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Settlement</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Daily Rate</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? "No workers match your search" : "No workers yet"}
                </td></tr>
              ) : paginated.map((w) => (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {w.departments?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {w.departments.map((d) => (
                          <span key={d} className={`rounded-full px-2 py-0.5 text-xs font-medium ${deptColor(d)}`}>{d}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                      {PAY_TYPE_LABELS[w.payType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => { const c = CYCLE_LABELS[w.settlementCycle ?? "MONTHLY"]; return (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${c.color}`}>{c.label}</span>
                    ); })()}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">{w.dailyWageRate ? `₹${w.dailyWageRate}` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(w)}
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${w.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                      {w.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(w)} className="mr-3 text-primary hover:underline text-xs">Edit</button>
                    <Link href={`/workers/${w.id}`} className="text-primary hover:underline text-xs">Details →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
