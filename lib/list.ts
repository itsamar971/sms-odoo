export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 25;

export interface ListParams {
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
}

export function str(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function parseList(sp: SearchParams, defaults: { sort: string; dir?: "asc" | "desc" }): ListParams {
  const page = Math.max(1, Number(str(sp, "page")) || 1);
  const dir = str(sp, "dir") === "asc" ? "asc" : str(sp, "dir") === "desc" ? "desc" : (defaults.dir ?? "desc");
  return { page, pageSize: PAGE_SIZE, sort: str(sp, "sort") ?? defaults.sort, dir };
}

/** Server-side sort + paginate. Only the requested page leaves the server. */
export function paginate<T>(rows: T[], p: ListParams, sorters: Record<string, (r: T) => string | number>): Page<T> {
  const key = sorters[p.sort] ? p.sort : Object.keys(sorters)[0];
  const get = sorters[key];
  const mult = p.dir === "asc" ? 1 : -1;
  const sorted = rows.slice().sort((a, b) => {
    const x = get(a);
    const y = get(b);
    return (x < y ? -1 : x > y ? 1 : 0) * mult;
  });
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / p.pageSize));
  const page = Math.min(p.page, pageCount);
  return {
    rows: sorted.slice((page - 1) * p.pageSize, page * p.pageSize),
    total,
    page,
    pageCount,
    pageSize: p.pageSize,
    sort: key,
    dir: p.dir,
  };
}
