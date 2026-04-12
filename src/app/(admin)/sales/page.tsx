import Link from "next/link";

const CARDS = [
  {
    href: "/sales/consignments",
    icon: "🤝",
    title: "Broker Consignments",
    subtitle: "Issue · Track · Invoice",
    description: "Send stock to brokers, monitor what's sold vs returned, and generate invoices when the sale is confirmed.",
    features: ["Issue items with weight & pcs", "Track sold vs returned", "Create invoices on closure"],
    color: "from-emerald-500/10 to-teal-500/5",
    border: "border-emerald-200/60",
    iconBg: "bg-emerald-100 text-emerald-700",
    accent: "text-emerald-700",
    cta: "View Consignments",
    ctaStyle: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    href: "/sales/direct",
    icon: "💳",
    title: "Direct Sales",
    subtitle: "Sell · Invoice · Collect",
    description: "Record direct sales to walk-in customers or known buyers. Immediate invoicing with cash or credit terms.",
    features: ["Walk-in & known buyers", "Instant invoice generation", "Cash, UPI & credit modes"],
    color: "from-blue-500/10 to-violet-500/5",
    border: "border-blue-200/60",
    iconBg: "bg-blue-100 text-blue-700",
    accent: "text-blue-700",
    cta: "View Direct Sales",
    ctaStyle: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  {
    href: "/brokers",
    icon: "👥",
    title: "Brokers",
    subtitle: "Profiles · Ledger · Reminders",
    description: "Manage broker profiles, view their outstanding balances, and send WhatsApp payment reminders.",
    features: ["Broker profiles & contacts", "Outstanding balance ledger", "WhatsApp reminders"],
    color: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-200/60",
    iconBg: "bg-amber-100 text-amber-700",
    accent: "text-amber-700",
    cta: "View Brokers",
    ctaStyle: "bg-amber-600 hover:bg-amber-700 text-white",
  },
];

const QUICK_ACTIONS = [
  { href: "/sales/consignments", icon: "🤝", label: "New Consignment", desc: "Issue stock to a broker" },
  { href: "/sales/direct", icon: "💳", label: "New Direct Sale", desc: "Sell to a customer" },
  { href: "/payments", icon: "💰", label: "Record Payment", desc: "Mark invoices as paid" },
  { href: "/brokers", icon: "➕", label: "Add Broker", desc: "Register a new broker" },
];

export default function SalesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage consignments, direct sales, and broker relationships
        </p>
      </div>

      {/* Main nav cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.href}
            className={`relative rounded-2xl border ${card.border} bg-gradient-to-br ${card.color} bg-card overflow-hidden shadow-sm hover:shadow-md transition-all group`}
          >
            <div className="p-6">
              {/* Icon + title */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${card.iconBg} shadow-sm`}>
                  {card.icon}
                </div>
                <span className={`text-xs font-semibold tracking-wide ${card.accent} opacity-70`}>
                  {card.subtitle}
                </span>
              </div>

              <h2 className="text-lg font-bold text-foreground mb-1">{card.title}</h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{card.description}</p>

              {/* Feature list */}
              <ul className="space-y-1.5 mb-6">
                {card.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.iconBg.split(" ")[0]}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={card.href}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm ${card.ctaStyle}`}
              >
                {card.cta}
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm hover:bg-accent hover:shadow-md transition-all group"
            >
              <span className="text-xl shrink-0">{a.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{a.label}</p>
                <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
