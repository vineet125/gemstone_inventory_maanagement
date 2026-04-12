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

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const workers = await db.worker.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { pieceWork: true, attendance: true } } },
  });

  // Fetch departments (new column) via raw SQL — column may not exist yet if db push not run
  const ids = workers.map((w) => w.id);
  let deptMap: Record<string, string[]> = {};
  if (ids.length > 0) {
    try {
      const rows = await db.$queryRaw<Array<{ id: string; departments: string }>>`
        SELECT id, departments FROM "Worker" WHERE id = ANY(${ids})
      `;
      deptMap = Object.fromEntries(
        rows.map((r) => {
          try { return [r.id, JSON.parse(r.departments) as string[]]; }
          catch { return [r.id, []]; }
        })
      );
    } catch { /* departments column not yet created — return empty */ }
  }

  const result = workers.map((w) => ({
    ...w,
    departments: deptMap[w.id] ?? [],
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { departments, ...rest } = parsed.data;
  const worker = await db.worker.create({
    data: { ...rest, joinDate: rest.joinDate ? new Date(rest.joinDate) : undefined },
  });

  // Write departments via raw SQL (graceful if column doesn't exist yet)
  if (departments && departments.length > 0) {
    try {
      const deptJson = JSON.stringify(departments);
      await db.$executeRaw`UPDATE "Worker" SET departments = ${deptJson} WHERE id = ${worker.id}`;
    } catch { /* departments column not yet created — ignored */ }
  }

  return NextResponse.json({ ...worker, departments: departments ?? [] }, { status: 201 });
}
