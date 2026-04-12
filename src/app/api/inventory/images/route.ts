import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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
  // Local fallback for development
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

async function deleteFile(url: string): Promise<void> {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) return;
  try {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const container = process.env.AZURE_STORAGE_CONTAINER ?? "gem-images";
    const containerClient = BlobServiceClient.fromConnectionString(connStr).getContainerClient(container);
    const filename = url.split("/").pop();
    if (filename) await containerClient.getBlockBlobClient(filename).deleteIfExists();
  } catch { /* ignore */ }
}

// POST /api/inventory/images?itemId=xxx
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const contentType = req.headers.get("content-type") ?? "";

  // ── URL-based image ──
  if (contentType.includes("application/json")) {
    const { url, isPrimary } = await req.json() as { url: string; isPrimary?: boolean };
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    if (isPrimary) {
      await db.itemImage.updateMany({ where: { itemId }, data: { isPrimary: false } });
    }
    const existing = await db.itemImage.count({ where: { itemId } });
    const image = await db.itemImage.create({
      data: { itemId, url, isPrimary: isPrimary ?? existing === 0, sortOrder: existing },
    });
    return NextResponse.json(image, { status: 201 });
  }

  // ── File upload ──
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const isPrimary = formData.get("isPrimary") === "true";
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${itemId}-${Date.now()}.${ext}`;

  const imageUrl = await uploadFile(buffer, filename, file.type || "image/jpeg");

  if (isPrimary) {
    await db.itemImage.updateMany({ where: { itemId }, data: { isPrimary: false } });
  }
  const existing = await db.itemImage.count({ where: { itemId } });
  const image = await db.itemImage.create({
    data: { itemId, url: imageUrl, isPrimary: isPrimary || existing === 0, sortOrder: existing },
  });
  return NextResponse.json(image, { status: 201 });
}

// DELETE /api/inventory/images?imageId=xxx
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  const image = await db.itemImage.findUnique({ where: { id: imageId } });
  if (image) await deleteFile(image.url);
  await db.itemImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/inventory/images?imageId=xxx  — set as primary
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  const image = await db.itemImage.findUnique({ where: { id: imageId } });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.itemImage.updateMany({ where: { itemId: image.itemId }, data: { isPrimary: false } });
  await db.itemImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  return NextResponse.json({ ok: true });
}
