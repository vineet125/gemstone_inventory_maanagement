import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  hexCode: z.string().optional(),
  stoneTypeId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const stoneTypeId = searchParams.get("stoneTypeId");
  const items = await db.stoneColor.findMany({
    where: stoneTypeId ? { stoneTypeId } : undefined,
    orderBy: { name: "asc" },
    include: { stoneType: { select: { name: true } } },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const item = await db.stoneColor.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
