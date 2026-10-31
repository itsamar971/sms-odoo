import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { getDb } from "../db/client";
import { can, homeFor, type Permission } from "./rbac";
import type { User } from "../db/types";

export const SESSION_COOKIE = "bl_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  getDb().sessions.insert({ id: token, userId, expiresAt });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) getDb().sessions.delete(token);
  cookies().delete(SESSION_COOKIE);
}

/** Current user for this request (memoised per request). */
export const getSessionUser = cache((): User | null => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const s = db.sessions.get(token);
  if (!s || s.expiresAt < new Date()) return null;
  const user = db.users.get(s.userId);
  return user && user.active ? user : null;
});

/** For pages/layouts: redirect to login, or to the user's home if they lack the permission. */
export function requirePermission(perm: Permission): User {
  const user = getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, perm)) redirect(homeFor(user.role));
  return user;
}

export function requireUser(): User {
  const user = getSessionUser();
  if (!user) redirect("/login");
  return user;
}
