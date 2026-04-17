import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXT  = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

async function uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr) {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const container = process.env.AZURE_STORAGE_CONTAINER ?? "gem-images";
    const containerClient = BlobServiceClient.fromConnectionString(connStr).getContainerClient(container);
    await containerClient.createIfNotExists({ access: "blob" });
    const blob = containerClient.getBlockBlobClient(filename);
    await blob.upload(buffer, buffer.length, { blobHTTPHeaders: { blobContentType: mimeType } });
    return blob.url;
  }
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

// POST /api/settings/stone-type-images?stoneName=Amethyst
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["OWNER", "MANAGER"]);
  if (error) return error;

  const stoneName = new URL(req.url).searchParams.get("stoneName");
  if (!stoneName || stoneName.length > 100) {
    return NextResponse.json({ error: "stoneName required" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  // MIME type check
  const mime = file.type || "";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" }, { status: 415 });
  }

  // Extension check — derive from filename only if a dot exists
  const dotIdx = file.name.lastIndexOf(".");
  const ext = dotIdx !== -1 ? file.name.slice(dotIdx + 1).toLowerCase() : "";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Invalid file extension" }, { status: 415 });
  }

  // Sanitise stoneName for use in filename (letters, digits, hyphens only)
  const safeStone = stoneName.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() || "stone";
  const filename = `stone-${safeStone}-${Date.now()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const url = await uploadFile(buffer, filename, mime);

  // Atomic-ish read-modify-write (best effort for MySQL; race window is tiny in single-server use)
  const row = await db.siteSettings.findUnique({ where: { key: "stone_type_images" } });
  let existing: Record<string, string> = {};
  try { existing = JSON.parse(row?.value ?? "{}"); } catch { /* start fresh */ }
  existing[stoneName] = url;

  await db.siteSettings.upsert({
    where: { key: "stone_type_images" },
    create: { key: "stone_type_images", value: JSON.stringify(existing) },
    update: { value: JSON.stringify(existing) },
  });

  return NextResponse.json({ stoneName, url });
}
