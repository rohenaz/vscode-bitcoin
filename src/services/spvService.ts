import {
  FundIndexer,
  InscriptionIndexer,
  OneSatWebSPV,
  ParseMode,
  TxoLookup,
  TxoSort,
  type SPVStore,
  type Txo,
  type Indexer,
  type Network
} from 'spv-store';
import { Transaction } from '@bsv/sdk';
import type { SpvCacheService } from './spvCache';

/**
 * SPV-Store service for UTXO tracking and transaction caching
 *
 * Follows the exact pattern from yours-wallet for proper UTXO management.
 * Uses fake-indexeddb (in-memory) BUT backs up/restores to VS Code storage for persistence.
 * On startup, restores from cache and RESUMES sync from last block (no full resync!)
 */
export class SpvService {
  private spv: SPVStore | null = null;
  private accountId: string = '';
  private addresses: string[] = [];
  private network: Network;
  private cacheService: SpvCacheService | null = null;
  private lastBackupHeight: number = 0;
  private readonly BACKUP_INTERVAL_BLOCKS = 10000; // Backup every 10k blocks

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network === 'mainnet' ? 'mainnet' : 'testnet';
  }

  /**
   * Set the cache service for backup/restore
   */
  setCacheService(cacheService: SpvCacheService): void {
    this.cacheService = cacheService;
  }

  /**
   * Initialize the SPV store for given addresses
   * Following yours-wallet pattern from initSPVStore.ts:28-116
   *
   * NOTE: This initializes the store but does NOT start syncing by default.
   * Call startSync() separately to begin background synchronization.
   */
  async initialize(
    accountId: string,
    addresses: string[],
    network: 'mainnet' | 'testnet' = 'mainnet'
  ): Promise<void> {
    this.accountId = accountId;
    this.addresses = addresses.filter(addr => addr);
    this.network = network === 'mainnet' ? 'mainnet' : 'testnet';

    // Create owner set from addresses (yours-wallet:81)
    const owners = new Set<string>(this.addresses);

    if (owners.size === 0) {
      throw new Error('At least one address is required to initialize SPV store');
    }

    // Create indexers (yours-wallet:91)
    const indexers = this.getIndexers(owners, this.network);

    // Define sync sources (yours-wallet:87-95)
    // Include 'origin' for ordinals/inscriptions
    const syncSources = new Set<string>(['fund', 'origin']);

    // Initialize OneSatWebSPV WITHOUT starting sync (yours-wallet:101-109)
    // Sync will be started separately via startSync() to avoid blocking
    this.spv = await OneSatWebSPV.init(
      accountId,
      indexers,
      owners,
      this.network,
      false, // Don't start sync during init - do it separately
      syncSources,
      ParseMode.Persist // Persist parsed data to database
    );

    if (!this.spv) {
      throw new Error('SPV store initialization failed');
    }

    // Try to restore from cache
    if (this.cacheService) {
      const restored = await this.cacheService.restore(this.spv, accountId, this.network);
      if (restored) {
        console.log('[SpvService] Restored from cache, will resume sync from last position');
      } else {
        console.log('[SpvService] No cache or cache invalid, will do full sync');
      }
    }
  }

  /**
   * Get indexers for UTXO tracking
   * Following yours-wallet pattern from initSPVStore.ts:28-72
   */
  private getIndexers(owners: Set<string>, network: Network): Indexer[] {
    const SYNC_HISTORY = false; // Don't sync full history (yours-wallet:29)

    // Create indexers following yours-wallet pattern
    const indexers: Indexer[] = [
      // FundIndexer for spendable UTXOs (yours-wallet:30)
      new FundIndexer(owners, network, SYNC_HISTORY),
      // InscriptionIndexer for ordinals/NFTs (yours-wallet:58)
      new InscriptionIndexer(owners, network)
    ];

    return indexers;
  }

  /**
   * Start background synchronization with progress tracking
   * This triggers the SPV store to sync UTXOs from the network
   * Following yours-wallet pattern from initSPVStore.ts:144-156
   */
  async startSync(onProgress?: (data: { currentHeight: number; lastHeight: number }) => void): Promise<void> {
    if (!this.spv) {
      throw new Error('SPV store not initialized. Call initialize() first.');
    }

    // Get chaintip BEFORE starting sync (yours-wallet:145)
    // This is used to calculate progress percentage
    const tip = await this.spv.getChaintip();
    const targetHeight = tip?.height || 0;

    // Register progress listener if callback provided (yours-wallet:146)
    if (onProgress) {
      this.spv.events.on('syncedBlockHeight', (lastHeight: number) => {
        try {
          onProgress({
            currentHeight: targetHeight,
            lastHeight
          });

          // Periodic backup during sync (every 10k blocks) - protects against crashes!
          const blocksSinceLastBackup = lastHeight - this.lastBackupHeight;
          const shouldBackup = blocksSinceLastBackup >= this.BACKUP_INTERVAL_BLOCKS;
          const syncComplete = lastHeight >= targetHeight;

          if ((shouldBackup || syncComplete) && this.cacheService && this.spv) {
            this.lastBackupHeight = lastHeight;
            const reason = syncComplete ? 'Sync complete' : `${blocksSinceLastBackup} blocks synced`;
            console.log(`[SpvService] ${reason}, backing up to cache...`);

            this.cacheService.backup(this.spv, this.accountId, this.network).catch(err => {
              console.error('[SpvService] Cache backup failed:', err);
            });
          }
        } catch (error) {
          console.error('[SpvService] Error in syncedBlockHeight handler:', error);
        }
      });
    }

    // Trigger sync - this happens asynchronously
    await this.spv.sync();
  }

  /**
   * Get all UTXOs for a specific address
   * Following yours-wallet pattern from Bsv.service.ts fundingTxos method
   */
  async getUtxos(address?: string): Promise<Txo[]> {
    if (!this.spv) {
      throw new Error('SPV store not initialized. Call initialize() first.');
    }

    // Search for 'fund' type UTXOs, sorted descending (yours-wallet pattern)
    const results = await this.spv.search(
      new TxoLookup('fund'),
      TxoSort.DESC,
      0 // No limit - get all
    );

    // Filter to unspent outputs only
    let utxos = results.txos.filter(txo => !txo.spend);

    // If address specified, filter to that owner
    if (address) {
      utxos = utxos.filter(txo => txo.owner === address);
    }

    return utxos;
  }

  /**
   * Get a transaction from the cache
   * Following yours-wallet pattern where spv.getTx() is used directly
   */
  async getTx(txid: string): Promise<Transaction> {
    if (!this.spv) {
      throw new Error('SPV store not initialized. Call initialize() first.');
    }

    return await this.spv.getTx(txid);
  }

  /**
   * Broadcast a transaction to the network
   * This automatically updates UTXO states in the local database
   * Following yours-wallet pattern where spv.broadcast() handles everything
   */
  async broadcast(tx: Transaction): Promise<any> {
    if (!this.spv) {
      throw new Error('SPV store not initialized. Call initialize() first.');
    }

    return await this.spv.broadcast(tx);
  }

  /**
   * Check if SPV store is initialized
   */
  isInitialized(): boolean {
    return this.spv !== null;
  }

  /**
   * Check if the addresses have changed and SPV needs reinitialization
   */
  needsReinit(newAddresses: string[]): boolean {
    if (!this.isInitialized()) {
      return false; // Not initialized yet, so no need to reinit
    }

    const currentAddrs = this.addresses.sort().join(',');
    const newAddrs = newAddresses.filter(addr => addr).sort().join(',');

    return currentAddrs !== newAddrs;
  }

  /**
   * Reinitialize SPV with new addresses (following yours-wallet account switching pattern)
   * Destroys current SPV and initializes with new address
   * Each address gets its own cache, so old cache persists for when user switches back
   */
  async reinitialize(accountId: string, addresses: string[], network: 'mainnet' | 'testnet' = 'mainnet'): Promise<void> {
    console.log('[SpvService] Reinitializing with new addresses:', addresses);

    // Destroy old SPV (following yours-wallet switchAccount pattern)
    if (this.spv) {
      await this.spv.destroy();
      this.spv = null;
    }

    // Don't clear cache - let each address keep its own cache
    // When switching back, the cache will be restored

    // Initialize with new addresses (will load its own cache if available)
    await this.initialize(accountId, addresses, network);
  }

  /**
   * Get current account ID
   */
  getAccountId(): string {
    return this.accountId;
  }

  /**
   * Get current addresses
   */
  getAddresses(): string[] {
    return this.addresses;
  }

  /**
   * Get current network
   */
  getNetwork(): Network {
    return this.network;
  }

  /**
   * Destroy the SPV store and clean up resources
   * Backs up before destroying (in case of clean shutdown)
   */
  async destroy(): Promise<void> {
    if (this.spv && this.cacheService) {
      console.log('[SpvService] Extension deactivating, backing up cache...');
      try {
        await this.cacheService.backup(this.spv, this.accountId, this.network);
        console.log('[SpvService] Final backup complete');
      } catch (error) {
        console.error('[SpvService] Final backup failed:', error);
      }
    }

    if (this.spv) {
      await this.spv.destroy();
      this.spv = null;
    }
  }
}

/**
 * Global SPV service instance
 * Initialized in extension.tsx activate()
 */
export let spvService: SpvService | null = null;

/**
 * Initialize the global SPV service
 * Called from extension.tsx
 */
export function initSpvService(network: 'mainnet' | 'testnet' = 'mainnet'): void {
  spvService = new SpvService(network);
}

/**
 * Get the global SPV service instance
 */
export function getSpvService(): SpvService {
  if (!spvService) {
    throw new Error('SPV service not initialized. Call initSpvService() first.');
  }
  return spvService;
}

/**
 * Destroy the global SPV service and clean up resources
 * Called from extension.tsx deactivate()
 */
export async function destroySpvService(): Promise<void> {
  if (spvService) {
    await spvService.destroy();
    spvService = null;
  }
}
