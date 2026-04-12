"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

interface WaNotification {
  id: string;
  recipientPhone: string;
  message: string;
  status: string;
  referenceType: string | null;
  createdAt: string;
  sentAt: string | null;
}

const SETTING_KEYS = [
  { key: "wa_notify_brokers", label: "Broker Notifications", desc: "Queue WhatsApp when consignment is created or items returned" },
  { key: "wa_notify_vendors", label: "Polishing Vendor Notifications", desc: "Queue WhatsApp when polishing job is sent or received back" },
  { key: "wa_notify_workers", label: "Worker Notifications", desc: "Queue WhatsApp when a worker is assigned to a job" },
];

const REF_TYPE_BADGE: Record<string, string> = {
  CONSIGNMENT: "bg-blue-100 text-blue-700",
  STAGE_POLISHING_SEND: "bg-amber-100 text-amber-700",
  STAGE_POLISHING_RECEIVE: "bg-green-100 text-green-700",
  STAGE_ASSIGNMENT: "bg-purple-100 text-purple-700",
};

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<WaNotification[]>([]);
  const [tab, setTab] = useState<"PENDING" | "SENT" | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  async function loadSettings() {
    const res = await fetch("/api/settings/catalog-site");
    if (res.ok) setSettings(await res.json());
  }

  async function loadNotifications(status: "PENDING" | "SENT" | "ALL") {
    const url = status === "ALL" ? "/api/notifications/whatsapp" : `/api/notifications/whatsapp?status=${status}`;
    const res = await fetch(url);
    if (res.ok) setNotifications(await res.json());
  }

  async function load() {
    setLoading(true);
    await Promise.all([loadSettings(), loadNotifications(tab)]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeTab(t: "PENDING" | "SENT" | "ALL") {
    setTab(t);
    await loadNotifications(t);
  }

  async function toggleSetting(key: string) {
    const current = settings[key] === "true";
    const newVal = (!current).toString();
    setSettings((prev) => ({ ...prev, [key]: newVal }));
    const res = await fetch("/api/settings/catalog-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newVal }),
    });
    if (!res.ok) {
      setSettings((prev) => ({ ...prev, [key]: current.toString() }));
      toast.error("Failed to save setting");
    }
  }

  async function markSent(id: string) {
    setMarking(id);
    const res = await fetch(`/api/notifications/whatsapp/${id}`, { method: "PUT" });
    setMarking(null);
    if (res.ok) {
      toast.success("Marked as sent");
      await loadNotifications(tab);
    } else {
      toast.error("Failed to update");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure global notification categories and manage the outbound message queue.</p>
      </div>

      {/* Global toggles */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Global Settings</h2>
        <div className="space-y-4">
          {SETTING_KEYS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings[key] === "true" ? "bg-green-500" : "bg-gray-300"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${settings[key] === "true" ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground/60">
          These are master switches. Individual contacts also have their own on/off controls on their profile pages.
          A message is queued only when BOTH the global switch AND the individual contact switch are ON.
        </p>
      </div>

      {/* Message Queue */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Message Queue</h2>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["PENDING", "SENT", "ALL"] as const).map((t) => (
              <button key={t}
                onClick={() => changeTab(t)}
                className={`px-3 py-1.5 font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                {t === "ALL" ? "All" : t === "PENDING" ? "Pending" : "Sent"}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground/60">No messages in this queue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Message</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-accent">
                    <td className="px-4 py-3">
                      {n.referenceType ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${REF_TYPE_BADGE[n.referenceType] ?? "bg-gray-100 text-muted-foreground"}`}>
                          {n.referenceType.replace(/_/g, " ")}
                        </span>
                      ) : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{n.recipientPhone}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{n.message.length > 80 ? `${n.message.slice(0, 80)}...` : n.message}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${n.status === "SENT" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {format(new Date(n.createdAt), "dd MMM, h:mm a")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {n.status === "PENDING" && (
                        <button
                          onClick={() => markSent(n.id)}
                          disabled={marking === n.id}
                          className="text-xs text-primary hover:underline disabled:opacity-50">
                          {marking === n.id ? "..." : "Mark Sent"}
                        </button>
                      )}
                      {n.status === "SENT" && n.sentAt && (
                        <span className="text-xs text-muted-foreground/60">{format(new Date(n.sentAt), "dd MMM")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
