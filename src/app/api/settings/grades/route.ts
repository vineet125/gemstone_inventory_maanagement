import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  const items = await db.stoneGrade.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const item = await db.stoneGrade.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
