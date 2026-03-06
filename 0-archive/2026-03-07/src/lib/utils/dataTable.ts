export class DataTable<T> {
  private data: T[];
  private filteredData: T[];
  private searchTerm: string = '';
  private sortColumn: string = '';
  private sortDirection: 'asc' | 'desc' = 'asc';
  private currentPage: number = 1;
  private pageSize: number = 50;
  private options: DataTableOptions;

  constructor(data: T[], options: DataTableOptions = {}) {
    this.data = data;
    this.filteredData = [...data];
    this.options = {
      searchable: true,
      sortable: true,
      filterable: true,
      pageSize: 50,
      ...options
    };
    this.pageSize = this.options.pageSize || 50;
  }

  updateData(newData: T[]) {
    this.data = newData;
    this.applyFilters();
  }

  setSearch(term: string) {
    this.searchTerm = term;
    this.currentPage = 1;
    this.applyFilters();
  }

  setSort(column: string, direction: 'asc' | 'desc' = 'asc') {
    this.sortColumn = column;
    this.sortDirection = direction;
    this.applyFilters();
  }

  setPage(page: number) {
    this.currentPage = page;
  }

  getProcessedData(): T[] {
    return this.filteredData;
  }

  getCurrentPageData(): T[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredData.slice(start, end);
  }

  getTotalPages(): number {
    return Math.ceil(this.filteredData.length / this.pageSize);
  }

  getTotalRecords(): number {
    return this.filteredData.length;
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'text-gray-400';
    }
    return this.sortDirection === 'asc' ? 'text-blue-500 rotate-180' : 'text-blue-500';
  }

  private applyFilters() {
    let filtered = [...this.data];

    // Apply search
    if (this.options.searchable && this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        Object.values(item as Record<string, unknown>).some(value => 
          String(value || '').toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply sorting
    if (this.options.sortable && this.sortColumn) {
      filtered.sort((a, b) => {
        let aValue = (a as any)[this.sortColumn];
        let bValue = (b as any)[this.sortColumn];
        
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
        
        if (this.sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }

    this.filteredData = filtered;
  }
}

interface DataTableOptions {
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  pageSize?: number;
} 