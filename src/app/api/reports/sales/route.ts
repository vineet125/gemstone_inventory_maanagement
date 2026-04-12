import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from       = searchParams.get("from");
  const to         = searchParams.get("to");
  const brokerId   = searchParams.get("brokerId");
  const stoneTypeId = searchParams.get("stoneTypeId");
  const type       = searchParams.get("type"); // "consignment" | "direct" | ""

  const dateFilter = (from || to) ? {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  } : undefined;

  const rows: Record<string, unknown>[] = [];

  // ── Consignments ──────────────────────────────────────────────────────────
  if (!type || type === "consignment") {
    const consignments = await db.consignment.findMany({
      where: {
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(brokerId ? { brokerId } : {}),
      },
      include: {
        broker: { select: { name: true } },
        lines: {
          include: {
            item: {
              select: {
                sku: true,
                stoneType: { select: { id: true, name: true } },
                shape: { select: { name: true } },
                grade: { select: { label: true } },
              },
            },
          },
        },
        invoices: { select: { amountTotal: true, amountPaid: true, status: true } },
      },
      orderBy: { date: "desc" },
    });

    for (const c of consignments) {
      const lines = stoneTypeId
        ? c.lines.filter((l) => l.item.stoneType.id === stoneTypeId)
        : c.lines;
      if (stoneTypeId && lines.length === 0) continue;

      const qtyIssued   = lines.reduce((s, l) => s + l.qtyIssued, 0);
      const qtySold     = lines.reduce((s, l) => s + l.qtySold, 0);
      const saleValue   = lines.reduce((s, l) => s + l.qtySold * (l.actualPricePerUnit ?? l.estPricePerUnit), 0);
      const billed      = c.invoices.reduce((s, i) => s + i.amountTotal, 0);
      const paid        = c.invoices.reduce((s, i) => s + i.amountPaid, 0);
      const stoneNames  = [...new Set(lines.map((l) => l.item.stoneType.name))].join(", ");

      rows.push({
        Date: c.date.toISOString().split("T")[0],
        No: c.consignmentNo,
        Type: "Consignment",
        Party: c.broker.name,
        "Stone Type": stoneNames,
        "Status": c.status,
        "Qty Issued": qtyIssued,
        "Qty Sold": qtySold,
        "Sale Value (₹)": Math.round(saleValue),
        "Billed (₹)": Math.round(billed),
        "Paid (₹)": Math.round(paid),
        "Outstanding (₹)": Math.round(billed - paid),
        "Payment Status": c.invoices[0]?.status ?? "—",
      });
    }
  }

  // ── Direct Sales ──────────────────────────────────────────────────────────
  if (!type || type === "direct") {
    const directSales = await db.directSale.findMany({
      where: { ...(dateFilter ? { date: dateFilter } : {}) },
      include: {
        customer: { select: { name: true } },
        lines: {
          include: {
            item: {
              select: {
                sku: true,
                stoneType: { select: { id: true, name: true } },
              },
            },
          },
        },
        invoices: { select: { amountTotal: true, amountPaid: true, status: true } },
      },
      orderBy: { date: "desc" },
    });

    for (const s of directSales) {
      const lines = stoneTypeId
        ? s.lines.filter((l) => l.item.stoneType.id === stoneTypeId)
        : s.lines;
      if (stoneTypeId && lines.length === 0) continue;

      const qty        = lines.reduce((sum, l) => sum + l.qty, 0);
      const saleValue  = lines.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0);
      const billed     = s.invoices.reduce((sum, i) => sum + i.amountTotal, 0);
      const paid       = s.invoices.reduce((sum, i) => sum + i.amountPaid, 0);
      const stoneNames = [...new Set(lines.map((l) => l.item.stoneType.name))].join(", ");

      rows.push({
        Date: s.date.toISOString().split("T")[0],
        No: s.saleNo,
        Type: "Direct Sale",
        Party: s.customer.name,
        "Stone Type": stoneNames,
        "Status": s.status,
        "Qty Issued": qty,
        "Qty Sold": qty,
        "Sale Value (₹)": Math.round(saleValue),
        "Billed (₹)": Math.round(billed),
        "Paid (₹)": Math.round(paid),
        "Outstanding (₹)": Math.round(billed - paid),
        "Payment Status": s.invoices[0]?.status ?? "—",
      });
    }
  }

  // Sort by date desc
  rows.sort((a, b) => String(b.Date).localeCompare(String(a.Date)));

  return NextResponse.json(rows);
}
