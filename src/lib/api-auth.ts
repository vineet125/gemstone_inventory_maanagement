import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type AllowedRole = "OWNER" | "MANAGER" | "ACCOUNTANT" | "STAFF" | "WORKER";

/**
 * Call at the top of any API route handler.
 * Returns { session } on success, or a ready-to-return NextResponse on failure.
 */
export async function requireAuth(allowedRoles?: AllowedRole[]) {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role as AllowedRole)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}
