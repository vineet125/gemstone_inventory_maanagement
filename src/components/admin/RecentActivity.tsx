export function RecentActivity() {
  const activities = [
    { time: "2h ago", text: "Batch #B042 moved to Shaping stage" },
    { time: "5h ago", text: "Consignment #C021 — 40 pieces returned by Mehta Gems" },
    { time: "Yesterday", text: "Payment ₹25,000 received from Jain Brothers" },
    { time: "Yesterday", text: "New batch #B043 — 2.5kg Amethyst rough added" },
    { time: "2 days ago", text: "Citrine Oval 8x6 AAA — 50 pieces added to inventory" },
  ];

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-foreground">Recent Activity</h2>
      <div className="space-y-3">
        {activities.map((a, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <span className="shrink-0 text-xs text-muted-foreground/60 pt-0.5 w-20">{a.time}</span>
            <span className="text-foreground">{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
