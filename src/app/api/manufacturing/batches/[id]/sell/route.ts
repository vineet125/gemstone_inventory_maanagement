import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  saleType: z.enum(["DIRECT", "CONSIGNMENT"]).default("DIRECT"),
  // Direct sale fields
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  paymentDays: z.number().int().default(90),
  // Consignment fields
  brokerId: z.string().optional(),
  // Common dimension fields
  stoneTypeId: z.string().min(1),
  shapeId: z.string().min(1),
  colorId: z.string().min(1),
  sizeId: z.string().min(1),
  gradeId: z.string().min(1),
  qtyPieces: z.number().int().positive(),
  pricePerUnit: z.number().positive(),
  weightGrams: z.number().positive().optional(),
  notes: z.string().optional(),
});

function nextSaleNo() {
  const d = new Date();
  return `SALE-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

function nextConsignmentNo() {
  const d = new Date();
  return `CON-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

function generateSku(type: string, shape: string, size: string, color: string, grade: string) {
  const abbrev = (s: string, n: number) => s.replace(/\s+/g, "").substring(0, n).toUpperCase();
  return `${abbrev(type, 3)}-${abbrev(shape, 3)}-${size.toUpperCase()}-${abbrev(color, 3)}-${abbrev(grade, 3)}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;

  const batch = await db.roughBatch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { saleType, customerName, customerPhone, brokerId, stoneTypeId, shapeId, colorId, sizeId, gradeId, qtyPieces, pricePerUnit, paymentDays, notes, weightGrams } = parsed.data;

  if (saleType === "DIRECT" && !customerName) {
    return NextResponse.json({ error: "Customer name is required for direct sale" }, { status: 400 });
  }
  if (saleType === "CONSIGNMENT" && !brokerId) {
    return NextResponse.json({ error: "Broker is required for consignment" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    // Find or create InventoryItem with matching dimensions
    let item = await tx.inventoryItem.findFirst({
      where: { stoneTypeId, shapeId, colorId, sizeId, gradeId },
    });

    if (!item) {
      const [stoneType, shape, size, color, grade] = await Promise.all([
        tx.stoneType.findUnique({ where: { id: stoneTypeId }, select: { name: true } }),
        tx.stoneShape.findUnique({ where: { id: shapeId }, select: { name: true } }),
        tx.stoneSize.findUnique({ where: { id: sizeId }, select: { label: true } }),
        tx.stoneColor.findUnique({ where: { id: colorId }, select: { name: true } }),
        tx.stoneGrade.findUnique({ where: { id: gradeId }, select: { label: true } }),
      ]);
      if (!stoneType || !shape || !size || !color || !grade) {
        throw new Error("Invalid dimension ID");
      }
      const baseSku = generateSku(stoneType.name, shape.name, size.label, color.name, grade.label);
      let sku = baseSku;
      let suffix = 1;
      while (await tx.inventoryItem.findUnique({ where: { sku } })) {
        sku = `${baseSku}-${suffix++}`;
      }
      item = await tx.inventoryItem.create({
        data: {
          sku, stoneTypeId, shapeId, colorId, sizeId, gradeId,
          qtyPieces: 0,
          weightPerPieceGrams: weightGrams && qtyPieces ? weightGrams / qtyPieces : undefined,
          currency: "INR",
        },
      });
    }

    // Deduct stock (shared for both paths)
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { qtyPieces: { decrement: qtyPieces } },
    });

    if (saleType === "DIRECT") {
      let customer = await tx.customer.findFirst({ where: { name: customerName! } });
      if (!customer) {
        customer = await tx.customer.create({
          data: { name: customerName!, phoneWhatsapp: customerPhone, contactPhone: customerPhone },
        });
      }
      const saleNo = nextSaleNo();
      const totalAmount = qtyPieces * pricePerUnit;
      const saleDate = new Date();
      const dueDate = new Date(saleDate);
      dueDate.setDate(dueDate.getDate() + paymentDays);

      const s = await tx.directSale.create({
        data: {
          saleNo,
          customerId: customer.id,
          date: saleDate,
          status: "COMPLETED",
          notes: notes ?? `Quick sell from PO ${batch.batchNo}`,
          lines: {
            create: [{ itemId: item.id, qty: qtyPieces, pricePerUnit, currency: "INR" }],
          },
          invoices: {
            create: {
              invoiceNo: `INV-${saleNo}`,
              type: "DIRECT_SALE",
              amountTotal: totalAmount,
              currency: "INR",
              paymentDays,
              dueDate,
              status: "PENDING",
            },
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          movementType: "STOCK_OUT_DIRECT_SALE",
          qtyChange: -qtyPieces,
          referenceId: s.id,
          referenceType: "DIRECT_SALE",
          createdById: session!.user.id,
        },
      });

      return { saleType: "DIRECT", refNo: saleNo, saleId: s.id };
    } else {
      // CONSIGNMENT
      const consignmentNo = nextConsignmentNo();
      const c = await tx.consignment.create({
        data: {
          consignmentNo,
          brokerId: brokerId!,
          date: new Date(),
          status: "ACTIVE",
          notes: notes ?? `Quick consignment from PO ${batch.batchNo}`,
          lines: {
            create: [{ itemId: item.id, qtyIssued: qtyPieces, estPricePerUnit: pricePerUnit, currency: "INR" }],
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          movementType: "STOCK_OUT_CONSIGNMENT",
          qtyChange: -qtyPieces,
          referenceId: c.id,
          referenceType: "CONSIGNMENT",
          createdById: session!.user.id,
        },
      });

      return { saleType: "CONSIGNMENT", refNo: consignmentNo, consignmentId: c.id };
    }
  });

  return NextResponse.json(result, { status: 201 });
}
