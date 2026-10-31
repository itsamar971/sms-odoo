/**
 * A tiny transactional in-memory table store ("cache DB").
 *
 * - Data lives in the Node.js process only. Restarting the server (or hitting
 *   "Reset demo data") wipes everything and re-seeds.
 * - Unique constraints are enforced on insert/update and throw UniqueConstraintError,
 *   exactly like a DB unique index would.
 * - `transaction(fn)` keeps an undo journal; if `fn` throws, every write is rolled back.
 *   Because `fn` is synchronous and JS is single-threaded, transactions are fully isolated.
 */

export class UniqueConstraintError extends Error {
  constructor(
    public readonly constraint: string,
    public readonly key: string,
  ) {
    super(`Unique constraint failed on ${constraint} (${key})`);
    this.name = "UniqueConstraintError";
  }
}

type Undo = () => void;

export class TxManager {
  journal: Undo[] | null = null;
  record(undo: Undo) {
    if (this.journal) this.journal.push(undo);
  }
}

type UniqueDef<T> = { key: (row: T) => string | null; map: Map<string, string> };

export interface TableOptions<T> {
  unique?: Record<string, (row: T) => string | null>;
  index?: (keyof T)[];
}

export class Table<T extends { id: string }> {
  private rows = new Map<string, T>();
  private uniques = new Map<string, UniqueDef<T>>();
  private indexes = new Map<keyof T, Map<unknown, Set<string>>>();
  private cache: T[] | null = null;

  constructor(
    public readonly name: string,
    private readonly tx: TxManager,
    opts: TableOptions<T> = {},
  ) {
    for (const [k, fn] of Object.entries(opts.unique ?? {})) this.uniques.set(k, { key: fn, map: new Map() });
    for (const f of opts.index ?? []) this.indexes.set(f, new Map());
  }

  get size() {
    return this.rows.size;
  }

  get(id: string | null | undefined): T | undefined {
    return id ? this.rows.get(id) : undefined;
  }

  /** Snapshot array of all rows (cached until the next write). Treat as read-only. */
  all(): T[] {
    if (!this.cache) this.cache = Array.from(this.rows.values());
    return this.cache;
  }

  filter(pred: (row: T) => boolean): T[] {
    return this.all().filter(pred);
  }

  find(pred: (row: T) => boolean): T | undefined {
    return this.all().find(pred);
  }

  /** Indexed lookup on a declared index field. */
  by<K extends keyof T>(field: K, value: T[K]): T[] {
    const idx = this.indexes.get(field);
    if (!idx) return this.filter((r) => r[field] === value);
    const ids = idx.get(value);
    if (!ids) return [];
    const out: T[] = [];
    for (const id of ids) {
      const r = this.rows.get(id);
      if (r) out.push(r);
    }
    return out;
  }

  /** Lookup a row by a unique key. */
  byUnique(constraint: string, key: string): T | undefined {
    const id = this.uniques.get(constraint)?.map.get(key);
    return id ? this.rows.get(id) : undefined;
  }

  insert(row: T): T {
    if (this.rows.has(row.id)) throw new UniqueConstraintError(`${this.name}.id`, row.id);
    this.checkUniques(row, null);
    this._add(row);
    this.tx.record(() => this._remove(row));
    return row;
  }

  update(id: string, patch: Partial<T> | ((row: T) => Partial<T>)): T {
    const old = this.rows.get(id);
    if (!old) throw new Error(`${this.name}: row ${id} not found`);
    const p = typeof patch === "function" ? patch(old) : patch;
    const next = { ...old, ...p, id: old.id } as T;
    this.checkUniques(next, old);
    this._remove(old);
    this._add(next);
    this.tx.record(() => {
      this._remove(next);
      this._add(old);
    });
    return next;
  }

  delete(id: string): void {
    const old = this.rows.get(id);
    if (!old) return;
    this._remove(old);
    this.tx.record(() => this._add(old));
  }

  private checkUniques(row: T, old: T | null) {
    for (const [name, def] of this.uniques) {
      const k = def.key(row);
      if (k === null) continue;
      const owner = def.map.get(k);
      if (owner && owner !== (old?.id ?? null) && owner !== row.id) {
        throw new UniqueConstraintError(`${this.name}.${name}`, k);
      }
    }
  }

  private _add(row: T) {
    this.rows.set(row.id, row);
    for (const def of this.uniques.values()) {
      const k = def.key(row);
      if (k !== null) def.map.set(k, row.id);
    }
    for (const [field, idx] of this.indexes) {
      const v = row[field];
      let set = idx.get(v);
      if (!set) idx.set(v, (set = new Set()));
      set.add(row.id);
    }
    this.cache = null;
  }

  private _remove(row: T) {
    this.rows.delete(row.id);
    for (const def of this.uniques.values()) {
      const k = def.key(row);
      if (k !== null && def.map.get(k) === row.id) def.map.delete(k);
    }
    for (const [field, idx] of this.indexes) {
      idx.get(row[field])?.delete(row.id);
    }
    this.cache = null;
  }
}

/** Bundle-safe check (the DB instance may be created by a different webpack bundle). */
export function isUniqueConstraintError(e: unknown): e is UniqueConstraintError {
  return e instanceof Error && e.name === "UniqueConstraintError";
}
