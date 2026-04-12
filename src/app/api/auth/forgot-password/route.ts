import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) {
    // Don't reveal whether the account exists
    return NextResponse.json({ ok: true });
  }

  // Invalidate previous tokens for this email
  await db.passwordResetToken.updateMany({
    where: { email: user.email, used: false },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await db.passwordResetToken.create({
    data: { email: user.email, token, expiresAt },
  });

  return NextResponse.json({ ok: true, token, name: user.name });
}
