import type { NextAuthConfig } from "next-auth";

const ADMIN_PATHS = [
  "/dashboard",
  "/manufacturing",
  "/inventory",
  "/sales",
  "/brokers",
  "/payments",
  "/workers",
  "/reports",
  "/settings",
];

const STAFF_ALLOWED_PATHS = ["/workers", "/manufacturing"];

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminPath = ADMIN_PATHS.some((p) => nextUrl.pathname.startsWith(p));

      if (isAdminPath) {
        if (!isLoggedIn) return false;
        const role = (auth?.user as { role?: string })?.role;
        if (role === "STAFF") {
          const allowed = STAFF_ALLOWED_PATHS.some((p) => nextUrl.pathname.startsWith(p));
          if (!allowed) return Response.redirect(new URL("/workers/daily", nextUrl));
        }
        return true;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [],
};
