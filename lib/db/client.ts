import { Database } from "./database";
import { seedDatabase } from "./seed";

const g = globalThis as unknown as { __brightloopDb?: Database; __brightloopSeeding?: boolean };

/**
 * The process-wide in-memory database. It is created and seeded lazily on first use,
 * and survives Next.js hot reloads (stored on globalThis). A server restart wipes it.
 */
export function getDb(): Database {
  if (!g.__brightloopDb) {
    const db = new Database();
    g.__brightloopDb = db; // set before seeding so services used by the seed see this instance
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      const t0 = Date.now();
      seedDatabase(db);
      console.log(`[db] in-memory database seeded in ${Date.now() - t0}ms`);
    }
  }
  return g.__brightloopDb;
}

/** Replace the active database (tests, "Reset demo data"). */
export function setDb(db: Database): Database {
  g.__brightloopDb = db;
  return db;
}

/** Wipe everything and seed fresh demo data. */
export function resetDb(): Database {
  const db = new Database();
  g.__brightloopDb = db;
  seedDatabase(db);
  return db;
}
