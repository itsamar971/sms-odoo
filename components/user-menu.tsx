import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Badge, STATUS_TONE } from "./ui/badge";
import type { User } from "@/lib/db/types";

export function UserMenu({ user }: { user: Pick<User, "name" | "email" | "role"> }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <Badge tone={STATUS_TONE[user.role]}>{user.role}</Badge>
      <form action={logoutAction}>
        <button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
