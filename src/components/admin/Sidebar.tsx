"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeSelector } from "@/components/ThemeSelector";
import { useRole } from "@/hooks/useRole";

const navItems = [
  { href: "/dashboard",           label: "Dashboard",       icon: "📊" },
  { href: "/workers",             label: "Workers",         icon: "👷", children: [
    { href: "/workers/daily",        label: "Daily Register" },
    { href: "/workers/settlements",  label: "Settlements" },
  ]},
  { href: "/manufacturing",       label: "Manufacturing",   icon: "🏭", children: [
    { href: "/manufacturing/batches",  label: "Purchase Orders" },
    { href: "/manufacturing/stages",   label: "Stage Board" },
    { href: "/manufacturing/polishing",label: "Polishing" },
  ]},
  { href: "/inventory",           label: "Inventory",       icon: "📦" },
  { href: "/transactions",        label: "Transactions",    icon: "🔄" },
  { href: "/sales",               label: "Sales",           icon: "🤝", children: [
    { href: "/sales/consignments", label: "Consignments" },
    { href: "/sales/direct",       label: "Direct Sales" },
  ]},
  { href: "/brokers",             label: "Brokers",         icon: "👥" },
  { href: "/payments",            label: "Payments",        icon: "💰" },
  { href: "/reports",             label: "Reports",         icon: "📄" },
  { href: "/settings",            label: "Settings",        icon: "⚙️", children: [
    { href: "/settings/catalog",         label: "Catalog Setup" },
    { href: "/settings/catalog-items",   label: "Catalog Items" },
    { href: "/settings/stone-types",     label: "Stone Types" },
    { href: "/settings/notifications",   label: "WhatsApp Notifications" },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const role = useRole();
  const isStaff = role === "STAFF";

  const visibleItems = isStaff
    ? navItems.filter((item) => item.href.startsWith("/workers") || item.href.startsWith("/manufacturing"))
    : navItems;

  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      {/* Logo */}
      <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b px-5 hover:bg-accent transition-colors">
        <span className="text-2xl">💎</span>
        <span className="text-lg font-bold text-foreground">GemStock</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>

            {/* Sub-items */}
            {item.children && (pathname === item.href || pathname.startsWith(item.href + "/")) && (
              <div className="ml-8 mt-1 space-y-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                      pathname === child.href
                        ? "font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Theme selector */}
      <div className="border-t px-3 py-3">
        <ThemeSelector />
      </div>
    </aside>
  );
}
