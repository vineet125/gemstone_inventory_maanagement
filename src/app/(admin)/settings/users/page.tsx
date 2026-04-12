"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Role = "OWNER" | "MANAGER" | "ACCOUNTANT" | "STAFF" | "WORKER";
interface User { id: string; name: string; email: string; role: Role; phone: string | null; active: boolean; createdAt: string; }

const ROLE_COLORS: Record<Role, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  ACCOUNTANT: "bg-green-100 text-green-700",
  STAFF: "bg-yellow-100 text-yellow-700",
  WORKER: "bg-gray-100 text-foreground",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" as Role, phone: "" });
  const [saving, setSaving] = useState(false);
  const isAdmin = useIsAdmin();

  async function load() {
    const res = await fetch("/api/settings/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "STAFF", phone: "" });
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role, phone: user.phone ?? "" });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editing && !form.password) { toast.error("Password required for new users"); return; }
    setSaving(true);
    const payload: Record<string, string> = { name: form.name, role: form.role };
    if (!editing) { payload.email = form.email; payload.password = form.password; }
    if (form.password && editing) payload.password = form.password;
    if (form.phone) payload.phone = form.phone;

    const url = editing ? `/api/settings/users/${editing.id}` : "/api/settings/users";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) { toast.success(editing ? "Updated" : "User created"); setShowForm(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "Something went wrong"); }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/settings/users/${user.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users & Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage staff access and permissions</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + Invite User
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit User" : "Add User"}</h2>
            <div className={`space-y-3${saving ? " pointer-events-none opacity-50 select-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Full name" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="user@example.com" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {editing ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  <option value="OWNER">Owner / Super Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="STAFF">Staff</option>
                  <option value="WORKER">Worker</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone (optional)</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground/60">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isAdmin ? (
                      <button onClick={() => toggleActive(user)}
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </button>
                    ) : (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(user)} className="text-primary hover:underline text-xs">Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Role permissions legend */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
          <div><span className="font-medium text-purple-700">Owner</span> — Full access, all data, cost prices visible</div>
          <div><span className="font-medium text-blue-700">Manager</span> — All operations, financial reports, cost visible</div>
          <div><span className="font-medium text-green-700">Accountant</span> — Payments, invoices, reports, cost visible</div>
          <div><span className="font-medium text-yellow-700">Staff</span> — Inventory & sales entry, no cost price</div>
          <div><span className="font-medium text-foreground">Worker</span> — Manufacturing stage updates only</div>
        </div>
      </div>
    </div>
  );
}
