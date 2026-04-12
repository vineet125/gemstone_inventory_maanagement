import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const types = await db.stoneType.findMany({
    where: { active: true },
    select: { id: true, name: true, descriptionEn: true, descriptionHi: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(types);
}
