import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth(["OWNER", "MANAGER", "ACCOUNTANT", "STAFF"]);
  if (error) return error;
  const rows = await db.siteSettings.findMany();
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER", "ACCOUNTANT"]);
  if (error) return error;
  const body = (await req.json()) as Record<string, string>;
  await Promise.all(
    Object.entries(body).map(([key, value]) =>
      db.siteSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
