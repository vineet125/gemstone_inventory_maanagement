import { db } from "@/lib/db";

export async function queueWhatsapp(
  phone: string | null | undefined,
  message: string,
  referenceId: string,
  referenceType: string
) {
  if (!phone) return;
  await db.whatsappNotification.create({
    data: { recipientPhone: phone, message, status: "PENDING", referenceId, referenceType },
  });
}

export async function getWaSettings() {
  const rows = await db.siteSettings.findMany({
    where: { key: { in: ["wa_notify_brokers", "wa_notify_vendors", "wa_notify_workers"] } },
  });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    brokers: m["wa_notify_brokers"] === "true",
    vendors: m["wa_notify_vendors"] === "true",
    workers: m["wa_notify_workers"] === "true",
  };
}
