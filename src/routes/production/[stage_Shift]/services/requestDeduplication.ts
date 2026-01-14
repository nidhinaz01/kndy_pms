/**
 * Request deduplication to prevent duplicate concurrent requests
 * This ensures that if a user clicks a tab multiple times quickly, only one request is made
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds - requests older than this are considered stale

  /**
   * Get or create a request
   * If a request with the same key is already pending, return the existing promise
   * Otherwise, create a new request
   */
  async getOrCreate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Clean up stale requests
    this.cleanupStaleRequests();

    // Check if there's a pending request with the same key
    const existing = this.pendingRequests.get(key);
    if (existing) {
      // Check if it's still valid (not stale)
      if (Date.now() - existing.timestamp < this.REQUEST_TIMEOUT) {
        console.log(`🔄 Reusing pending request for key: ${key}`);
        return existing.promise as Promise<T>;
      } else {
        // Remove stale request
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    const promise = requestFn()
      .then(result => {
        // Remove from pending requests when completed
        this.pendingRequests.delete(key);
        return result;
      })
      .catch(error => {
        // Remove from pending requests on error
        this.pendingRequests.delete(key);
        throw error;
      });

    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  /**
   * Cancel a pending request (remove from map)
   */
  cancel(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Clean up stale requests
   */
  private cleanupStaleRequests(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.pendingRequests.delete(key));
  }
}

// Export singleton instance
export const requestDeduplicator = new RequestDeduplicator();
