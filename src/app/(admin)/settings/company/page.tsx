"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CompanyProfile {
  name: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  whatsapp: string;
  email: string;
  gstNumber: string;
  panNumber: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
}

const DEFAULT: CompanyProfile = {
  name: "", tagline: "", address: "", city: "", state: "", pincode: "",
  phone: "", whatsapp: "", email: "", gstNumber: "", panNumber: "",
  bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "",
};

const STORAGE_KEY = "gemstock_company_profile";

export default function CompanyProfilePage() {
  const [form, setForm] = useState<CompanyProfile>(DEFAULT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try { setForm({ ...DEFAULT, ...JSON.parse(data) }); } catch { /* ignore */ }
    }
  }, []);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setSaved(true);
    toast.success("Company profile saved");
    setTimeout(() => setSaved(false), 2000);
  }

  function field(label: string, key: keyof CompanyProfile, placeholder?: string, required?: boolean) {
    return (
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {label}{required && " *"}
        </label>
        <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Used in invoice headers, purchase orders, and letterheads.</p>
      </div>

      <div className="rounded-xl border bg-blue-50 border-blue-200 p-4 text-sm text-blue-700">
        Profile is saved locally in this browser. It will auto-populate on printed documents.
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Business Information</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("Company / Business Name", "name", "Shree Gems & Minerals", true)}
          {field("Tagline", "tagline", "Premium Semi-Precious Stones")}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Street / Area"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("City", "city", "Jaipur")}
          {field("State", "state", "Rajasthan")}
          {field("Pincode", "pincode", "302001")}
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Contact Details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("Phone", "phone", "+91 98765 43210")}
          {field("WhatsApp", "whatsapp", "+91 98765 43210")}
          {field("Email", "email", "info@yourbusiness.com")}
        </div>
      </div>

      {/* Tax Info */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Tax Registration</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("GST Number", "gstNumber", "08XXXXX0000X1Z5")}
          {field("PAN Number", "panNumber", "XXXXX0000X")}
        </div>
      </div>

      {/* Bank Details */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Bank Details <span className="text-xs font-normal text-muted-foreground/60">(for invoice payment section)</span></h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("Bank Name", "bankName", "State Bank of India")}
          {field("Account Number", "bankAccount", "XXXXXXXXXXXXXXXXX")}
          {field("IFSC Code", "bankIfsc", "SBIN0001234")}
          {field("Branch", "bankBranch", "Johari Bazaar, Jaipur")}
        </div>
      </div>

      {/* Preview Card */}
      {form.name && (
        <div className="rounded-xl border-2 border-dashed border-border p-5">
          <p className="text-xs text-muted-foreground/60 mb-3 font-medium uppercase tracking-wide">Invoice Header Preview</p>
          <div className="text-foreground">
            <h3 className="text-lg font-bold">{form.name}</h3>
            {form.tagline && <p className="text-sm text-muted-foreground">{form.tagline}</p>}
            {form.address && <p className="text-sm mt-1">{form.address}</p>}
            {(form.city || form.state) && (
              <p className="text-sm">{[form.city, form.state, form.pincode].filter(Boolean).join(", ")}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              {form.phone && <span>📞 {form.phone}</span>}
              {form.email && <span>✉ {form.email}</span>}
              {form.gstNumber && <span>GST: {form.gstNumber}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSave}
          className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors
            ${saved ? "bg-green-600" : "bg-primary hover:bg-primary/90"}`}>
          {saved ? "Saved!" : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
