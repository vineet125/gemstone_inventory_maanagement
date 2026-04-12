"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);

  const name = session?.user?.name ?? "User";
  const role = (session?.user as { role?: string })?.role ?? "";
  const initial = name[0]?.toUpperCase() ?? "U";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      {/* Left */}
      <div />

      {/* Right */}
      <div className="flex items-center gap-4">
        {/* Alerts bell */}
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent">
          🔔
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {initial}
            </div>
            <span className="hidden sm:block">{name}</span>
            {role && (
              <span className="hidden sm:block text-xs text-muted-foreground bg-accent rounded px-1.5 py-0.5">
                {role}
              </span>
            )}
            <span className="text-muted-foreground text-xs">▾</span>
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border bg-card shadow-lg py-1">
                <div className="px-4 py-2.5 border-b">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
