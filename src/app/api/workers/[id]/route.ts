import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  payType: z.enum(["PER_PIECE", "DAILY_WAGES", "MIXED"]).optional(),
  settlementCycle: z.enum(["WEEKLY", "MONTHLY", "PER_WORK"]).optional(),
  dailyWageRate: z.number().positive().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
  notifyWhatsapp: z.boolean().optional(),
  departments: z.array(z.string()).optional(),
});

const attendanceSchema = z.object({
  date: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY"]),
  notes: z.string().optional(),
});

const pieceWorkSchema = z.object({
  date: z.string(),
  stoneType: z.string().min(1),
  shape: z.string().min(1),
  size: z.string().min(1),
  piecesCompleted: z.number().int().positive(),
  ratePerPiece: z.number().positive(),
  currency: z.string().default("INR"),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;
  const worker = await db.worker.findUnique({
    where: { id: params.id },
    include: {
      pieceRates: true,
      attendance: { orderBy: { date: "desc" }, take: 31 },
      pieceWork: { orderBy: { date: "desc" }, take: 31 },
    },
  });
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch notifyWhatsapp + departments via raw SQL (Prisma client not regenerated)
  try {
    const [wRow] = await db.$queryRaw<Array<{ notifyWhatsapp: boolean; departments: string }>>`
      SELECT "notifyWhatsapp", departments FROM "Worker" WHERE id = ${params.id}
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (worker as any).notifyWhatsapp = wRow?.notifyWhatsapp ?? true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (worker as any).departments = JSON.parse(wRow?.departments ?? "[]") as string[];
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (worker as any).departments = [];
    }
  } catch {
    // departments column not yet created — use defaults
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (worker as any).notifyWhatsapp = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (worker as any).departments = [];
  }

  return NextResponse.json(worker);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();

  // Handle attendance recording
  if (body.type === "attendance") {
    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const att = await db.workerAttendance.upsert({
      where: { workerId_date: { workerId: params.id, date: new Date(parsed.data.date) } },
      update: { status: parsed.data.status, notes: parsed.data.notes },
      create: { workerId: params.id, date: new Date(parsed.data.date), status: parsed.data.status, notes: parsed.data.notes },
    });
    return NextResponse.json(att);
  }

  // Handle piece work recording
  if (body.type === "piecework") {
    const parsed = pieceWorkSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const pw = await db.workerPieceWork.create({
      data: { workerId: params.id, ...parsed.data, date: new Date(parsed.data.date) },
    });
    return NextResponse.json(pw);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { departments, ...rest } = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const worker = await (db.worker as any).update({ where: { id: params.id }, data: rest });
  // Write departments via raw SQL when provided (graceful if column doesn't exist yet)
  if (departments !== undefined) {
    try {
      const deptJson = JSON.stringify(departments);
      await db.$executeRaw`UPDATE "Worker" SET departments = ${deptJson} WHERE id = ${params.id}`;
    } catch { /* departments column not yet created — ignored */ }
  }
  return NextResponse.json({ ...worker, departments: departments ?? [] });
}
