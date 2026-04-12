import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  phoneWhatsapp: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  defaultPaymentDays: z.number().int().default(90),
  notes: z.string().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const brokers = await db.broker.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { consignments: true } },
    },
  });
  return NextResponse.json(brokers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "STAFF"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const broker = await db.broker.create({ data: parsed.data });
  return NextResponse.json(broker, { status: 201 });
}
