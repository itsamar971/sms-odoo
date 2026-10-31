import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { UserDialog } from "./user-dialog";
import { setUserActiveAction } from "@/app/actions/catalog";

export default function UsersPage() {
  const me = requirePermission("users:manage");
  const db = getDb();
  const staff = db.users.filter((u) => u.role !== "PORTAL");
  const portalCount = db.users.by("role", "PORTAL").length;
  return (
    <>
      <PageHeader title="Users" description={`Staff accounts. ${portalCount} customer portal logins are managed via signup.`} actions={<UserDialog />} />
      <Card>
        <Table>
          <THead><TR><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Status</TH><TH /></TR></THead>
          <TBody>
            {staff.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name}{u.id === me.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TD>
                <TD className="text-muted-foreground">{u.email}</TD>
                <TD><StatusBadge status={u.role} /></TD>
                <TD>{u.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</TD>
                <TD className="text-right">
                  {u.id !== me.id && (
                    <ConfirmButton variant="outline" size="sm" destructive={u.active} action={setUserActiveAction.bind(null, u.id, !u.active)}
                      title={u.active ? `Deactivate ${u.name}?` : `Reactivate ${u.name}?`} description={u.active ? "They will be signed out immediately." : undefined}
                      confirmLabel={u.active ? "Deactivate" : "Reactivate"}>
                      {u.active ? "Deactivate" : "Reactivate"}
                    </ConfirmButton>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
