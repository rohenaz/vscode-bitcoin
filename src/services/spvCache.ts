/**
 * SPV Cache Service
 * Backs up and restores SPV data to/from VS Code's persistent storage
 * This allows SPV to RESUME sync from last position instead of resyncing from scratch
 */

import type { ExtensionContext } from 'vscode';
import type { SPVStore } from 'spv-store';

interface SpvCacheData {
  version: number;
  timestamp: number;
  lastSyncHeight: number;
  accountId: string;
  network: 'mainnet' | 'testnet';
  txos: any[];
  txLogs: any[];
  txns: number[];
}

export class SpvCacheService {
  private static readonly CACHE_KEY_PREFIX = 'spv-cache';
  private static readonly VERSION = 1;

  constructor(private context: ExtensionContext) {}

  /**
   * Get cache key for a specific account/address
   * Following yours-wallet pattern - each address has its own cache
   */
  private getCacheKey(accountId: string, network: 'mainnet' | 'testnet'): string {
    return `${SpvCacheService.CACHE_KEY_PREFIX}-${network}-${accountId}`;
  }

  /**
   * Backup SPV store data to VS Code global storage
   * Uses pagination to handle large datasets (following yours-wallet pattern)
   */
  async backup(spv: SPVStore, accountId: string, network: 'mainnet' | 'testnet'): Promise<void> {
    try {
      console.log('[SpvCache] Starting backup...');
      const startTime = Date.now();

      // Get last synced block height
      const syncedBlock = await spv.getSyncedBlock();
      const lastSyncHeight = syncedBlock?.height || 0;

      // Backup txos with pagination (yours-wallet pattern: masterExporter.ts:38-53)
      const allTxos: any[] = [];
      let txosFrom: any = undefined;
      let hasMoreTxos = true;
      while (hasMoreTxos) {
        const { txos, nextPage } = await spv.backupTxos(100, txosFrom);
        if (txos && txos.length > 0) {
          allTxos.push(...txos);
        }
        hasMoreTxos = !!nextPage;
        txosFrom = nextPage;
      }

      // Backup txLogs with pagination (yours-wallet pattern: masterExporter.ts:55-68)
      const allTxLogs: any[] = [];
      let txLogsFrom: any = undefined;
      let hasMoreTxLogs = true;
      while (hasMoreTxLogs) {
        const { logs, nextPage } = await spv.backupTxLogs(100, txLogsFrom);
        if (logs && logs.length > 0) {
          allTxLogs.push(...logs);
        }
        hasMoreTxLogs = !!nextPage;
        txLogsFrom = nextPage;
      }

      // Backup txns with pagination (yours-wallet pattern: masterExporter.ts:70-85)
      const allTxns: number[] = [];
      let txnsFrom: any = undefined;
      let hasMoreTxns = true;
      while (hasMoreTxns) {
        const { data, nextPage } = await spv.backupTxns(100, txnsFrom);
        if (data && data.length > 0) {
          allTxns.push(...data);
        }
        hasMoreTxns = !!nextPage;
        txnsFrom = nextPage;
      }

      const cacheData: SpvCacheData = {
        version: SpvCacheService.VERSION,
        timestamp: Date.now(),
        lastSyncHeight,
        accountId,
        network,
        txos: allTxos,
        txLogs: allTxLogs,
        txns: allTxns,
      };

      const cacheKey = this.getCacheKey(accountId, network);
      await this.context.globalState.update(cacheKey, cacheData);

      const duration = Date.now() - startTime;
      console.log(`[SpvCache] Backup complete in ${duration}ms:`, {
        lastSyncHeight,
        txos: allTxos.length,
        txLogs: allTxLogs.length,
        txns: allTxns.length,
      });
    } catch (error) {
      console.error('[SpvCache] Backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore SPV store data from VS Code global storage
   * Returns true if restoration was successful
   */
  async restore(spv: SPVStore, accountId: string, network: 'mainnet' | 'testnet'): Promise<boolean> {
    try {
      console.log('[SpvCache] Checking for cached data...');

      const cacheKey = this.getCacheKey(accountId, network);
      const cacheData = this.context.globalState.get<SpvCacheData>(cacheKey);

      if (!cacheData) {
        console.log('[SpvCache] No cache found');
        return false;
      }

      // Validate cache
      if (
        cacheData.version !== SpvCacheService.VERSION ||
        cacheData.accountId !== accountId ||
        cacheData.network !== network
      ) {
        console.log('[SpvCache] Cache invalid (version/account/network mismatch)');
        await this.clear();
        return false;
      }

      // Check if cache is too old (> 7 days)
      const cacheAge = Date.now() - cacheData.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (cacheAge > maxAge) {
        console.log('[SpvCache] Cache too old, clearing');
        await this.clear();
        return false;
      }

      console.log('[SpvCache] Restoring from cache...', {
        lastSyncHeight: cacheData.lastSyncHeight,
        txos: cacheData.txos.length,
        txLogs: cacheData.txLogs.length,
        txns: cacheData.txns.length,
        cacheAge: Math.round(cacheAge / 1000 / 60) + ' minutes',
      });

      const startTime = Date.now();

      // Restore all data
      await Promise.all([
        spv.restoreTxos(cacheData.txos),
        spv.restoreTxLogs(cacheData.txLogs),
        spv.restoreTxns(cacheData.txns),
      ]);

      const duration = Date.now() - startTime;
      console.log(`[SpvCache] Restore complete in ${duration}ms`);
      console.log(`[SpvCache] SPV will resume from block ${cacheData.lastSyncHeight}`);

      return true;
    } catch (error) {
      console.error('[SpvCache] Restore failed:', error);
      await this.clear();
      return false;
    }
  }

  /**
   * Clear cached SPV data for a specific account
   * If accountId/network not provided, clears nothing (must be explicit)
   */
  async clear(accountId?: string, network?: 'mainnet' | 'testnet'): Promise<void> {
    if (accountId && network) {
      const cacheKey = this.getCacheKey(accountId, network);
      await this.context.globalState.update(cacheKey, undefined);
      console.log(`[SpvCache] Cache cleared for ${accountId} on ${network}`);
    }
  }

  /**
   * Get cache info without loading for a specific account
   */
  getCacheInfo(accountId: string, network: 'mainnet' | 'testnet'): { exists: boolean; lastSyncHeight?: number; timestamp?: number } | null {
    const cacheKey = this.getCacheKey(accountId, network);
    const cacheData = this.context.globalState.get<SpvCacheData>(cacheKey);
    if (!cacheData) {
      return null;
    }
    return {
      exists: true,
      lastSyncHeight: cacheData.lastSyncHeight,
      timestamp: cacheData.timestamp,
    };
  }
}
