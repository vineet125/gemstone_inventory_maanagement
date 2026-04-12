import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "STAFF", "WORKER"]).optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER"]);
  if (error) return error;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    data.password = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await db.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth(["OWNER"]);
  if (error) return error;
  if (session?.user.id === params.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }
  await db.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
