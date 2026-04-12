# GemStock — Semi-Precious Stone Business Management Platform
## Full Requirements Document
**Last updated:** 2026-04-11  
**Version:** 1.2  
**Status:** FULLY CONFIRMED — Phase 1 Development Starting

---

## 0. Quick Start for New Chats
Read this entire document before writing any code. This is the single source of truth.
Project folder: `C:\Users\vineeta\gemstone-inventory`

---

## 1. Business Overview

A semi-precious stone business with three core operations:
- **Manufacturing** — raw rough stones → cutting → shaping → external polishing → finished goods
- **Inventory Management** — organized storage of finished stones by type, shape, size, color, grade
- **Sales** — broker-led consignment OR direct customer sales with deferred payment cycles

Two digital surfaces:
1. **Internal Admin Portal** — full operations management (manufacturing, inventory, sales, payments, reports, staff management)
2. **Customer-Facing Catalog** — visual showcase of stones by color/type/size (view only, no pricing, no login)

---

## 2. SKU Explanation (Important for Development)

**SKU (Stock Keeping Unit)** = a unique code for each distinct product variant.

For this business:
> **SKU = Stone Type + Shape + Size + Color + Grade**

Example: `CIT-OVL-6x4-YLW-AAA` = Citrine, Oval, 6×4mm, Yellow, AAA

One SKU maps to one physical tray/compartment in storage. Multiple pieces of the same SKU live together.

**Expected SKU volume:** Hundreds (not thousands) — exact count builds up as inventory is entered manually over time. System must handle up to 5,000 SKUs without performance issues.

---

## 3. Manufacturing Module

### 3.1 Stages (in order)

| # | Stage Name | Description |
|---|-----------|-------------|
| 1 | Rough Collection | Purchase raw rock/rough stone material from supplier |
| 2 | Cutting | Rough stone cut into individual pieces |
| 3 | Shaping | Workers shape each piece (oval, oct, round, pear, etc.) |
| 4 | Polishing & Finishing | Sent to **external vendor** for polish and final finish |
| 5 | Inventory In | Finished stones received, graded, placed in inventory |

### 3.2 Batch Tracking
- Each purchase of rough material = one **Batch** with unique Batch ID
- Per batch record:
  - Supplier name, purchase date
  - Weight in (kg or grams) + weight in carats
  - Purchase cost (INR or selected currency)
  - Notes
- As stones move through stages, track:
  - Stage entry date / exit date
  - Worker(s) assigned (Cutting & Shaping stages)
  - Quantity/weight in vs out (yield tracking — loss/breakage per stage)
  - Stage-level notes and rejection count
- **Polishing stage:** external vendor name, date sent, date received, cost charged

### 3.3 Yield Tracking
At each stage: `yield % = (output weight / input weight) × 100`
This lets the owner see how efficient each stage/worker is.

---

## 4. Stone Master Data

### 4.1 Stone Types (admin-configurable list, not hardcoded)
Initial list:
- Citrine
- Amethyst
- Garnet
- (owner can add more from admin panel)

### 4.2 Stone Attributes
| Attribute | Example Values | Notes |
|-----------|---------------|-------|
| Type | Citrine, Amethyst, Garnet | Admin-configurable list |
| Shape | Oval, Octagon, Round, Pear, Cushion, Heart, Marquise | Admin-configurable |
| Size | 6x4, 8x6, 10x8 (length × width in mm) | Admin-configurable |
| Color | Yellow, Deep Yellow, Light Purple, Deep Purple | Admin-configurable per stone type |
| Grade | AAA, AA, A | Admin-configurable (customizable labels) |
| Weight per piece | in carats AND grams | Both stored |

### 4.3 Grade System
- Grades are **fully customizable** by admin (AAA/AA/A is just default)
- Admin can add, rename, reorder grades
- Each SKU gets one grade assigned

---

## 5. Inventory Module

### 5.1 SKU Definition
Unique combination of: **Type + Shape + Size + Color + Grade**

### 5.2 Inventory Item Record
- SKU code (auto-generated)
- Stone type, shape, size, color, grade
- Current stock quantity (pieces)
- Weight per piece (carats + grams)
- Total weight in stock
- Physical location: Cabinet → Tray → Compartment
- Cost price per piece (hidden from Staff/Worker role — see Section 8)
- Selling price (estimated)
- Photos (up to 5 images per SKU)
- Visibility toggle for customer catalog (show/hide)

### 5.3 Stock Movements
Every change in stock creates an immutable movement record:
| Movement Type | Trigger |
|-------------|---------|
| STOCK_IN_MANUFACTURING | From manufacturing completion |
| STOCK_IN_PURCHASE | Direct purchase of finished stones |
| STOCK_OUT_CONSIGNMENT | Issued to broker |
| STOCK_OUT_DIRECT_SALE | Sold directly to customer |
| RETURN_FROM_BROKER | Broker returns unsold items |
| ADJUSTMENT | Manual correction, damage write-off |

### 5.4 Inventory Views & Filters
- By Stone Type
- By Color
- By Shape + Size
- By Physical Location
- By Grade
- Low stock alerts (threshold configurable per SKU)
- Out of stock items

---

## 6. Sales Module

### 6.1 Two Sales Channels

#### A) Broker Consignment (Primary)
```
Broker visits → Items selected from inventory → Consignment issued (with estimated price)
→ Broker takes goods
    ├── Sold: Broker confirms → Sale recorded → Invoice → Payment due
    └── Partial/Not sold: Items returned to inventory
```

#### B) Direct Customer Sale
```
Customer visits/contacts → Items selected → Direct sale invoice created →
Items removed from inventory → Payment collected (same deferred cycle options)
```

### 6.2 Broker Profile
- Name, contact number (WhatsApp enabled), address, city
- Default payment terms (30/90/180/365 days)
- Full history: consignments, sales, returns, payments, outstanding balance

### 6.3 Consignment Record
- Consignment ID (auto), date, broker name
- Line items: SKU, quantity, estimated selling price per piece
- Status: `Draft` → `Active` → `Partially Returned` → `Fully Sold` → `Closed`
- Notes

### 6.4 Direct Sale Record
- Sale ID (auto), date, customer name + contact
- Line items: SKU, quantity, actual selling price per piece
- Status: `Completed` → `Partially Paid` → `Paid`

### 6.5 Pricing Rules
- Estimated selling price set at consignment time
- Actual sale price confirmed when broker reports sale (may differ from estimate)
- Profit margin auto-calculated: `(actual price - cost price) × qty`
- Cost price visible only to Owner and Accountant roles

---

## 7. Payment Tracking Module

### 7.1 Payment Cycles (for both broker and direct sales)
- 30 days (1 month)
- 90 days (1 quarter)
- 180 days (6 months)
- 365 days (1 year)
- Custom date (manual entry)

### 7.2 Payment Record
- Payment ID, linked Invoice/Consignment ID
- Total amount due
- Due date (sale date + cycle)
- Payments received (supports multiple partial payments)
- Outstanding balance
- Status: `Pending` → `Partial` → `Paid` → `Overdue`
- Payment mode: Cash / Bank Transfer / UPI / Cheque (configurable)

### 7.3 Payment Dashboard
- Total outstanding across all brokers/customers
- Overdue (past due date) — highlighted red
- Due this week / this month
- Collection trend chart
- Per-broker and per-customer ledger

### 7.4 WhatsApp Payment Reminders
- Automated reminder when payment is 7 days away
- Reminder on due date
- Reminder when overdue (every X days, configurable)
- Manual "Send reminder now" button per payment
- Integration: **Twilio WhatsApp Business API** (or Meta WhatsApp Cloud API)
- Message templates in English + Hindi

---

## 8. User Roles & Permissions

| Role | Description | Cost Price Visible | Financial Reports |
|------|------------|-------------------|------------------|
| **Owner / Super Admin** | Full access, all data | Yes | Yes |
| **Manager** | All operations, no user management | Yes | Yes |
| **Accountant** | Payments, invoices, reports only | Yes | Yes |
| **Staff** | Inventory operations, sales entry | No | No |
| **Worker** | Manufacturing stage updates only | No | No |

- 4–5 users expected initially
- Owner can invite staff, assign roles, deactivate accounts
- Password reset by admin

---

## 9. Admin Dashboard

### 9.1 Summary KPI Cards
- Total inventory value (at cost) — Owner/Accountant only
- Total inventory value (at selling price)
- Total items in stock
- Open consignments (count + value)
- Outstanding payments (total)
- Overdue payments (total — highlighted)
- Items in manufacturing pipeline (WIP)

### 9.2 Charts
- Monthly sales trend (bar chart)
- Top 5 selling stone types (pie chart)
- Payment collection vs outstanding (area chart)
- Manufacturing yield over time
- Stock level by stone type

### 9.3 Alerts Feed
- Overdue payments (with broker name, amount)
- Low stock SKUs
- Consignments open > 90 days (configurable threshold)
- Manufacturing batches with no movement > 14 days

---

## 10. Customer-Facing Catalog

### 10.1 Purpose
Public website for customers and brokers to browse available stones visually.

### 10.2 Features
- Homepage with hero banner and stone type categories
- Browse by: Stone Type → Color → Shape → Size → Grade
- Visual color swatches grid
- Per-SKU page: photos gallery, description, shape diagram, size guide
- Stock badge: Available / Limited / Out of Stock (no exact qty shown)
- No pricing shown
- Inquiry / Contact form (name, phone, WhatsApp, message)
- Fully responsive (mobile-first)

### 10.3 Admin Controls for Catalog
- Toggle visibility per SKU (show/hide on public site)
- Upload up to 5 photos per SKU
- Write stone type descriptions (English + Hindi)
- Featured stones section (curated by admin)

### 10.4 No Customer Login
Catalog is view-only. No customer accounts. Inquiries come via form only.

---

## 11. Internationalization (i18n)

- **Languages:** English (default) + Hindi
- All UI labels, notifications, and customer catalog content translatable
- Language toggle in admin portal
- Customer catalog detects browser language, defaults to English
- WhatsApp messages in English or Hindi (user preference per broker/customer)
- Library: **next-intl**

---

## 12. Multi-Currency

- **Default currency:** INR (Indian Rupee)
- Admin can configure additional currencies (USD, EUR, etc.)
- Each transaction stores original currency + INR equivalent
- Exchange rate manually set by admin (not auto-fetched, keeps it simple)
- All reports summarized in INR

---

## 13. Reports

| Report | Access | Export |
|--------|--------|--------|
| Stock Report (current snapshot by type/color/size) | All roles | PDF + Excel |
| Sales Report (by date, broker, stone type) | Manager+ | PDF + Excel |
| Payment Report (outstanding/collected/overdue) | Accountant+ | PDF + Excel |
| Manufacturing Report (batch yield, stage throughput) | Manager+ | PDF + Excel |
| Broker Ledger (per broker: consignments/sales/payments) | Manager+ | PDF + Excel |
| Profit & Loss Summary | Owner only | PDF + Excel |

---

## 14. Tech Stack (Confirmed)

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | **Next.js 14** (App Router) | One codebase for admin + public catalog |
| UI | **Tailwind CSS + shadcn/ui** | Fast, beautiful, accessible components |
| Database | **PostgreSQL** | Relational data, strong for inventory/finance |
| ORM | **Prisma** | Type-safe DB access, easy migrations |
| Auth | **NextAuth.js v5** | Role-based auth with credentials |
| File Storage | **Cloudinary** | Stone image uploads + optimization |
| Charts | **Recharts** | Dashboard analytics |
| PDF Export | **@react-pdf/renderer** | Invoice and report generation |
| Excel Export | **xlsx (SheetJS)** | Stock and payment reports |
| i18n | **next-intl** | English + Hindi |
| WhatsApp | **Twilio / Meta WhatsApp API** | Payment reminders |
| Deployment | **Vercel** (app) + **Supabase** (PostgreSQL) | Free tier available, scalable |
| Version Control | Git + GitHub | |

---

## 15. Database Schema (Key Tables)

```
users                  (id, name, email, role, language_pref)
stone_types            (id, name, description_en, description_hi)
stone_shapes           (id, name)
stone_sizes            (id, label, length_mm, width_mm)
stone_colors           (id, name, hex_code, stone_type_id)
stone_grades           (id, label, sort_order)  -- customizable

rough_batches          (id, batch_no, supplier, purchase_date, weight_g, cost, currency, notes)
manufacturing_stages   (id, batch_id, stage, entry_date, exit_date, weight_in, weight_out, notes)
stage_workers          (id, stage_id, user_id)
polishing_vendors      (id, name, contact)
polishing_records      (id, stage_id, vendor_id, sent_date, received_date, cost)

inventory_items        (id, sku, stone_type_id, shape_id, size_id, color_id, grade_id,
                        qty_pieces, weight_per_piece_g, weight_per_piece_ct,
                        cost_price, selling_price_estimated, currency,
                        location_cabinet, location_tray, location_compartment,
                        catalog_visible, created_at)
stock_movements        (id, item_id, movement_type, qty_change, reference_id, reference_type,
                        notes, created_by, created_at)
item_images            (id, item_id, url, sort_order, is_primary)

brokers                (id, name, phone_whatsapp, address, city, default_payment_days)
consignments           (id, consignment_no, broker_id, date, status, notes)
consignment_lines      (id, consignment_id, item_id, qty, est_price_per_unit, actual_price_per_unit)

customers              (id, name, phone_whatsapp, address, city)
direct_sales           (id, sale_no, customer_id, date, status, notes)
direct_sale_lines      (id, sale_id, item_id, qty, price_per_unit)

invoices               (id, invoice_no, type[consignment|direct], reference_id,
                        amount_total, currency, due_date, payment_days)
payments               (id, invoice_id, amount, payment_date, mode, notes)

whatsapp_notifications (id, recipient_phone, message, status, sent_at, reference_id, reference_type)
```

---

## 16. Project Folder Structure (Planned)

```
gemstone-inventory/
├── REQUIREMENTS.md          ← this file
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (admin)/         ← admin portal routes
│   │   │   ├── dashboard/
│   │   │   ├── manufacturing/
│   │   │   ├── inventory/
│   │   │   ├── sales/
│   │   │   ├── brokers/
│   │   │   ├── payments/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── (catalog)/       ← public customer catalog
│   │   │   ├── page.tsx     ← homepage
│   │   │   ├── stones/
│   │   │   └── contact/
│   │   └── api/             ← API routes
│   ├── components/
│   │   ├── admin/
│   │   ├── catalog/
│   │   └── shared/
│   ├── lib/
│   │   ├── db.ts            ← Prisma client
│   │   ├── auth.ts          ← NextAuth config
│   │   └── whatsapp.ts      ← WhatsApp API wrapper
│   └── messages/
│       ├── en.json          ← English strings
│       └── hi.json          ← Hindi strings
├── public/
└── package.json
```

---

## 17. Phased Delivery Plan

### Phase 1 — Foundation (Start Here)
- [ ] Project setup (Next.js, Prisma, Auth, Tailwind, shadcn/ui)
- [ ] Database schema + migrations
- [ ] Auth: login, roles, session
- [ ] Master data: stone types, shapes, sizes, colors, grades (admin CRUD)
- [ ] Manufacturing: batch entry, stage tracking, yield reports
- [ ] Basic admin dashboard shell

### Phase 2 — Inventory
- [ ] Inventory item CRUD (SKU management)
- [ ] Stock movement tracking
- [ ] Physical location management
- [ ] Inventory views + filters
- [ ] Low stock alerts
- [ ] Image upload per SKU (Cloudinary)

### Phase 3 — Sales & Payments
- [ ] Broker management
- [ ] Consignment flow (issue → sold/returned)
- [ ] Direct sales flow
- [ ] Invoice generation (PDF)
- [ ] Payment tracking (partial payments, cycles)
- [ ] Payment dashboard + overdue alerts
- [ ] WhatsApp payment reminders

### Phase 4 — Reports & Export
- [ ] All 6 report types
- [ ] PDF export
- [ ] Excel/CSV export

### Phase 5 — Customer Catalog
- [ ] Public catalog (stone browse by color/type/size)
- [ ] Admin catalog visibility controls
- [ ] Inquiry contact form
- [ ] Hindi language support

### Phase 6 — Polish
- [ ] i18n (English + Hindi throughout admin)
- [ ] Mobile optimization review
- [ ] Performance tuning
- [ ] Deployment to Vercel + Supabase

---

## 18. Infrastructure & External Services

### 18.1 WhatsApp Business
- No existing account — **purchase new WhatsApp Business number**
- Recommended: Register via **Meta WhatsApp Business API** (free tier available)
- Or use **Twilio WhatsApp** (easier dev setup, pay-per-message)
- Need approved message templates for payment reminders (takes 1–3 days approval)

### 18.2 Domain
- No existing domain — **purchase required**
- Recommended registrars: GoDaddy, Namecheap, or Google Domains
- Suggested names: gemstock.in / gemstonerp.in / stoneinventory.in
- Hosting: **Vercel** (free tier for Next.js) + **Supabase** (free PostgreSQL)

---

## 19. Worker Pay Module

Workers have **two payment modes** (set per worker):

### 19.1 Per-Piece Rate
- Worker is paid per stone piece shaped
- Rate can vary by: stone type, shape, size (fully configurable)
- Example: Citrine Oval 6x4 = ₹2/piece, Amethyst Cushion 10x8 = ₹5/piece
- System tracks pieces completed per worker per day
- Monthly payout = sum of (pieces × rate per piece type)

### 19.2 Daily Wages
- Worker is paid a fixed daily rate
- Track attendance: Present / Absent / Half-day
- Monthly payout = sum of (days present × daily rate)

### 19.3 Worker Productivity Report
- Per worker: pieces shaped per day/week/month
- Per worker: earnings for the period
- Comparison: workers side by side (productivity)
- Export to PDF (for salary sheet)

### 19.4 Worker Profile
- Name, contact, address
- Payment type: Per-Piece OR Daily Wages (or Mixed)
- Daily wage rate (if applicable)
- Per-piece rates table (if applicable)
- Join date, active/inactive status

---

## 20. Polishing Vendor Module

### 20.1 Vendor Profile
- Name, contact, address, city
- Specialization (which stone types they handle)
- Active/inactive

### 20.2 Per-Job Tracking
- Job ID, vendor, batch reference
- Stone type + quantity sent
- Date sent → date received
- Cost charged (per piece or per batch)
- Quality notes (any rejections on return)

### 20.3 Vendor Performance Reports
- Average turnaround time (days)
- Total cost over time
- Rejection/quality issue rate
- Cost per piece trend (are they getting more expensive?)
- Side-by-side vendor comparison

---

## 21. Purchase Orders for Rough Material

### 21.1 PO Document
When a rough batch is purchased, system generates a PDF Purchase Order containing:
- PO Number (auto-generated)
- Date
- Supplier name + address
- Stone type
- Weight (kg + carats)
- Price per kg/carat + total amount
- Currency
- Payment terms
- Authorized signature line
- Company letterhead (logo + name configurable)

### 21.2 PO Workflow
- Draft PO → Approved by owner → PDF generated + can be emailed/WhatsApp shared
- PO linked to Rough Batch record
- PO status: Draft / Approved / Delivered / Paid

---

## 22. Remaining Open Questions
*None — all questions answered. Ready to build.*

---

## 23. Quick Reference — What to Buy Before Launch

| Item | What | Estimated Cost |
|------|------|---------------|
| Domain | gemstock.in or similar | ₹800–1500/year |
| WhatsApp Business Number | New SIM + Meta Business verification | Free (SIM cost only) |
| Vercel hosting | Free tier sufficient for start | ₹0 |
| Supabase database | Free tier (500MB) sufficient for start | ₹0 |
| Cloudinary images | Free tier (25GB) sufficient for start | ₹0 |
| Twilio WhatsApp API | ~$0.005 per message | Pay as you go |

---

*This document is the single source of truth. Start every new chat by reading this file.*
*Project memory: `C:\Users\vineeta\.claude\projects\C--Users-vineeta\memory\project_gemstone_inventory.md`*
