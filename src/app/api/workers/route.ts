import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  payType: z.enum(["PER_PIECE", "DAILY_WAGES", "MIXED"]).default("DAILY_WAGES"),
  settlementCycle: z.enum(["WEEKLY", "MONTHLY", "PER_WORK"]).default("MONTHLY"),
  dailyWageRate: z.number().positive().optional(),
  joinDate: z.string().optional(),
  departments: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

function parseDepts(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const workers = await db.worker.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { pieceWork: true, attendance: true } } },
  });

  return NextResponse.json(workers.map((w) => ({ ...w, departments: parseDepts(w.departments) })));
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { departments, ...rest } = parsed.data;
  const worker = await db.worker.create({
    data: {
      ...rest,
      joinDate: rest.joinDate ? new Date(rest.joinDate) : undefined,
      departments: JSON.stringify(departments ?? []),
    },
  });

  return NextResponse.json({ ...worker, departments: departments ?? [] }, { status: 201 });
}
