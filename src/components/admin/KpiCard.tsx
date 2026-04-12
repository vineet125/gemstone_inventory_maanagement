import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: string;
}

export function KpiCard({ title, value, change, trend, icon }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span className="text-xl">{icon === "package" ? "📦" : icon === "handshake" ? "🤝" : icon === "rupee" ? "💰" : "🏭"}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className={cn(
        "mt-1 text-xs font-medium",
        trend === "up" && "text-green-600",
        trend === "down" && "text-red-500",
        trend === "neutral" && "text-muted-foreground",
      )}>
        {trend === "up" && "↑ "}{trend === "down" && "↓ "}{change}
      </p>
    </div>
  );
}
