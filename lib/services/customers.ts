import { z } from "zod";
import { getDb } from "../db/client";
import { newId } from "../db/database";
import { isUniqueConstraintError } from "../db/store";
import { NotFoundError, ServiceError } from "../errors";
import { customerSchema } from "../validation";
import type { Customer } from "../db/types";

export function saveCustomer(id: string | null, raw: z.input<typeof customerSchema>): Customer {
  const input = customerSchema.parse(raw);
  const db = getDb();
  try {
    if (id) {
      if (!db.customers.get(id)) throw new NotFoundError("Customer");
      return db.customers.update(id, input);
    }
    return db.customers.insert({ id: newId(), ...input, createdAt: new Date() });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new ServiceError("A customer with this email already exists");
    throw e;
  }
}

export function deleteCustomer(id: string) {
  const db = getDb();
  if (db.subscriptions.by("customerId", id).length || db.invoices.by("customerId", id).length)
    throw new ServiceError("This customer has subscriptions or invoices and cannot be deleted");
  db.transaction(() => {
    for (const u of db.users.by("customerId", id)) db.users.delete(u.id);
    db.customers.delete(id);
  });
}
