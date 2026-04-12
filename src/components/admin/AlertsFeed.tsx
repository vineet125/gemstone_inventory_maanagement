export function AlertsFeed() {
  const alerts = [
    { type: "overdue", message: "Ramesh Bros — ₹12,000 overdue (3 days)", color: "text-red-600 bg-red-50" },
    { type: "lowstock", message: "Citrine Oval 6x4 Yellow AAA — only 5 pieces left", color: "text-orange-600 bg-orange-50" },
    { type: "stuck", message: "Batch #B039 — no movement for 18 days (Shaping stage)", color: "text-yellow-600 bg-yellow-50" },
  ];

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-foreground">Alerts</h2>
      <div className="space-y-3">
        {alerts.map((a, i) => (
          <div key={i} className={`rounded-lg px-4 py-3 text-sm font-medium ${a.color}`}>
            {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}
