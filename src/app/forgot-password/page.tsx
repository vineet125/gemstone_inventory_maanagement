"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    const data = await res.json();
    if (res.ok && data.token) {
      setResetToken(data.token);
      setUserName(data.name ?? "");
    } else if (res.ok) {
      // Email not found but we don't reveal it — show generic success
      setResetToken("NOT_FOUND");
    } else {
      setError(data.error ?? "Something went wrong.");
    }
  }

  const resetUrl = resetToken && resetToken !== "NOT_FOUND"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password?token=${resetToken}`
    : "";

  async function copyLink() {
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (resetToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gem-50 to-gem-100">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="text-4xl mb-4">🔑</div>
          {resetToken === "NOT_FOUND" ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for <strong>{email}</strong>, a reset link has been generated.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Reset link ready</h2>
              <p className="text-sm text-gray-500 mb-2">
                Hello <strong>{userName}</strong>! Copy the link below and open it in your browser.
                This link expires in <strong>1 hour</strong>.
              </p>
              <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3 text-left break-all text-xs text-gray-600 font-mono mb-3">
                {resetUrl}
              </div>
              <button
                onClick={copyLink}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors mb-3"
              >
                {copied ? "✓ Copied!" : "Copy Reset Link"}
              </button>
              <Link href={resetUrl}
                className="block w-full rounded-lg border border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors">
                Open Reset Page →
              </Link>
            </>
          )}
          <Link href="/login" className="mt-6 block text-sm text-gray-400 hover:text-gray-600">
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gem-50 to-gem-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your email and we&apos;ll generate a reset link for you.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Generating link…" : "Get Reset Link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Remember your password?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
