import { useSession } from "next-auth/react";

export function useRole(): string | null {
  const { data: session } = useSession();
  return (session?.user as { role?: string })?.role ?? null;
}
