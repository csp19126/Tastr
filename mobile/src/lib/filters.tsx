import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Category, Tag } from '@shared';

export type Filters = {
  q: string;
  categories: Category[];
  price: number[];
  tags: Tag[];
  minRating: number | null;
  openNow: boolean;
  radiusKm: number;
  sort: 'distance' | 'rating' | 'popular' | 'newest';
};

export const DEFAULT_FILTERS: Filters = {
  q: '',
  categories: [],
  price: [],
  tags: [],
  minRating: null,
  openNow: false,
  radiusKm: 10,
  sort: 'distance',
};

/** How many filters are switched on, for the badge on the Filters button. */
export function activeFilterCount(f: Filters) {
  return f.categories.length + f.price.length + f.tags.length + (f.minRating ? 1 : 0) + (f.openNow ? 1 : 0) + (f.radiusKm !== DEFAULT_FILTERS.radiusKm ? 1 : 0);
}

const Ctx = createContext<{ filters: Filters; setFilters: (f: Filters) => void } | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const value = useMemo(() => ({ filters, setFilters }), [filters]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilters outside FiltersProvider');
  return ctx;
}
