import { getDb } from "../db/client";
import { newId } from "../db/database";
import type { StatusHistory } from "../db/types";

export function logStatus(
  entity: StatusHistory["entity"],
  entityId: string,
  from: string | null,
  to: string,
  byUserId: string | null,
  note?: string,
  at: Date = new Date(),
) {
  getDb().statusHistory.insert({ id: newId(), entity, entityId, from, to, byUserId, at, note });
}
