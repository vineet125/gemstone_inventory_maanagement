import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  phoneWhatsapp: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  defaultPaymentDays: z.number().int().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const broker = await db.broker.findUnique({
    where: { id },
    include: {
      consignments: {
        orderBy: { date: "desc" },
        take: 20,
        include: {
          lines: { include: { item: { select: { sku: true } } } },
          invoices: { select: { id: true, amountTotal: true, amountPaid: true, status: true, dueDate: true } },
        },
      },
    },
  });
  if (!broker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(broker);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const broker = await db.broker.update({ where: { id }, data: parsed.data });
  return NextResponse.json(broker);
}
