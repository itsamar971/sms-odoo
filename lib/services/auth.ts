import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { getDb } from "../db/client";
import { newId } from "../db/database";
import { isUniqueConstraintError } from "../db/store";
import { ForbiddenError, NotFoundError, ServiceError } from "../errors";
import { resetSchema, signupSchema, staffUserSchema } from "../validation";
import type { User } from "../db/types";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export function hashPasswordSync(pw: string, rounds = 10) {
  return bcrypt.hashSync(pw, rounds);
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function findUserByEmail(email: string): User | undefined {
  return getDb().users.byUnique("email", email.trim().toLowerCase());
}

/** Self-signup always creates a PORTAL user with a linked Customer. */
export async function signup(raw: z.input<typeof signupSchema>): Promise<User> {
  const input = signupSchema.parse(raw);
  const db = getDb();
  if (findUserByEmail(input.email)) throw new ServiceError("An account with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    return db.transaction(() => {
      // If staff already created this customer, link the portal login to it.
      let customer = db.customers.byUnique("email", input.email);
      if (!customer) {
        customer = db.customers.insert({
          id: newId(),
          name: input.name,
          email: input.email,
          phone: input.phone ?? "",
          address: "",
          gstin: null,
          createdAt: new Date(),
        });
      }
      return db.users.insert({
        id: newId(),
        email: input.email,
        passwordHash,
        role: "PORTAL",
        name: input.name,
        customerId: customer.id,
        active: true,
        createdAt: new Date(),
      });
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new ServiceError("An account with this email already exists");
    throw e;
  }
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = findUserByEmail(email);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) return null;
  return user;
}

/** Creates a single-use reset token (only its SHA-256 hash is stored), valid for 30 minutes. */
export function createPasswordResetToken(email: string, now = new Date()): { token: string; user: User } | null {
  const db = getDb();
  const user = findUserByEmail(email);
  if (!user || !user.active) return null;
  const token = randomBytes(32).toString("hex");
  db.transaction(() => {
    for (const t of db.resetTokens.by("userId", user.id)) if (!t.usedAt) db.resetTokens.update(t.id, { usedAt: now });
    db.resetTokens.insert({
      id: newId(),
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      usedAt: null,
    });
  });
  return { token, user };
}

export function checkResetToken(token: string, now = new Date()) {
  const t = getDb().resetTokens.byUnique("tokenHash", sha256(token));
  if (!t) return { ok: false as const, reason: "This reset link is invalid" };
  if (t.usedAt) return { ok: false as const, reason: "This reset link has already been used" };
  if (t.expiresAt < now) return { ok: false as const, reason: "This reset link has expired" };
  return { ok: true as const, record: t };
}

export async function resetPassword(raw: z.input<typeof resetSchema>, now = new Date()) {
  const input = resetSchema.parse(raw);
  const check = checkResetToken(input.token, now);
  if (!check.ok) throw new ServiceError(check.reason);
  const passwordHash = await bcrypt.hash(input.password, 10);
  const db = getDb();
  // Re-check after the async hash so a token can never be used twice.
  const again = checkResetToken(input.token, now);
  if (!again.ok) throw new ServiceError(again.reason);
  db.transaction(() => {
    db.users.update(check.record.userId, { passwordHash });
    db.resetTokens.update(check.record.id, { usedAt: now });
    for (const s of db.sessions.by("userId", check.record.userId)) db.sessions.delete(s.id);
  });
}

/** Only ADMIN can create staff (INTERNAL / ADMIN) users. */
export async function createStaffUser(raw: z.input<typeof staffUserSchema>, actor: User): Promise<User> {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Only admins can create internal users");
  const input = staffUserSchema.parse(raw);
  if (findUserByEmail(input.email)) throw new ServiceError("A user with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    return getDb().users.insert({
      id: newId(),
      email: input.email,
      passwordHash,
      role: input.role,
      name: input.name,
      customerId: null,
      active: true,
      createdAt: new Date(),
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new ServiceError("A user with this email already exists");
    throw e;
  }
}

export function setUserActive(id: string, active: boolean, actor: User) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
  if (id === actor.id) throw new ServiceError("You cannot deactivate yourself");
  const db = getDb();
  if (!db.users.get(id)) throw new NotFoundError("User");
  db.transaction(() => {
    db.users.update(id, { active });
    if (!active) for (const s of db.sessions.by("userId", id)) db.sessions.delete(s.id);
  });
}
