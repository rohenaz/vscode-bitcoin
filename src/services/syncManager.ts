/**
 * Sync Progress Manager
 * Manages SPV sync progress callbacks in a centralized way
 * Follows yours-wallet pattern for real-time balance updates
 */

type SyncProgressHandler = (data: { currentHeight: number; lastHeight: number }) => void;
type BalanceRefreshHandler = () => void;

class SyncManager {
  private handler: SyncProgressHandler | null = null;
  private balanceRefreshHandlers: Set<BalanceRefreshHandler> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  /**
   * Set the global sync progress handler
   * Called from extension.tsx during activation
   */
  setProgressHandler(handler: SyncProgressHandler): void {
    this.handler = handler;
  }

  /**
   * Get the sync progress handler if set
   * Used by modules that initialize SPV sync
   */
  getProgressHandler(): SyncProgressHandler | undefined {
    return this.handler || undefined;
  }

  /**
   * Register a balance refresh handler
   * Will be called every 5 seconds during sync (yours-wallet pattern)
   */
  registerBalanceRefresh(handler: BalanceRefreshHandler): void {
    this.balanceRefreshHandlers.add(handler);
  }

  /**
   * Unregister a balance refresh handler
   */
  unregisterBalanceRefresh(handler: BalanceRefreshHandler): void {
    this.balanceRefreshHandlers.delete(handler);
  }

  /**
   * Start periodic balance refresh during sync
   * Called when sync starts (yours-wallet pattern: 5 second interval)
   */
  startPeriodicRefresh(): void {
    if (this.refreshInterval) return;
    this.isSyncing = true;

    // Trigger immediate refresh to show cached data
    this.balanceRefreshHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('[SyncManager] Error in initial balance refresh:', error);
      }
    });

    // Then trigger refresh every 5 seconds during sync (yours-wallet line 58-60)
    this.refreshInterval = setInterval(() => {
      this.balanceRefreshHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          console.error('[SyncManager] Error in balance refresh handler:', error);
        }
      });
    }, 5000);
  }

  /**
   * Stop periodic balance refresh
   * Called when sync completes
   */
  stopPeriodicRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.isSyncing = false;

    // Trigger one final refresh
    this.balanceRefreshHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('[SyncManager] Error in final balance refresh:', error);
      }
    });
  }

  /**
   * Check if currently syncing
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Clear the handler
   */
  clearProgressHandler(): void {
    this.handler = null;
    this.stopPeriodicRefresh();
  }
}

// Singleton instance
export const syncManager = new SyncManager();
