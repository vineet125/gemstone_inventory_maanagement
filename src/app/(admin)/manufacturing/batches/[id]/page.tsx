"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Worker { id: string; name: string; }
interface Vendor { id: string; name: string; }
interface CatalogOpt { id: string; name?: string; label?: string; }
interface Job {
  id: string;
  stage: string;
  entryDate: string;
  exitDate: string | null;
  weightIn: number;
  weightOut: number | null;
  piecesIn: number | null;
  piecesOut: number | null;
  notes: string | null;
  workers: Array<{ user: { id: string; name: string } }>;
  polishingRecord: {
    vendorId: string; vendor: { name: string };
    dateSent: string; dateReceived: string | null;
    costAmount: number | null; qualityNotes: string | null;
    completionStatus: string; defectPieces: number; defectNotes: string | null;
    paidAmount: number; paidDate: string | null;
  } | null;
}
interface Batch {
  id: string;
  batchNo: string;
  stoneType: string | null;
  purchaseType: string;
  supplierName: string;
  purchaseDate: string;
  weightGrams: number;
  weightCarats: number;
  costAmount: number;
  currency: string;
  notes: string | null;
  createdBy: { name: string };
  stages: Job[];
}

const PURCHASE_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  ROUGH_COLLECTION: { label: "🪨 Rough",        cls: "bg-stone-100 text-stone-700" },
  CUTTING:          { label: "✂️ Pre-cut",       cls: "bg-blue-100 text-blue-700" },
  SHAPING:          { label: "💎 Shaped",        cls: "bg-purple-100 text-purple-700" },
  POLISHING:        { label: "✨ Pre-polished",  cls: "bg-amber-100 text-amber-700" },
  INVENTORY_IN:     { label: "📦 Ready Item",    cls: "bg-green-100 text-green-700" },
};

const STAGE_LABELS: Record<string, string> = {
  ROUGH_COLLECTION: "Material Received",
  CUTTING: "Cutting",
  SHAPING: "Shaping",
  POLISHING: "Polishing & Finishing",
  INVENTORY_IN: "Inventory In",
};

const STAGE_BADGE: Record<string, string> = {
  ROUGH_COLLECTION: "bg-stone-100 text-stone-700",
  CUTTING: "bg-blue-100 text-blue-700",
  SHAPING: "bg-purple-100 text-purple-700",
  POLISHING: "bg-amber-100 text-amber-700",
  INVENTORY_IN: "bg-green-100 text-green-700",
};

const STAGE_ORDER = ["ROUGH_COLLECTION", "CUTTING", "SHAPING", "POLISHING", "INVENTORY_IN"];

const emptyForm = () => ({
  stage: "CUTTING",
  entryDate: new Date().toISOString().split("T")[0],
  exitDate: "",
  weightIn: "",
  weightOut: "",
  piecesIn: "",
  piecesOut: "",
  notes: "",
  workerIds: [] as string[],
  // Polishing vendor
  vendorId: "",
  dateSent: new Date().toISOString().split("T")[0],
  dateReceived: "",
  polishingCost: "",
  qualityNotes: "",
  // New polishing completion/payment fields
  completionStatus: "PENDING",
  defectPieces: "",
  defectNotes: "",
  paidAmount: "",
  paidDate: "",
});

export default function BatchDetailPage() {
  const { id } = useParams() as { id: string };
  const isAdmin = useIsAdmin();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [jobForm, setJobForm] = useState(emptyForm());

  // Quick Sell
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellSaving, setSellSaving] = useState(false);
  const [stoneTypes, setStoneTypes] = useState<CatalogOpt[]>([]);
  const [shapes, setShapes] = useState<CatalogOpt[]>([]);
  const [colors, setColors] = useState<CatalogOpt[]>([]);
  const [sizes, setSizes] = useState<CatalogOpt[]>([]);
  const [grades, setGrades] = useState<CatalogOpt[]>([]);
  const [brokers, setBrokers] = useState<{ id: string; name: string }[]>([]);
  const emptySellForm = () => ({
    saleType: "DIRECT" as "DIRECT" | "CONSIGNMENT",
    stoneTypeId: "", shapeId: "", colorId: "", sizeId: "", gradeId: "",
    qtyPieces: "", pricePerUnit: "",
    customerName: "", customerPhone: "",
    brokerId: "",
    notes: "",
  });
  const [sellForm, setSellForm] = useState(emptySellForm());

  async function load() {
    const [bRes, wRes, vRes, stRes, shRes, coRes, siRes, grRes, brRes] = await Promise.all([
      fetch(`/api/manufacturing/batches/${id}`),
      fetch("/api/settings/users"),
      fetch("/api/manufacturing/polishing-vendors"),
      fetch("/api/catalog/stone-types"),
      fetch("/api/settings/shapes"),
      fetch("/api/settings/colors"),
      fetch("/api/settings/sizes"),
      fetch("/api/settings/grades"),
      fetch("/api/brokers"),
    ]);
    if (bRes.ok) setBatch(await bRes.json());
    if (wRes.ok) {
      const users = await wRes.json();
      setWorkers(users.filter((u: { role: string }) => ["WORKER", "STAFF", "MANAGER", "OWNER"].includes(u.role)));
    }
    if (vRes.ok) setVendors(await vRes.json());
    if (stRes.ok) setStoneTypes(await stRes.json());
    if (shRes.ok) setShapes(await shRes.json());
    if (coRes.ok) setColors(await coRes.json());
    if (siRes.ok) setSizes(await siRes.json());
    if (grRes.ok) setGrades(await grRes.json());
    if (brRes.ok) setBrokers(await brRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function openAdd() {
    setJobForm(emptyForm());
    setEditingJobId(null);
    setShowJobForm(true);
  }

  function openEdit(job: Job) {
    setJobForm({
      stage: job.stage,
      entryDate: job.entryDate.split("T")[0],
      exitDate: job.exitDate ? job.exitDate.split("T")[0] : "",
      weightIn: String(job.weightIn),
      weightOut: job.weightOut != null ? String(job.weightOut) : "",
      piecesIn: job.piecesIn != null ? String(job.piecesIn) : "",
      piecesOut: job.piecesOut != null ? String(job.piecesOut) : "",
      notes: job.notes ?? "",
      workerIds: job.workers.map((w) => w.user.id),
      vendorId: job.polishingRecord ? job.polishingRecord.vendorId ?? "" : "",
      dateSent: job.polishingRecord ? job.polishingRecord.dateSent.split("T")[0] : new Date().toISOString().split("T")[0],
      dateReceived: job.polishingRecord?.dateReceived ? job.polishingRecord.dateReceived.split("T")[0] : "",
      polishingCost: job.polishingRecord?.costAmount != null ? String(job.polishingRecord.costAmount) : "",
      qualityNotes: job.polishingRecord?.qualityNotes ?? "",
      completionStatus: job.polishingRecord?.completionStatus ?? "PENDING",
      defectPieces: job.polishingRecord?.defectPieces != null ? String(job.polishingRecord.defectPieces) : "",
      defectNotes: job.polishingRecord?.defectNotes ?? "",
      paidAmount: job.polishingRecord?.paidAmount != null ? String(job.polishingRecord.paidAmount) : "",
      paidDate: job.polishingRecord?.paidDate ? job.polishingRecord.paidDate.split("T")[0] : "",
    });
    setEditingJobId(job.id);
    setShowJobForm(true);
  }

  async function deleteJob(jobId: string) {
    if (!confirm("Delete this job entry? This cannot be undone.")) return;
    const res = await fetch(`/api/manufacturing/stages/${jobId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Job deleted"); load(); }
    else toast.error("Failed to delete");
  }

  async function saveJob() {
    if (!jobForm.weightIn) { toast.error("Weight In is required"); return; }
    if (jobForm.stage === "POLISHING" && jobForm.vendorId && !jobForm.dateSent) {
      toast.error("Date Sent to vendor is required"); return;
    }
    setSaving(true);

    const payload = {
      stage: jobForm.stage,
      entryDate: jobForm.entryDate,
      exitDate: jobForm.exitDate || null,
      weightIn: Number(jobForm.weightIn),
      weightOut: jobForm.weightOut ? Number(jobForm.weightOut) : null,
      piecesIn: jobForm.piecesIn ? Number(jobForm.piecesIn) : null,
      piecesOut: jobForm.piecesOut ? Number(jobForm.piecesOut) : null,
      notes: jobForm.notes || null,
      workerIds: jobForm.workerIds,
      // Polishing vendor (only sent when POLISHING stage)
      ...(jobForm.stage === "POLISHING" && jobForm.vendorId ? {
        vendorId: jobForm.vendorId,
        dateSent: jobForm.dateSent,
        dateReceived: jobForm.dateReceived || null,
        polishingCost: jobForm.polishingCost ? Number(jobForm.polishingCost) : null,
        qualityNotes: jobForm.qualityNotes || null,
        completionStatus: jobForm.completionStatus || "PENDING",
        defectPieces: jobForm.defectPieces ? Number(jobForm.defectPieces) : 0,
        defectNotes: jobForm.defectNotes || null,
        paidAmount: jobForm.paidAmount ? Number(jobForm.paidAmount) : 0,
        paidDate: jobForm.paidDate || null,
      } : {}),
    };

    let res: Response;
    if (editingJobId) {
      res = await fetch(`/api/manufacturing/stages/${editingJobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch("/api/manufacturing/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: id, ...payload }),
      });
    }

    setSaving(false);
    if (res.ok) {
      toast.success(editingJobId ? "Job updated" : "Job added");
      setShowJobForm(false);
      setEditingJobId(null);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      const errMsg = typeof d.error === "string"
        ? d.error
        : d.error?.formErrors?.[0]
          ?? Object.entries(d.error?.fieldErrors ?? {})[0]?.join(": ")
          ?? "Failed to save";
      toast.error(errMsg);
    }
  }

  async function submitSell() {
    if (!sellForm.stoneTypeId) { toast.error("Select stone type"); return; }
    if (!sellForm.shapeId) { toast.error("Select shape"); return; }
    if (!sellForm.colorId) { toast.error("Select color"); return; }
    if (!sellForm.sizeId) { toast.error("Select size"); return; }
    if (!sellForm.gradeId) { toast.error("Select grade"); return; }
    if (!sellForm.qtyPieces || Number(sellForm.qtyPieces) <= 0) { toast.error("Enter quantity"); return; }
    if (!sellForm.pricePerUnit || Number(sellForm.pricePerUnit) <= 0) { toast.error("Enter price per piece"); return; }
    if (sellForm.saleType === "DIRECT" && !sellForm.customerName) { toast.error("Enter customer name"); return; }
    if (sellForm.saleType === "CONSIGNMENT" && !sellForm.brokerId) { toast.error("Select a broker"); return; }

    setSellSaving(true);
    const res = await fetch(`/api/manufacturing/batches/${id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleType: sellForm.saleType,
        stoneTypeId: sellForm.stoneTypeId,
        shapeId: sellForm.shapeId,
        colorId: sellForm.colorId,
        sizeId: sellForm.sizeId,
        gradeId: sellForm.gradeId,
        qtyPieces: Number(sellForm.qtyPieces),
        pricePerUnit: Number(sellForm.pricePerUnit),
        ...(sellForm.saleType === "DIRECT" ? {
          customerName: sellForm.customerName,
          customerPhone: sellForm.customerPhone || undefined,
        } : {
          brokerId: sellForm.brokerId,
        }),
        notes: sellForm.notes || undefined,
      }),
    });
    setSellSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Failed to create sale");
      return;
    }
    const { refNo, saleType: type } = await res.json();
    toast.success(`${type === "CONSIGNMENT" ? "Consignment" : "Sale"} created: ${refNo}`);
    setShowSellModal(false);
    setSellForm(emptySellForm());
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>;
  if (!batch) return <div className="p-8 text-center text-sm text-red-500">Batch not found</div>;

  // Stock calculations — only CUTTING stages consume rough stock
  const distributedGrams = batch.stages
    .filter((j) => j.stage === "CUTTING")
    .reduce((s, j) => s + j.weightIn, 0);
  const remainingGrams = batch.weightGrams - distributedGrams;
  const activeJobs = batch.stages.filter((j) => !j.exitDate);
  const completedJobs = batch.stages.filter((j) => !!j.exitDate);

  function yieldPct(weightIn: number, weightOut: number | null) {
    if (!weightOut) return null;
    return ((weightOut / weightIn) * 100).toFixed(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/manufacturing/batches" className="text-sm text-muted-foreground hover:text-foreground">← Purchase Orders</Link>
        <h1 className="text-2xl font-bold text-foreground">PO {batch.batchNo}</h1>
      </div>

      {/* Batch info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Purchase Type</p>
          <div className="mt-1">
            {(() => {
              const b = PURCHASE_TYPE_BADGE[batch.purchaseType ?? "ROUGH_COLLECTION"] ?? PURCHASE_TYPE_BADGE.ROUGH_COLLECTION;
              return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>;
            })()}
          </div>
        </div>
        {[
          { label: "Supplier", value: batch.supplierName },
          { label: "Purchase Date", value: format(new Date(batch.purchaseDate), "dd MMM yyyy") },
          { label: "Weight Purchased", value: `${batch.weightGrams.toLocaleString()} g / ${batch.weightCarats.toLocaleString()} ct` },
          { label: "Cost", value: `${batch.currency} ${batch.costAmount.toLocaleString("en-IN")}` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-semibold text-foreground text-sm">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Rough stock summary */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Material Stock Status</h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-center">
            <p className="text-xs text-stone-500 mb-1">Purchased</p>
            <p className="text-xl font-bold text-stone-800">{batch.weightGrams.toLocaleString()} g</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-xs text-blue-500 mb-1">Distributed to Jobs</p>
            <p className="text-xl font-bold text-blue-800">{distributedGrams.toLocaleString()} g</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${remainingGrams < 0 ? "bg-red-50 border-red-200" : remainingGrams === 0 ? "bg-muted/40 border-border" : "bg-green-50 border-green-200"}`}>
            <p className={`text-xs mb-1 ${remainingGrams < 0 ? "text-red-500" : remainingGrams === 0 ? "text-muted-foreground" : "text-green-500"}`}>
              Remaining in Stock
            </p>
            <p className={`text-xl font-bold ${remainingGrams < 0 ? "text-red-700" : remainingGrams === 0 ? "text-muted-foreground" : "text-green-700"}`}>
              {remainingGrams.toLocaleString()} g
              {remainingGrams < 0 && <span className="text-xs font-normal ml-1">(check entries)</span>}
            </p>
          </div>
        </div>
        {batch.notes && <p className="mt-3 text-xs text-muted-foreground/60 italic">{batch.notes}</p>}
      </div>

      {/* Jobs from this batch */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Processing Jobs</h2>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {activeJobs.length} active · {completedJobs.length} completed · {batch.stages.length} total
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setSellForm(emptySellForm()); setShowSellModal(true); }}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
              💰 Quick Sell
            </button>
            <button onClick={openAdd}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              + New Job
            </button>
          </div>
        </div>

        {batch.stages.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground/60">No jobs yet. Click "+ New Job" to create a processing job from this batch.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batch.stages.map((job, idx) => (
              <div key={job.id} className={`rounded-lg border p-4 ${!job.exitDate ? "border-blue-200 bg-blue-50/30" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_BADGE[job.stage] ?? "bg-gray-100 text-muted-foreground"}`}>
                      {STAGE_LABELS[job.stage] ?? job.stage}
                    </span>
                    <span className="text-xs text-muted-foreground">Job #{idx + 1}</span>
                    {!job.exitDate
                      ? <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">In Progress</span>
                      : <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">✓ Completed</span>
                    }
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground/60">
                      {format(new Date(job.entryDate), "dd MMM yyyy")}
                      {job.exitDate && ` → ${format(new Date(job.exitDate), "dd MMM yyyy")}`}
                    </span>
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(job)} className="text-xs text-primary hover:underline">Edit</button>
                        <button onClick={() => deleteJob(job.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                  <div><span className="text-muted-foreground text-xs">Weight In:</span> <span className="font-medium">{job.weightIn.toLocaleString()} g</span></div>
                  <div>
                    <span className="text-muted-foreground text-xs">Weight Out:</span>{" "}
                    <span className="font-medium">{job.weightOut != null ? `${job.weightOut} g` : "—"}</span>
                  </div>
                  {job.piecesIn != null && <div><span className="text-xs text-muted-foreground">Pieces In:</span> {job.piecesIn}</div>}
                  {job.piecesOut != null && <div><span className="text-xs text-muted-foreground">Pieces Out:</span> {job.piecesOut}</div>}
                  {job.weightOut != null && (
                    <div>
                      <span className="text-xs text-muted-foreground">Yield:</span>{" "}
                      <span className={`font-semibold ${Number(yieldPct(job.weightIn, job.weightOut)) < 70 ? "text-red-600" : "text-green-600"}`}>
                        {yieldPct(job.weightIn, job.weightOut)}%
                      </span>
                    </div>
                  )}
                </div>

                {job.workers.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Workers: {job.workers.map((w) => w.user.name).join(", ")}
                  </p>
                )}
                {job.polishingRecord && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-amber-700 font-medium">✨ {job.polishingRecord.vendor.name}</span>
                      <span className="text-muted-foreground">
                        Sent {format(new Date(job.polishingRecord.dateSent), "dd MMM")}
                        {job.polishingRecord.dateReceived ? ` → ${format(new Date(job.polishingRecord.dateReceived), "dd MMM")}` : " (pending)"}
                      </span>
                      {job.polishingRecord.costAmount ? <span className="text-muted-foreground">₹{job.polishingRecord.costAmount.toLocaleString()}</span> : null}
                      {(() => {
                        const cs = job.polishingRecord.completionStatus;
                        const cls =
                          cs === "COMPLETED" ? "bg-green-100 text-green-700" :
                          cs === "PARTIAL" ? "bg-amber-100 text-amber-700" :
                          cs === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-muted-foreground";
                        const label = cs === "COMPLETED" ? "Completed" : cs === "PARTIAL" ? "Partial" : cs === "IN_PROGRESS" ? "In Progress" : "Pending";
                        return <span className={`rounded-full px-2 py-0.5 font-semibold ${cls}`}>{label}</span>;
                      })()}
                    </div>
                    {job.polishingRecord.defectPieces > 0 && (
                      <p className="text-red-600 font-medium">⚠ {job.polishingRecord.defectPieces} defective piece{job.polishingRecord.defectPieces !== 1 ? "s" : ""}
                        {job.polishingRecord.defectNotes ? `: ${job.polishingRecord.defectNotes}` : ""}
                      </p>
                    )}
                    {job.polishingRecord.costAmount != null && (
                      job.polishingRecord.paidAmount >= job.polishingRecord.costAmount
                        ? <p className="text-green-700">✓ Paid ₹{job.polishingRecord.paidAmount.toLocaleString()}</p>
                        : <p className="text-amber-700">⚠ Unpaid ₹{job.polishingRecord.costAmount.toLocaleString()}{job.polishingRecord.paidAmount > 0 ? ` (₹${job.polishingRecord.paidAmount.toLocaleString()} paid)` : ""}</p>
                    )}
                  </div>
                )}
                {job.notes && <p className="mt-1 text-xs text-muted-foreground/60 italic">{job.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Job Modal */}
      {showJobForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-2">
              {editingJobId ? "Edit Job" : "New Job — PO " + batch.batchNo}
            </h2>

            {!editingJobId && (
              <div className="mb-4 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-700">
                <span className="font-semibold">Material remaining in PO:</span>{" "}
                <span className={remainingGrams < 0 ? "text-red-600 font-bold" : "font-semibold text-green-700"}>
                  {remainingGrams.toLocaleString()} g
                </span>
                {remainingGrams <= 0 && <span className="ml-2 text-red-500">⚠ No material remaining — please check existing entries</span>}
              </div>
            )}

            <div className={`grid grid-cols-2 gap-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Stage / Job Type *</label>
                <select value={jobForm.stage} onChange={(e) => setJobForm({ ...jobForm, stage: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Rough source selector — only for CUTTING */}
              {jobForm.stage === "CUTTING" && remainingGrams > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Select Amount to Distribute *</label>
                  <select
                    value={jobForm.weightIn}
                    onChange={(e) => setJobForm({ ...jobForm, weightIn: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm">
                    <option value="">— pick amount to use —</option>
                    <option value={remainingGrams}>{remainingGrams.toLocaleString()} g (full remaining)</option>
                    {[0.75, 0.5, 0.25].map((f) => {
                      const v = Math.round(remainingGrams * f);
                      if (v <= 0) return null;
                      return <option key={f} value={v}>{v.toLocaleString()} g ({Math.round(f * 100)}% of remaining)</option>;
                    })}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground/60">Or type a custom amount in Weight In below.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date Sent *</label>
                <input type="date" value={jobForm.entryDate} onChange={(e) => setJobForm({ ...jobForm, entryDate: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date Returned / Done</label>
                <input type="date" value={jobForm.exitDate} onChange={(e) => setJobForm({ ...jobForm, exitDate: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Weight In (g) *</label>
                <input type="number" value={jobForm.weightIn} onChange={(e) => setJobForm({ ...jobForm, weightIn: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Weight Out (g)</label>
                <input type="number" value={jobForm.weightOut} onChange={(e) => setJobForm({ ...jobForm, weightOut: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                {jobForm.weightIn && jobForm.weightOut && Number(jobForm.weightOut) > 0 && (
                  <p className={`mt-1 text-xs font-semibold ${(Number(jobForm.weightOut) / Number(jobForm.weightIn)) * 100 < 70 ? "text-red-600" : "text-green-600"}`}>
                    Yield: {((Number(jobForm.weightOut) / Number(jobForm.weightIn)) * 100).toFixed(1)}%
                    {(Number(jobForm.weightOut) / Number(jobForm.weightIn)) * 100 < 70 ? " ⚠ Low" : " ✓"}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pieces In</label>
                <input type="number" value={jobForm.piecesIn} onChange={(e) => setJobForm({ ...jobForm, piecesIn: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pieces Out</label>
                <input type="number" value={jobForm.piecesOut} onChange={(e) => setJobForm({ ...jobForm, piecesOut: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              {workers.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Workers</label>
                  <div className="flex flex-wrap gap-2">
                    {workers.map((w) => (
                      <label key={w.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="checkbox" checked={jobForm.workerIds.includes(w.id)}
                          onChange={(e) => setJobForm({
                            ...jobForm,
                            workerIds: e.target.checked
                              ? [...jobForm.workerIds, w.id]
                              : jobForm.workerIds.filter((wid) => wid !== w.id),
                          })} />
                        {w.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Polishing vendor section */}
              {jobForm.stage === "POLISHING" && (
                <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-800">✨ Polishing Vendor (optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-foreground mb-1">Vendor</label>
                      <select value={jobForm.vendorId}
                        onChange={(e) => setJobForm({ ...jobForm, vendorId: e.target.value })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                        <option value="">— No vendor / In-house —</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    {jobForm.vendorId && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Date Sent *</label>
                          <input type="date" value={jobForm.dateSent}
                            onChange={(e) => setJobForm({ ...jobForm, dateSent: e.target.value })}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Date Received</label>
                          <input type="date" value={jobForm.dateReceived}
                            onChange={(e) => setJobForm({ ...jobForm, dateReceived: e.target.value })}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-foreground mb-1">Polishing Cost (INR)</label>
                          <input type="number" value={jobForm.polishingCost}
                            onChange={(e) => setJobForm({ ...jobForm, polishingCost: e.target.value })}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Optional" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-foreground mb-1">Quality Notes</label>
                          <input value={jobForm.qualityNotes}
                            onChange={(e) => setJobForm({ ...jobForm, qualityNotes: e.target.value })}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Optional" />
                        </div>
                        <div className="col-span-2 border-t border-amber-200 pt-3">
                          <p className="text-xs font-semibold text-amber-800 mb-2">Completion &amp; Payment</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-foreground mb-1">Completion Status</label>
                              <select value={jobForm.completionStatus}
                                onChange={(e) => setJobForm({ ...jobForm, completionStatus: e.target.value })}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                            </div>
                            {(jobForm.completionStatus === "PARTIAL" || jobForm.completionStatus === "COMPLETED") && (
                              <>
                                <div>
                                  <label className="block text-xs font-medium text-foreground mb-1">Defect Pieces</label>
                                  <input type="number" min={0} value={jobForm.defectPieces}
                                    onChange={(e) => setJobForm({ ...jobForm, defectPieces: e.target.value })}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="0" />
                                </div>
                                {Number(jobForm.defectPieces) > 0 && (
                                  <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Defect Notes</label>
                                    <input value={jobForm.defectNotes}
                                      onChange={(e) => setJobForm({ ...jobForm, defectNotes: e.target.value })}
                                      className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Describe defects" />
                                  </div>
                                )}
                              </>
                            )}
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Paid Amount (₹)</label>
                              <input type="number" min={0} value={jobForm.paidAmount}
                                onChange={(e) => setJobForm({ ...jobForm, paidAmount: e.target.value })}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="0" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Payment Date</label>
                              <input type="date" value={jobForm.paidDate}
                                onChange={(e) => setJobForm({ ...jobForm, paidDate: e.target.value })}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowJobForm(false); setEditingJobId(null); }}
                disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={saveJob} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : editingJobId ? "Update Job" : "Add Job"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Sell Modal */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-1">Quick Sell — PO {batch.batchNo}</h2>
            <p className="text-xs text-muted-foreground mb-4">Creates a sale without going through full manufacturing stages.</p>

            {/* Sale type toggle */}
            <div className={`flex rounded-lg border border-border overflow-hidden mb-4${sellSaving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              {(["DIRECT", "CONSIGNMENT"] as const).map((t) => (
                <button key={t}
                  onClick={() => setSellForm({ ...sellForm, saleType: t })}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    sellForm.saleType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-accent"
                  }`}>
                  {t === "DIRECT" ? "👤 Direct Sale" : "🤝 Via Broker"}
                </button>
              ))}
            </div>

            <div className={`grid grid-cols-2 gap-3${sellSaving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">Stone Type *</label>
                <select value={sellForm.stoneTypeId}
                  onChange={(e) => setSellForm({ ...sellForm, stoneTypeId: e.target.value, colorId: "" })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {stoneTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Shape *</label>
                <select value={sellForm.shapeId}
                  onChange={(e) => setSellForm({ ...sellForm, shapeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Color *</label>
                <select value={sellForm.colorId}
                  onChange={(e) => setSellForm({ ...sellForm, colorId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {colors
                    .filter((c) => !sellForm.stoneTypeId || (c as {stoneTypeId?: string}).stoneTypeId === sellForm.stoneTypeId)
                    .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Size *</label>
                <select value={sellForm.sizeId}
                  onChange={(e) => setSellForm({ ...sellForm, sizeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Grade *</label>
                <select value={sellForm.gradeId}
                  onChange={(e) => setSellForm({ ...sellForm, gradeId: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Qty (pieces) *</label>
                <input type="number" min={1} value={sellForm.qtyPieces}
                  onChange={(e) => setSellForm({ ...sellForm, qtyPieces: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. 100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {sellForm.saleType === "CONSIGNMENT" ? "Est. Price / piece (₹) *" : "Price / piece (₹) *"}
                </label>
                <input type="number" min={0} value={sellForm.pricePerUnit}
                  onChange={(e) => setSellForm({ ...sellForm, pricePerUnit: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g. 250" />
              </div>
              {sellForm.qtyPieces && sellForm.pricePerUnit && (
                <div className="col-span-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
                  {sellForm.saleType === "CONSIGNMENT" ? "Est. Total" : "Total"}: ₹{(Number(sellForm.qtyPieces) * Number(sellForm.pricePerUnit)).toLocaleString("en-IN")}
                </div>
              )}

              {sellForm.saleType === "DIRECT" ? (
                <>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Customer Name *</label>
                    <input value={sellForm.customerName}
                      onChange={(e) => setSellForm({ ...sellForm, customerName: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Customer name" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Customer Phone</label>
                    <input value={sellForm.customerPhone}
                      onChange={(e) => setSellForm({ ...sellForm, customerPhone: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Optional" />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Broker *</label>
                  <select value={sellForm.brokerId}
                    onChange={(e) => setSellForm({ ...sellForm, brokerId: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                    <option value="">— Select broker —</option>
                    {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {brokers.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">No brokers found — add one in the Brokers section first.</p>
                  )}
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea value={sellForm.notes}
                  onChange={(e) => setSellForm({ ...sellForm, notes: e.target.value })}
                  rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowSellModal(false)}
                disabled={sellSaving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={submitSell} disabled={sellSaving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {sellSaving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {sellSaving ? "Creating..." : sellForm.saleType === "CONSIGNMENT" ? "Create Consignment" : "Create Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
