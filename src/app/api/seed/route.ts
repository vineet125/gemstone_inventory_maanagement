import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// POST /api/seed — creates initial admin user + master data
// Only runs if no users exist. Remove or disable after first run.
export async function POST() {
  const userCount = await db.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { message: "Already seeded — users exist." },
      { status: 200 }
    );
  }

  const hashedPassword = await bcrypt.hash("admin123", 12);

  // Create owner user
  await db.user.create({
    data: {
      name: "Owner",
      email: "admin@gemstock.in",
      password: hashedPassword,
      role: "OWNER",
    },
  });

  // Stone types
  const [citrine, amethyst, garnet] = await Promise.all([
    db.stoneType.create({ data: { name: "Citrine", descriptionEn: "Yellow quartz variety", descriptionHi: "पीली क्वार्ट्ज" } }),
    db.stoneType.create({ data: { name: "Amethyst", descriptionEn: "Purple quartz variety", descriptionHi: "बैंगनी क्वार्ट्ज" } }),
    db.stoneType.create({ data: { name: "Garnet", descriptionEn: "Deep red gemstone", descriptionHi: "गहरा लाल रत्न" } }),
  ]);

  // Shapes
  await Promise.all([
    db.stoneShape.create({ data: { name: "Oval" } }),
    db.stoneShape.create({ data: { name: "Octagon" } }),
    db.stoneShape.create({ data: { name: "Round" } }),
    db.stoneShape.create({ data: { name: "Pear" } }),
    db.stoneShape.create({ data: { name: "Cushion" } }),
    db.stoneShape.create({ data: { name: "Heart" } }),
    db.stoneShape.create({ data: { name: "Marquise" } }),
  ]);

  // Sizes
  await Promise.all([
    db.stoneSize.create({ data: { label: "6x4", lengthMm: 6, widthMm: 4 } }),
    db.stoneSize.create({ data: { label: "8x6", lengthMm: 8, widthMm: 6 } }),
    db.stoneSize.create({ data: { label: "10x8", lengthMm: 10, widthMm: 8 } }),
    db.stoneSize.create({ data: { label: "12x10", lengthMm: 12, widthMm: 10 } }),
    db.stoneSize.create({ data: { label: "14x10", lengthMm: 14, widthMm: 10 } }),
  ]);

  // Colors per stone type
  await Promise.all([
    db.stoneColor.create({ data: { name: "Yellow", hexCode: "#F4C842", stoneTypeId: citrine.id } }),
    db.stoneColor.create({ data: { name: "Deep Yellow", hexCode: "#D4A017", stoneTypeId: citrine.id } }),
    db.stoneColor.create({ data: { name: "Light Yellow", hexCode: "#FFF176", stoneTypeId: citrine.id } }),
    db.stoneColor.create({ data: { name: "Light Purple", hexCode: "#CE93D8", stoneTypeId: amethyst.id } }),
    db.stoneColor.create({ data: { name: "Deep Purple", hexCode: "#6A1B9A", stoneTypeId: amethyst.id } }),
    db.stoneColor.create({ data: { name: "Deep Red", hexCode: "#B71C1C", stoneTypeId: garnet.id } }),
    db.stoneColor.create({ data: { name: "Orange Red", hexCode: "#E64A19", stoneTypeId: garnet.id } }),
  ]);

  // Grades
  await Promise.all([
    db.stoneGrade.create({ data: { label: "AAA", sortOrder: 1 } }),
    db.stoneGrade.create({ data: { label: "AA", sortOrder: 2 } }),
    db.stoneGrade.create({ data: { label: "A", sortOrder: 3 } }),
  ]);

  return NextResponse.json({
    message: "Seeded successfully!",
    loginEmail: "admin@gemstock.in",
    loginPassword: "admin123",
  });
}
