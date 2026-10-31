import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/rbac";

export default function Home() {
  const user = getSessionUser();
  redirect(user ? homeFor(user.role) : "/login");
}
