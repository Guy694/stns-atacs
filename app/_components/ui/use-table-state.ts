"use client";

// Client-side sort + pagination for tables whose rows are already in the browser
// (admin settings, user management). Pair with <SortableTh onSort> and <TablePagination onPage>.
import { useState } from "react";

import { DEFAULT_PAGE_SIZE, paginate, sortRows, type SortState } from "@/lib/table-sort";

export function useTableState<T>(
  rows: readonly T[],
  accessors: Record<string, (row: T) => unknown>,
  options: { initialSort?: SortState | null; pageSize?: number } = {}
) {
  const [sort, setSort] = useState<SortState | null>(options.initialSort ?? null);
  const [page, setPage] = useState(1);
  const result = paginate(sortRows(rows, sort, accessors), page, options.pageSize ?? DEFAULT_PAGE_SIZE);

  function onSort(key: string) {
    setSort((current) => (current?.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }

  return { ...result, sort, onSort, onPage: setPage, resetPage: () => setPage(1) };
}
