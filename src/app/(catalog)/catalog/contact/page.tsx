"use client";

import { useEffect, useState } from "react";

const WA_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [waNumber, setWaNumber] = useState("919999999999");

  useEffect(() => {
    fetch("/api/catalog/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((s) => { if (s?.waNumber) setWaNumber(s.waNumber); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/catalog/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSending(false);
    if (res.ok) setSent(true);
    else setError("Something went wrong. Please try again or WhatsApp us directly.");
  }

  if (sent) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
            style={{ background: "linear-gradient(135deg,#d4822a,#b45309)" }}>
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Inquiry Received!</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Thank you for reaching out. We will contact you via WhatsApp or phone within a few hours.
          </p>
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] px-6 py-3 text-sm font-semibold text-white transition-colors">
            {WA_ICON} Chat now on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="bg-[#0f0e0c] py-14 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-amber-400 text-xs font-semibold tracking-[0.25em] uppercase mb-2">Get in Touch</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Send an Inquiry</h1>
          <p className="text-gray-400 leading-relaxed">
            Interested in our stones? Fill out the form below and we will get back to you with pricing and availability.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">

          {/* Left: Form */}
          <div className="lg:col-span-3">
            {error && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Inquiry *</label>
                <textarea
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  placeholder="Describe what you're looking for — stone type, shape, size, colour, grade, quantity needed, intended use…"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sending || !form.name || !form.phone || !form.message}
                className="w-full rounded-xl py-4 text-base font-semibold text-white transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#d4822a,#b45309)" }}>
                {sending ? "Sending…" : "Send Inquiry"}
              </button>

              <p className="text-xs text-center text-gray-400">
                We typically respond within a few hours · Your details are kept confidential
              </p>
            </form>
          </div>

          {/* Right: Contact info */}
          <div className="lg:col-span-2 space-y-5">
            {/* WhatsApp card */}
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-4 rounded-2xl border border-gray-100 p-5 hover:border-green-200 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0 text-[#25D366] group-hover:bg-[#25D366]/20 transition-colors">
                {WA_ICON}
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-0.5">WhatsApp Direct</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  For the fastest response, send us a message directly on WhatsApp. We typically reply within the hour.
                </p>
                <p className="text-sm text-[#25D366] font-medium mt-2">Chat now →</p>
              </div>
            </a>

            {/* Info card */}
            <div className="rounded-2xl border border-gray-100 p-5 space-y-4">
              <p className="font-semibold text-gray-900">What to Include</p>
              {[
                "Stone type (Amethyst, Citrine, etc.)",
                "Shape & size preference",
                "Grade requirement (AA, A, B…)",
                "Quantity needed (pieces or carats)",
                "Delivery location",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold text-xs mt-0.5">◆</span>
                  <p className="text-sm text-gray-600">{item}</p>
                </div>
              ))}
            </div>

            {/* Trust note */}
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5">
              <p className="text-sm font-semibold text-amber-900 mb-1">B2B Wholesale Only</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                We supply to jewellers, exporters, and retail businesses. Minimum order quantities apply.
                All prices quoted on request.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
