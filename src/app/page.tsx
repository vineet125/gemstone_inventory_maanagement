import { redirect } from "next/navigation";

// Root redirects to admin dashboard (if logged in) or login page
export default function RootPage() {
  redirect("/dashboard");
}
