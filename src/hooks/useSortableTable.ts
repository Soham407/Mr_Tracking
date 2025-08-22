import { useState, useMemo } from "react";

type SortDirection = 'asc' | 'desc' | null;

interface UseSortableTableProps<T> {
  data: T[];
  defaultSortColumn?: keyof T;
  defaultSortDirection?: SortDirection;
}

export function useSortableTable<T>({
  data,
  defaultSortColumn = null,
  defaultSortDirection = null,
}: UseSortableTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

      return [...data].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? -1 : 1;

        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        // Handle numeric/boolean comparison
        if (aValue < bValue) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortDirection === 'asc' ? 1 : -1;
        }

        return 0; // Values are equal
      });
    }, [data, sortColumn, sortDirection]);

  return {
    sortedData,
    sortColumn,
    sortDirection,
    handleSort,
  };
}
