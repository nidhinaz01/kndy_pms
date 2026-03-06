/**
 * Shared cache for submission status to avoid duplicate queries
 * This cache is scoped per page instance and cleared when date/stage changes
 */

interface CacheKey {
  stageCode: string;
  date: string;
  type: 'planning' | 'reporting';
}

interface CacheEntry {
  status: any;
  timestamp: number;
}

class SubmissionStatusCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 60000; // 60 seconds TTL to handle concurrent updates

  private getKey(stageCode: string, date: string, type: 'planning' | 'reporting'): string {
    // Normalize date to YYYY-MM-DD format
    const dateStr = typeof date === 'string' 
      ? date.split('T')[0] 
      : (date && typeof date === 'object' && 'toISOString' in date)
        ? (date as Date).toISOString().split('T')[0]
        : String(date || '').split('T')[0];
    
    return `${stageCode}:${dateStr}:${type}`;
  }

  get(stageCode: string, date: string, type: 'planning' | 'reporting'): any | null {
    const key = this.getKey(stageCode, date, type);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.status;
  }

  set(stageCode: string, date: string, type: 'planning' | 'reporting', status: any): void {
    const key = this.getKey(stageCode, date, type);
    this.cache.set(key, {
      status,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear entries for a specific stage/date combination
  clearForStageDate(stageCode: string, date: string): void {
    const dateStr = typeof date === 'string' 
      ? date.split('T')[0] 
      : (date && typeof date === 'object' && 'toISOString' in date)
        ? (date as Date).toISOString().split('T')[0]
        : String(date || '').split('T')[0];
    
    const prefix = `${stageCode}:${dateStr}:`;
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Export singleton instance
export const submissionStatusCache = new SubmissionStatusCache();
