import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Allow up to 5 minutes for this long-running seed
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// POST /api/seed/demo — inserts 100 brokers, 50 workers, ~60 SKUs, 300 consignments, 150 direct sales
// Safe to call only once — aborts if broker count > 20.

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Rajesh","Pankaj","Suresh","Ramesh","Mahesh","Dinesh","Naresh","Umesh","Ganesh","Mukesh",
  "Rakesh","Devesh","Jayesh","Hitesh","Nitesh","Ritesh","Kamlesh","Brijesh","Anil","Sunil",
  "Kapil","Deepak","Vinod","Manoj","Sanjay","Vijay","Ajay","Mohan","Rohan","Kishan",
  "Pramod","Vimal","Kamal","Gopal","Shyam","Ashok","Alok","Vivek","Pradeep","Sandeep",
  "Bhavesh","Alpesh","Kalpesh","Jignesh","Chirag","Dhruv","Harsh","Yash","Neel","Shantilal",
  "Babulal","Kantilal","Ranjitbhai","Gopalbhai","Karsanbhai","Naranji","Haribhai","Manibhai",
  "Pooja","Priya","Sunita","Savita","Kavita","Anita","Rekha","Geeta","Seema","Meena",
  "Shobha","Kamla","Pushpa","Saroj","Usha","Lata","Manju","Shalini","Nisha","Ritu",
  "Amit","Rohit","Sameer","Nikhil","Gaurav","Sachin","Rahul","Arjun","Kunal","Varun",
  "Manish","Vikram","Hemant","Girish","Tarun","Arun","Jitendra","Surendra","Narendra","Bharat",
];

const LAST_NAMES = [
  "Sharma","Patel","Shah","Mehta","Joshi","Desai","Verma","Gupta","Agarwal","Jain",
  "Soni","Modi","Parikh","Thakur","Chaudhary","Yadav","Singh","Chauhan","Pandey","Tiwari",
  "Mishra","Shukla","Trivedi","Bhatt","Doshi","Kothari","Oswal","Lunia","Sanghavi","Gandhi",
  "Zaveri","Sejpal","Bhavsar","Suthar","Sonar","Kansara","Tailor","Lohar","Kumhar","Naai",
];

const CITIES = [
  "Jaipur","Surat","Mumbai","Delhi","Agra","Kolkata","Hyderabad","Ahmedabad","Pune","Bangalore",
  "Indore","Nagpur","Lucknow","Varanasi","Jodhpur","Udaipur","Amritsar","Chandigarh","Bhopal","Noida",
];

const STREETS = [
  "Gandhi Nagar","Nehru Colony","Patel Marg","MG Road","Station Road",
  "Industrial Area","Jewellers Market","Gems Market","Sardar Patel Road","Civil Lines",
];

const PAYMENT_MODES: any[] = ["CASH","BANK_TRANSFER","UPI","CHEQUE","OTHER"];

function pick<T>(arr: T[]): T {
  if (!arr.length) throw new Error("pick() called with empty array — master data missing?");
  return arr[Math.floor(Math.random() * arr.length)];
}
function ri(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rf(min: number, max: number, dp = 2) { return Math.round((Math.random() * (max - min) + min) * 10 ** dp) / 10 ** dp; }
function daysAgo(days: number): Date { const d = new Date(); d.setDate(d.getDate() - days); return d; }
function dateOnly(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function ph() { return `+91${ri(7000000000, 9999999999)}`; }
function name() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    return await runSeed();
  } catch (err: any) {
    console.error("[seed/demo] fatal error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

async function runSeed() {
  const existing = await db.broker.count();
  if (existing >= 30) {
    return NextResponse.json({ message: "Demo data already seeded.", brokerCount: existing });
  }

  // Load master data
  const [stoneTypes, shapes, sizes, colors, grades, users] = await Promise.all([
    db.stoneType.findMany(),
    db.stoneShape.findMany(),
    db.stoneSize.findMany(),
    db.stoneColor.findMany(),
    db.stoneGrade.findMany({ orderBy: { sortOrder: "asc" } }),
    db.user.findMany({ take: 1 }),
  ]);

  if (!stoneTypes.length || !grades.length || !shapes.length || !sizes.length) {
    return NextResponse.json({ error: "Run /api/seed first to create master data (stone types, shapes, sizes, grades)." }, { status: 400 });
  }
  if (!users.length) {
    return NextResponse.json({ error: "No users found. Run /api/seed first." }, { status: 400 });
  }

  // ── 1. BROKERS (100) ───────────────────────────────────────────────────────
  await db.broker.createMany({
    data: Array.from({ length: 100 }, () => ({
      name: name(),
      contactPhone: ph(),
      phoneWhatsapp: ph(),
      city: pick(CITIES),
      address: `${ri(1, 999)}, ${pick(STREETS)}`,
      defaultPaymentDays: pick([30, 60, 90, 120]),
      active: Math.random() > 0.06,
      notes: Math.random() > 0.7 ? pick(["Long-term client","Pays on time","Prefers calls","Bulk buyer"]) : null,
    })),
  });
  const brokers = await db.broker.findMany({ orderBy: { createdAt: "asc" } });

  // ── 2. WORKERS (50) ────────────────────────────────────────────────────────
  const PAY_TYPES = ["PER_PIECE", "DAILY_WAGES", "MIXED"];
  await db.worker.createMany({
    data: Array.from({ length: 50 }, () => ({
      name: name(),
      phone: ph(),
      city: pick(["Jaipur", "Agra", "Surat", "Indore"]),
      payType: pick(PAY_TYPES) as any,
      dailyWageRate: rf(250, 650, 0),
      settlementCycle: pick(["WEEKLY", "MONTHLY", "PER_WORK"]),
      joinDate: daysAgo(ri(90, 1800)),
      active: Math.random() > 0.08,
    })),
  });
  const workers = await db.worker.findMany({ orderBy: { createdAt: "asc" } });

  // Worker attendance — last 45 days for first 35 workers
  {
    const rows: any[] = [];
    for (const w of workers.slice(0, 35)) {
      for (let d = 0; d < 45; d++) {
        const date = dateOnly(daysAgo(d));
        if (date.getDay() === 0) continue; // skip Sundays
        rows.push({ workerId: w.id, date, status: pick(["PRESENT","PRESENT","PRESENT","ABSENT","HALF_DAY"]) });
      }
    }
    for (let i = 0; i < rows.length; i += 100) {
      await db.workerAttendance.createMany({ data: rows.slice(i, i + 100), skipDuplicates: true });
    }
  }

  // Piece work — last 90 days for first 30 workers
  {
    const rows: any[] = [];
    for (const w of workers.slice(0, 30)) {
      for (let d = 0; d < 90; d += 3) {
        const date = dateOnly(daysAgo(d));
        const st = pick(stoneTypes); const sh = pick(shapes); const sz = pick(sizes);
        rows.push({ workerId: w.id, date, stoneType: st.name, shape: sh.name, size: sz.label, piecesCompleted: ri(5, 60), ratePerPiece: rf(5, 35, 2) });
      }
    }
    await db.workerPieceWork.createMany({ data: rows, skipDuplicates: true });
  }

  // Piece rates per worker
  {
    const rows: any[] = [];
    for (const w of workers) {
      const st = pick(stoneTypes); const sh = pick(shapes); const sz = pick(sizes);
      rows.push({ workerId: w.id, stoneType: st.name, shape: sh.name, size: sz.label, ratePerPiece: rf(5, 40, 2) });
    }
    await db.workerPieceRate.createMany({ data: rows, skipDuplicates: true });
  }

  // ── 3. INVENTORY (~60+ SKUs) ───────────────────────────────────────────────
  const skuRows: any[] = [];
  const skuSet = new Set<string>();

  for (const stone of stoneTypes) {
    const stoneColors = colors.filter((c) => c.stoneTypeId === stone.id);
    if (!stoneColors.length) continue;
    for (const shape of shapes) {
      for (const size of sizes) {
        for (const grade of grades) {
          const color = pick(stoneColors);
          const sku = [
            stone.name.slice(0, 3).toUpperCase(),
            shape.name.slice(0, 3).toUpperCase(),
            size.label.toUpperCase().replace("X", "x"),
            grade.label,
            color.name.replace(/\s+/g, "").slice(0, 3).toUpperCase(),
          ].join("-");
          if (skuSet.has(sku)) continue;
          skuSet.add(sku);
          const cost = rf(20, 300, 2);
          const sell = Math.round(cost * rf(1.8, 4.5, 2));
          const wt = rf(0.25, 4.0, 2);
          skuRows.push({
            sku, stoneTypeId: stone.id, shapeId: shape.id, sizeId: size.id, colorId: color.id, gradeId: grade.id,
            qtyPieces: ri(100, 800),
            weightPerPieceCarats: wt, weightPerPieceGrams: Math.round(wt * 0.2 * 1000) / 1000,
            costPricePerPiece: cost, sellingPriceEstimated: sell,
            currency: "INR", lowStockThreshold: 10,
            catalogVisible: Math.random() > 0.55,
          });
        }
      }
    }
  }
  await db.inventoryItem.createMany({ data: skuRows, skipDuplicates: true });
  const items = await db.inventoryItem.findMany();
  if (!items.length) return NextResponse.json({ error: "Inventory creation failed" }, { status: 500 });

  // ── 4. CONSIGNMENTS (300) ──────────────────────────────────────────────────
  const CON_STATUSES: string[] = [
    ...Array(80).fill("ACTIVE"),
    ...Array(50).fill("PARTIALLY_RETURNED"),
    ...Array(100).fill("FULLY_SOLD"),
    ...Array(70).fill("CLOSED"),
  ];

  let consignmentsMade = 0;

  for (let i = 0; i < 300; i++) {
    const broker = pick(brokers);
    const status = CON_STATUSES[i % CON_STATUSES.length];
    const date = daysAgo(ri(1, 730));
    const numLines = ri(1, 4);
    const conNo = `CON-DEMO-${String(i + 1).padStart(4, "0")}`;
    const payDays = broker.defaultPaymentDays ?? 90;

    const lineItems = Array.from({ length: numLines }, () => pick(items));
    const linesToCreate = lineItems.map((item) => {
      const qtyIssued = ri(5, 60);
      const price = item.sellingPriceEstimated ?? rf(200, 2000, 0);
      let qtySold = 0, qtyReturned = 0;

      if (status === "FULLY_SOLD") {
        qtySold = qtyIssued;
      } else if (status === "PARTIALLY_RETURNED") {
        qtySold = ri(1, Math.max(1, Math.floor(qtyIssued * 0.7)));
        qtyReturned = ri(0, qtyIssued - qtySold);
      } else if (status === "CLOSED") {
        qtyReturned = qtyIssued;
      }
      // ACTIVE → qtySold=0, qtyReturned=0

      return {
        itemId: item.id,
        qtyIssued,
        qtySold,
        qtyReturned,
        estPricePerUnit: price,
        actualPricePerUnit: qtySold > 0 ? Math.round(price * rf(0.85, 1.15, 2)) : null,
        currency: "INR",
      };
    });

    try {
      const con = await db.consignment.create({
        data: {
          consignmentNo: conNo,
          brokerId: broker.id,
          date,
          status: status as any,
          lines: { create: linesToCreate },
        },
      });
      consignmentsMade++;

      // Invoice for sold consignments
      const totalSold = linesToCreate.reduce((s, l) => s + l.qtySold * (l.actualPricePerUnit ?? l.estPricePerUnit), 0);
      if (totalSold > 0 && (status === "FULLY_SOLD" || status === "PARTIALLY_RETURNED")) {
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + payDays);
        const amountPaid = Math.random() > 0.45
          ? (Math.random() > 0.4 ? Math.round(totalSold) : Math.round(totalSold * rf(0.2, 0.8, 2)))
          : 0;
        const invStatus = amountPaid >= Math.round(totalSold) ? "PAID" : amountPaid > 0 ? "PARTIAL" : "PENDING";
        const inv = await db.invoice.create({
          data: {
            invoiceNo: `INV-${conNo}`,
            type: "CONSIGNMENT",
            consignmentId: con.id,
            amountTotal: Math.round(totalSold),
            amountPaid,
            currency: "INR",
            paymentDays: payDays,
            dueDate,
            status: invStatus as any,
          },
        });
        if (amountPaid > 0) {
          await db.payment.create({
            data: {
              invoiceId: inv.id,
              amount: amountPaid,
              paymentDate: new Date(date.getTime() + ri(5, payDays) * 86400000),
              mode: pick(PAYMENT_MODES),
            },
          });
        }
      }
    } catch (_e) {
      // skip duplicate consignment numbers on retry
    }
  }

  // ── 5. DIRECT SALES (150) ──────────────────────────────────────────────────
  const CUST_NAMES = [
    "Amit Kumar","Priya Sharma","Rahul Jain","Neha Patel","Vikram Singh",
    "Sunita Devi","Rajendra Prasad","Meena Kumari","Suresh Babu","Kavitha Reddy",
    "Arjun Nair","Deepa Menon","Harish Rao","Lalitha Devi","Mahesh Kumar",
    "Rekha Gupta","Sanjiv Khanna","Anita Malhotra","Rohit Kapoor","Simran Bedi",
    "Dinesh Chandok","Usha Rani","Praveen Kumar","Sangeetha V","Ramesh Babu",
  ];

  let salesMade = 0;

  for (let i = 0; i < 150; i++) {
    const custName = CUST_NAMES[i % CUST_NAMES.length] + (i >= CUST_NAMES.length ? ` ${Math.floor(i / CUST_NAMES.length) + 1}` : "");
    const saleNo = `SALE-DEMO-${String(i + 1).padStart(4, "0")}`;
    const date = daysAgo(ri(1, 730));
    const numLines = ri(1, 3);
    const payDays = pick([30, 60, 90]);
    const dueDate = new Date(date); dueDate.setDate(dueDate.getDate() + payDays);

    const lineItems = Array.from({ length: numLines }, () => pick(items));
    const totalAmount = lineItems.reduce((s, item) => {
      const qty = ri(1, 25);
      const price = item.sellingPriceEstimated ?? rf(200, 3000, 0);
      return s + qty * price;
    }, 0);
    const roundedTotal = Math.round(totalAmount);

    const amountPaid = Math.random() > 0.4
      ? (Math.random() > 0.35 ? roundedTotal : Math.round(roundedTotal * rf(0.15, 0.85, 2)))
      : 0;
    const invStatus = amountPaid >= roundedTotal ? "PAID" : amountPaid > 0 ? "PARTIAL" : "PENDING";
    const saleStatus = amountPaid >= roundedTotal ? "PAID" : amountPaid > 0 ? "PARTIALLY_PAID" : "COMPLETED";

    try {
      let customer = await db.customer.findFirst({ where: { name: custName } });
      if (!customer) {
        customer = await db.customer.create({
          data: { name: custName, contactPhone: ph(), phoneWhatsapp: ph(), city: pick(CITIES) },
        });
      }

      const linesData = lineItems.map((item) => ({
        itemId: item.id,
        qty: ri(1, 25),
        pricePerUnit: item.sellingPriceEstimated ?? rf(200, 3000, 0),
        currency: "INR",
      }));

      const sale = await db.directSale.create({
        data: {
          saleNo,
          customerId: customer.id,
          date,
          status: saleStatus as any,
          lines: { create: linesData },
          invoices: {
            create: {
              invoiceNo: `INV-${saleNo}`,
              type: "DIRECT_SALE",
              amountTotal: roundedTotal,
              amountPaid,
              currency: "INR",
              paymentDays: payDays,
              dueDate,
              status: invStatus as any,
            },
          },
        },
      });
      salesMade++;

      if (amountPaid > 0) {
        const inv = await db.invoice.findFirst({ where: { directSaleId: sale.id } });
        if (inv) {
          await db.payment.create({
            data: {
              invoiceId: inv.id,
              amount: amountPaid,
              paymentDate: new Date(date.getTime() + ri(1, payDays) * 86400000),
              mode: pick(PAYMENT_MODES),
            },
          });
        }
      }
    } catch (_e) {
      // skip duplicate sale numbers
    }
  }

  return NextResponse.json({
    message: "✅ Demo data seeded successfully!",
    created: {
      brokers: brokers.length,
      workers: workers.length,
      inventorySkus: skuRows.length,
      consignments: consignmentsMade,
      directSales: salesMade,
    },
  });
}
