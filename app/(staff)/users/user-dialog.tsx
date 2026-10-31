"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { PasswordRules } from "@/components/password-rules";
import { useAction } from "@/components/use-action";
import { zodErrors } from "@/components/forms/zod-errors";
import { createStaffUserAction } from "@/app/actions/catalog";
import { staffUserSchema } from "@/lib/validation";

export function UserDialog() {
  const empty = { name: "", email: "", role: "INTERNAL", password: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = staffUserSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const r = await run(() => createStaffUserAction(v));
    if (r.ok) setOpen(false);
  }
  return (
    <>
      <Button onClick={() => { setV(empty); setOpen(true); }}><Plus className="h-4 w-4" /> New staff user</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New staff user" description="Only admins can create internal users. Customers sign up themselves.">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" error={errors.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Email" error={errors.email}><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Role"><Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}><option value="INTERNAL">Internal</option><option value="ADMIN">Admin</option></Select></Field>
          <Field label="Initial password" error={errors.password}><Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
          <PasswordRules value={v.password} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Create user</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
