import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/settings/stone-types", title: "Stone Types", desc: "Citrine, Amethyst, Garnet, etc." },
          { href: "/settings/shapes", title: "Shapes", desc: "Oval, Round, Octagon, etc." },
          { href: "/settings/sizes", title: "Sizes", desc: "6x4, 8x6, 10x8, etc." },
          { href: "/settings/colors", title: "Colors", desc: "Colors per stone type" },
          { href: "/settings/grades", title: "Grades", desc: "AAA, AA, A (customizable)" },
          { href: "/settings/users", title: "Users & Roles", desc: "Manage staff access" },
          { href: "/settings/currency", title: "Currency", desc: "INR default + others" },
          { href: "/settings/company", title: "Company Profile", desc: "Logo, letterhead for POs/invoices" },
          { href: "/settings/catalog", title: "Catalog Settings", desc: "Public website — name, hero, stone images, WhatsApp" },
          { href: "/settings/demo-data", title: "🧪 Demo Data", desc: "Seed 100 brokers, 50 workers, 500+ orders for testing" },
        ].map((s) => (
          <Link key={s.href} href={s.href}
            className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-base font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
