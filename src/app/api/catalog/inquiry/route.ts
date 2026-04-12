import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  whatsapp: z.string().optional(),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // In production, this would send an email/WhatsApp/store in DB
  // For now, log and return success
  console.log("New catalog inquiry:", parsed.data);

  return NextResponse.json({ message: "Inquiry received. We will contact you soon!" });
}
