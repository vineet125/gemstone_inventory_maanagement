import { useSession } from "next-auth/react";

/** Returns true if the logged-in user is OWNER or MANAGER */
export function useIsAdmin(): boolean {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  return role === "OWNER" || role === "MANAGER";
}
