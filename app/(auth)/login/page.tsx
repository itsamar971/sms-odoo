import { LoginForm } from "./login-form";
import { DEMO_CREDENTIALS } from "@/lib/db/seed";

export const metadata = { title: "Sign in · Brightloop" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return <LoginForm next={searchParams.next} demo={DEMO_CREDENTIALS} />;
}
