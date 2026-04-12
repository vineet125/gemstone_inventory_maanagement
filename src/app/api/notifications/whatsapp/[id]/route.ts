import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const notification = await db.whatsappNotification.update({
    where: { id: params.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  return NextResponse.json(notification);
}
