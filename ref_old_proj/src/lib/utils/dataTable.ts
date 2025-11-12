export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  [key: string]: string;
}

export interface DataTableConfig {
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  pageSize?: number;
}

export class DataTable<T> {
  private data: T[];
  private config: DataTableConfig;
  private sortConfig: SortConfig | null = null;
  private filterConfig: FilterConfig = {};
  private searchTerm: string = '';
  private currentPage: number = 1;

  constructor(data: T[], config: DataTableConfig = {}) {
    this.data = data;
    this.config = {
      searchable: true,
      sortable: true,
      filterable: true,
      pageSize: 50,
      ...config
    };
  }

  // Update data
  updateData(newData: T[]) {
    console.log('DataTable updateData - new data length:', newData.length);
    this.data = newData;
    this.currentPage = 1; // Reset to first page when data changes
  }

  // Sorting methods
  setSort(column: string, direction: 'asc' | 'desc' = 'asc') {
    this.sortConfig = { column, direction };
    this.currentPage = 1;
  }

  clearSort() {
    this.sortConfig = null;
  }

  getSortConfig(): SortConfig | null {
    return this.sortConfig;
  }

  // Filtering methods
  setFilter(filters: FilterConfig) {
    this.filterConfig = filters;
    this.currentPage = 1;
  }

  clearFilters() {
    this.filterConfig = {};
    this.currentPage = 1;
  }

  getFilterConfig(): FilterConfig {
    return this.filterConfig;
  }

  // Search methods
  setSearch(term: string) {
    this.searchTerm = term;
    this.currentPage = 1;
  }

  getSearchTerm(): string {
    return this.searchTerm;
  }

  // Pagination methods
  setPage(page: number) {
    this.currentPage = page;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  getTotalPages(): number {
    return Math.ceil(this.getFilteredData().length / (this.config.pageSize || 50));
  }

  // Data processing
  private matchesWildcard(value: any, pattern: string): boolean {
    if (!pattern) return true;
    const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return regex.test(String(value || ''));
  }

  private matchesSearch(item: T): boolean {
    if (!this.searchTerm) return true;
    
    const searchLower = this.searchTerm.toLowerCase();
    return Object.values(item as any).some(value => 
      String(value || '').toLowerCase().includes(searchLower)
    );
  }

  private matchesFilters(item: T): boolean {
    for (const [key, value] of Object.entries(this.filterConfig)) {
      if (value && !this.matchesWildcard((item as any)[key], value)) {
        return false;
      }
    }
    return true;
  }

  private sortData(data: T[]): T[] {
    if (!this.sortConfig || !this.config.sortable) return data;

    return [...data].sort((a, b) => {
      let aValue = (a as any)[this.sortConfig!.column];
      let bValue = (b as any)[this.sortConfig!.column];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to string for comparison
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (this.sortConfig!.direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }

  private getFilteredData(): T[] {
    let filtered = this.data;

    // Apply search
    if (this.config.searchable && this.searchTerm) {
      filtered = filtered.filter(item => this.matchesSearch(item));
    }

    // Apply filters
    if (this.config.filterable && Object.keys(this.filterConfig).length > 0) {
      filtered = filtered.filter(item => this.matchesFilters(item));
    }

    return filtered;
  }

  getProcessedData(): T[] {
    console.log('DataTable getProcessedData - initial data length:', this.data.length);
    const filtered = this.getFilteredData();
    console.log('DataTable getProcessedData - filtered data length:', filtered.length);
    const sorted = this.sortData(filtered);
    console.log('DataTable getProcessedData - sorted data length:', sorted.length);
    
    // Apply pagination
    if (this.config.pageSize) {
      const startIndex = (this.currentPage - 1) * this.config.pageSize;
      const endIndex = startIndex + this.config.pageSize;
      const paginated = sorted.slice(startIndex, endIndex);
      console.log('DataTable getProcessedData - paginated data length:', paginated.length);
      return paginated;
    }

    return sorted;
  }

  getTotalCount(): number {
    return this.data.length;
  }

  getFilteredCount(): number {
    return this.getFilteredData().length;
  }

  // Export functionality
  exportToCSV(headers: string[], getRowData: (item: T) => string[]): string {
    const processedData = this.getProcessedData();
    const csvContent = [
      headers,
      ...processedData.map(item => getRowData(item))
    ].map(row => row.join(',')).join('\n');

    return csvContent;
  }

  // Utility methods
  getSortIcon(column: string): string {
    if (!this.sortConfig || this.sortConfig.column !== column) {
      return 'text-gray-400';
    }
    return this.sortConfig.direction === 'asc' ? 'text-blue-500' : 'text-blue-500 rotate-180';
  }

  isSortable(): boolean {
    return this.config.sortable || false;
  }

  isFilterable(): boolean {
    return this.config.filterable || false;
  }

  isSearchable(): boolean {
    return this.config.searchable || false;
  }
} 