import * as fs from 'node:fs';
import * as path from 'node:path';
import { Transaction, Utils } from '@bsv/sdk';
import vsApi from '../vsShim';
import { JUNGLEBUS_API_HOST } from '../constants';

// Re-export types for convenience
export interface SpendParams {
  sourceTXID: string;
  sourceOutputIndex: number;
  sourceSatoshis: number;
  lockingScript: string;
  transactionVersion: number;
  otherInputs: Array<{
    sourceTXID: string;
    sourceOutputIndex: number;
    sequence: number;
  }>;
  outputs: Array<{
    satoshis: number;
    lockingScript: string;
  }>;
  unlockingScript: string;
  inputSequence: number;
  inputIndex: number;
  lockTime: number;
  memoryLimit?: number;
}

export interface DecodedTransaction {
  version: number;
  lockTime: number;
  txid: string;
  size: number;
  network: string;
  inputs: Array<{
    index: number;
    sourceTXID: string;
    sourceOutputIndex: number;
    unlockingScript: string;
    unlockingScriptAsm: string;
    sequence: number;
  }>;
  outputs: Array<{
    index: number;
    satoshis: number;
    lockingScript: string;
    lockingScriptAsm: string;
  }>;
}

interface TransactionMetadata {
  txid: string;
  size: number;
  timestamp: number;
  lastAccessed: number;
  network: 'main' | 'test';
  label?: string;
  inputCount?: number;
  outputCount?: number;
}

interface StorageIndex {
  transactions: { [txid: string]: Omit<TransactionMetadata, 'txid'> };
  totalSize: number;
}

export interface CachedTransaction {
  rawTxHex: string;
  network: 'main' | 'test';
}

export interface CacheStats {
  totalSize: number;
  totalSizeMB: number;
  maxSizeMB: number;
  transactionCount: number;
  utilizationPercent: number;
}

/**
 * Unified transaction cache with persistent file-system storage and LRU pruning.
 *
 * Features:
 * - Network-aware file-based cache (.bitcoin/transactions/main/<txid>.hex, .bitcoin/transactions/test/<txid>.hex)
 * - LRU (Least Recently Used) pruning
 * - Configurable size limits (10MB-10GB, default 100MB)
 * - Unified fetch: Cache → JungleBus → WhatOnChain main → WhatOnChain test → Error
 * - Batch operations
 * - Transaction decoding
 */
export class TxCache {
  private transactionsDir: string;
  private mainNetDir: string;
  private testNetDir: string;
  private indexFile: string;
  private index: StorageIndex;
  private readonly ABSOLUTE_MIN_SIZE_MB = 10;
  private readonly ABSOLUTE_MAX_SIZE_MB = 10240;

  constructor(workspaceRoot?: string) {
    const bitcoinDir = this.getBitcoinDirectory(workspaceRoot);
    this.transactionsDir = path.join(bitcoinDir, 'transactions');
    this.mainNetDir = path.join(this.transactionsDir, 'main');
    this.testNetDir = path.join(this.transactionsDir, 'test');
    this.indexFile = path.join(this.transactionsDir, 'index.json');

    console.log('[TxCache] Initializing with paths:', {
      bitcoinDir,
      transactionsDir: this.transactionsDir,
      mainNetDir: this.mainNetDir,
      testNetDir: this.testNetDir,
      indexFile: this.indexFile
    });

    this.ensureDirectories();
    this.index = this.loadIndex();
    console.log('[TxCache] Loaded index:', {
      transactionCount: Object.keys(this.index.transactions).length,
      totalSize: this.index.totalSize
    });
  }

  private getBitcoinDirectory(workspaceRoot?: string): string {
    const config = vsApi.workspace.getConfiguration('bitcoin');
    const bitcoinPath = config.get<string>('workspace.path') || '.bitcoin';

    // If workspaceRoot explicitly provided, use it (for project-level operations)
    if (workspaceRoot) {
      return path.join(workspaceRoot, bitcoinPath);
    }

    // Check if user wants project-level storage (opt-in via config)
    const useProjectLevel = config.get<boolean>('storage.useProjectLevel') || false;

    if (useProjectLevel && vsApi?.workspace?.workspaceFolders?.length) {
      // Project-level: Store in workspace folder (can be committed)
      const wsRoot = vsApi.workspace.workspaceFolders[0].uri.fsPath;
      return path.join(wsRoot, bitcoinPath);
    }

    // Default: User-level storage in home directory (shared across all projects)
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, bitcoinPath);
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.mainNetDir)) {
      fs.mkdirSync(this.mainNetDir, { recursive: true });
    }
    if (!fs.existsSync(this.testNetDir)) {
      fs.mkdirSync(this.testNetDir, { recursive: true });
    }
  }

  private getFilePath(txid: string, network: 'main' | 'test'): string {
    const dir = network === 'test' ? this.testNetDir : this.mainNetDir;
    return path.join(dir, `${txid}.hex`);
  }

  private loadIndex(): StorageIndex {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[TxCache] Failed to load index:', error);
    }

    return {
      transactions: {},
      totalSize: 0
    };
  }

  private saveIndex(): void {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2), 'utf-8');
    } catch (error) {
      console.error('[TxCache] Failed to save index:', error);
    }
  }

  private getMaxSizeBytes(): number {
    const config = vsApi.workspace.getConfiguration('bitcoin');
    let maxSizeMB = config.get<number>('storage.maxSizeMB') || 100;

    maxSizeMB = Math.max(this.ABSOLUTE_MIN_SIZE_MB, Math.min(maxSizeMB, this.ABSOLUTE_MAX_SIZE_MB));
    return maxSizeMB * 1024 * 1024;
  }

  private pruneIfNeeded(newTransactionSize: number): void {
    const maxSize = this.getMaxSizeBytes();
    const projectedSize = this.index.totalSize + newTransactionSize;

    if (projectedSize <= maxSize) {
      return;
    }

    console.log(`[TxCache] Pruning needed. Current: ${this.index.totalSize}, New: ${newTransactionSize}, Max: ${maxSize}`);

    const sortedTxs = Object.entries(this.index.transactions)
      .map(([txid, meta]) => ({ txid, ...meta }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    const targetSize = maxSize - newTransactionSize;
    let currentSize = this.index.totalSize;

    for (const tx of sortedTxs) {
      if (currentSize <= targetSize) {
        break;
      }

      const minSize = this.ABSOLUTE_MIN_SIZE_MB * 1024 * 1024;
      if (currentSize - tx.size < minSize) {
        console.warn(`[TxCache] Stopping pruning to maintain minimum ${this.ABSOLUTE_MIN_SIZE_MB}MB`);
        break;
      }

      this.deleteTransactionFile(tx.txid, tx.network);
      delete this.index.transactions[tx.txid];
      currentSize -= tx.size;

      console.log(`[TxCache] Pruned ${tx.txid} (${tx.size} bytes, last accessed ${new Date(tx.lastAccessed).toISOString()})`);
    }

    this.index.totalSize = currentSize;
    this.saveIndex();
  }

  private deleteTransactionFile(txid: string, network: 'main' | 'test'): void {
    const filePath = this.getFilePath(txid, network);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`[TxCache] Failed to delete ${txid}:`, error);
    }
  }

  private getWhatOnChainUrl(network: string, endpoint: string): string {
    const baseUrl = network === 'testnet'
      ? 'https://api.whatsonchain.com/v1/bsv/test'
      : 'https://api.whatsonchain.com/v1/bsv/main';

    const apiKey = vsApi.workspace.getConfiguration('bitcoin.whatsonchain').get('apiKey', '');
    const url = `${baseUrl}${endpoint}`;

    return apiKey ? `${url}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}` : url;
  }

  private async fetchFromJungleBus(txid: string): Promise<string> {
    const url = `${JUNGLEBUS_API_HOST}/transaction/get/${txid}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`JungleBus: ${response.statusText}`);
    }

    const data = await response.json();
    return Utils.toHex(Utils.toArray(data.transaction, 'base64'));
  }

  private async fetchFromWhatOnChain(txid: string, network: string): Promise<string> {
    const url = this.getWhatOnChainUrl(network, `/tx/${txid}/hex`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`WhatOnChain: ${response.statusText}`);
    }

    return await response.text();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get transaction from cache (local file only)
   * Checks both main and test networks
   */
  get(txid: string): CachedTransaction | null {
    // Check if we have metadata (tells us which network)
    const meta = this.index.transactions[txid];
    if (meta) {
      const filePath = this.getFilePath(txid, meta.network);
      if (fs.existsSync(filePath)) {
        try {
          const rawTxHex = fs.readFileSync(filePath, 'utf-8');
          // Update last accessed time (LRU tracking)
          meta.lastAccessed = Date.now();
          this.saveIndex();
          return { rawTxHex, network: meta.network };
        } catch (error) {
          console.error(`[TxCache] Failed to load ${txid} from ${meta.network}:`, error);
        }
      }
    }

    // Fallback: check both networks if metadata is missing or file doesn't exist
    for (const network of ['main', 'test'] as const) {
      const filePath = this.getFilePath(txid, network);
      if (fs.existsSync(filePath)) {
        try {
          const rawTxHex = fs.readFileSync(filePath, 'utf-8');
          // Rebuild metadata if missing
          if (!this.index.transactions[txid]) {
            const size = Buffer.byteLength(rawTxHex, 'utf-8');
            this.index.transactions[txid] = {
              size,
              timestamp: Date.now(),
              lastAccessed: Date.now(),
              network
            };
            this.index.totalSize += size;
            this.saveIndex();
          }
          return { rawTxHex, network };
        } catch (error) {
          console.error(`[TxCache] Failed to load ${txid} from ${network}:`, error);
        }
      }
    }

    return null;
  }

  /**
   * Save transaction to cache with network information
   */
  set(txid: string, rawTxHex: string, network: 'main' | 'test' = 'main', metadata?: { inputCount?: number; outputCount?: number }): void {
    const size = Buffer.byteLength(rawTxHex, 'utf-8');
    const now = Date.now();

    const existing = this.index.transactions[txid];
    if (existing) {
      // If network changed, delete old file and update
      if (existing.network !== network) {
        this.deleteTransactionFile(txid, existing.network);
        this.index.totalSize -= existing.size;
      }
      existing.lastAccessed = now;
      existing.network = network;

      // Update metadata if provided
      if (metadata?.inputCount !== undefined) {
        existing.inputCount = metadata.inputCount;
      }
      if (metadata?.outputCount !== undefined) {
        existing.outputCount = metadata.outputCount;
      }

      this.saveIndex();
      console.log(`[TxCache] Updated access time for ${txid}`);
      return;
    }

    this.pruneIfNeeded(size);

    const filePath = this.getFilePath(txid, network);
    console.log(`[TxCache] Writing ${txid} to: ${filePath}`);

    try {
      fs.writeFileSync(filePath, rawTxHex, 'utf-8');
      console.log(`[TxCache] Successfully wrote file: ${filePath}`);
    } catch (error) {
      console.error(`[TxCache] FAILED to write ${filePath}:`, error);
      throw error;
    }

    this.index.transactions[txid] = {
      size,
      timestamp: now,
      lastAccessed: now,
      network,
      inputCount: metadata?.inputCount,
      outputCount: metadata?.outputCount
    };
    this.index.totalSize += size;
    this.saveIndex();

    console.log(`[TxCache] Saved ${txid} to ${network} (${size} bytes). Total: ${this.index.totalSize} bytes`);
  }

  /**
   * Check if transaction exists in cache
   */
  exists(txid: string): boolean {
    return !!this.index.transactions[txid];
  }

  /**
   * Get network for a transaction if it's in cache
   */
  getNetwork(txid: string): 'main' | 'test' | null {
    return this.index.transactions[txid]?.network || null;
  }

  /**
   * List all cached transactions with metadata
   */
  listAll(): Array<TransactionMetadata & { txid: string }> {
    return Object.entries(this.index.transactions).map(([txid, meta]) => ({
      txid,
      ...meta
    })).sort((a, b) => b.lastAccessed - a.lastAccessed); // Most recent first
  }

  /**
   * Delete transaction from cache
   */
  delete(txid: string): boolean {
    const meta = this.index.transactions[txid];
    if (!meta) {
      return false;
    }

    this.deleteTransactionFile(txid, meta.network);
    this.index.totalSize -= meta.size;
    delete this.index.transactions[txid];
    this.saveIndex();

    console.log(`[TxCache] Deleted ${txid}`);
    return true;
  }

  /**
   * Fetch transaction with unified fallback strategy
   * Order: Cache → JungleBus → WhatOnChain main → WhatOnChain test → Error
   * Automatically detects and saves network information
   *
   * @param txid Transaction ID
   * @param preferredNetwork Preferred network to try first (default: 'mainnet')
   * @returns Raw transaction hex
   */
  async fetch(txid: string, preferredNetwork: string = 'mainnet'): Promise<string> {
    // 1. Check cache (checks both networks automatically)
    const cached = this.get(txid);
    if (cached) {
      console.log(`[TxCache] Cache hit for ${txid} on ${cached.network}`);
      return cached.rawTxHex;
    }

    console.log(`[TxCache] Cache miss for ${txid}, fetching...`);

    // 2. Try JungleBus (primary) - assume mainnet since JungleBus is mainnet-only
    try {
      const rawTx = await this.fetchFromJungleBus(txid);
      console.log(`[TxCache] Fetched ${txid} from JungleBus (mainnet)`);
      this.set(txid, rawTx, 'main');
      return rawTx;
    } catch (error) {
      console.warn(`[TxCache] JungleBus failed for ${txid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Try WhatOnChain - prefer the user's specified network first
    const firstNetwork = preferredNetwork === 'testnet' || preferredNetwork === 'test' ? 'test' : 'main';
    const secondNetwork = firstNetwork === 'main' ? 'test' : 'main';

    // Try preferred network first
    try {
      const rawTx = await this.fetchFromWhatOnChain(txid, firstNetwork === 'main' ? 'mainnet' : 'testnet');
      console.log(`[TxCache] Fetched ${txid} from WhatOnChain (${firstNetwork})`);
      this.set(txid, rawTx, firstNetwork);
      return rawTx;
    } catch (firstError) {
      console.warn(`[TxCache] WhatOnChain ${firstNetwork} failed for ${txid}, trying ${secondNetwork}...`);

      // 4. Last resort: try other network
      try {
        const rawTx = await this.fetchFromWhatOnChain(txid, secondNetwork === 'main' ? 'mainnet' : 'testnet');
        console.log(`[TxCache] Fetched ${txid} from WhatOnChain (${secondNetwork})`);
        this.set(txid, rawTx, secondNetwork);
        return rawTx;
      } catch (secondError) {
        throw new Error(`Failed to fetch ${txid} from all sources (JungleBus, WhatOnChain main/test)`);
      }
    }
  }

  /**
   * Fetch multiple transactions in parallel
   *
   * @param txids Array of transaction IDs
   * @param network Network for WhatOnChain fallback
   * @returns Map of txid -> rawTxHex (only successful fetches)
   */
  async fetchMultiple(txids: string[], network: string = 'mainnet'): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    const promises = txids.map(txid =>
      this.fetch(txid, network)
        .then(rawTx => ({ txid, rawTx, success: true as const }))
        .catch(error => ({ txid, error, success: false as const }))
    );

    const settled = await Promise.allSettled(promises);

    settled.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.set(result.value.txid, result.value.rawTx);
      } else if (result.status === 'fulfilled' && !result.value.success) {
        console.warn(`[TxCache] Failed to fetch ${result.value.txid}:`, result.value.error);
      }
    });

    return results;
  }

  /**
   * Decode raw transaction hex
   */
  decode(rawTxHex: string): DecodedTransaction {
    const tx = Transaction.fromHex(rawTxHex);
    const txid = tx.id('hex') as string;
    const size = rawTxHex.length / 2;

    return {
      version: tx.version,
      lockTime: tx.lockTime,
      txid,
      size,
      network: 'mainnet',
      inputs: tx.inputs.map((input, index) => {
        let sourceTXID = input.sourceTXID || '';
        if (!sourceTXID && input.sourceTransaction) {
          sourceTXID = input.sourceTransaction.id('hex') as string;
        }

        return {
          index,
          sourceTXID,
          sourceOutputIndex: input.sourceOutputIndex,
          unlockingScript: input.unlockingScript ? input.unlockingScript.toHex() : '',
          unlockingScriptAsm: input.unlockingScript ? input.unlockingScript.toASM() : '',
          sequence: input.sequence || 0xffffffff
        };
      }),
      outputs: tx.outputs.map((output, index) => ({
        index,
        satoshis: output.satoshis || 0,
        lockingScript: output.lockingScript.toHex(),
        lockingScriptAsm: output.lockingScript.toASM()
      }))
    };
  }

  /**
   * Fetch and decode transaction
   */
  async fetchAndDecode(txid: string, network: string = 'mainnet'): Promise<DecodedTransaction> {
    const rawTx = await this.fetch(txid, network);
    return this.decode(rawTx);
  }

  /**
   * Build SpendParams for script debugging
   */
  async buildSpendParams(spendingTxid: string, inputIndex: number): Promise<SpendParams> {
    const spendingTxHex = await this.fetch(spendingTxid);
    const spendingTx = this.decode(spendingTxHex);

    const input = spendingTx.inputs[inputIndex];
    if (!input) {
      throw new Error(`Input ${inputIndex} not found in transaction ${spendingTxid}`);
    }

    const { sourceTXID, sourceOutputIndex, unlockingScript, sequence } = input;

    if (!sourceTXID || sourceTXID === '0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('Cannot build spend params for coinbase transaction');
    }

    const sourceTxHex = await this.fetch(sourceTXID);
    const sourceTx = Transaction.fromHex(sourceTxHex);

    const sourceOutput = sourceTx.outputs[sourceOutputIndex];
    if (!sourceOutput) {
      throw new Error(`Source output ${sourceOutputIndex} not found in transaction ${sourceTXID}`);
    }

    if (!sourceOutput.lockingScript) {
      throw new Error('Source output has no locking script');
    }

    const lockingScriptHex = sourceOutput.lockingScript.toHex();

    const otherInputs = spendingTx.inputs
      .filter((_, i) => i !== inputIndex)
      .map(inp => ({
        sourceTXID: inp.sourceTXID,
        sourceOutputIndex: inp.sourceOutputIndex,
        sequence: inp.sequence
      }));

    const outputs = spendingTx.outputs.map(out => ({
      satoshis: out.satoshis,
      lockingScript: out.lockingScript
    }));

    return {
      sourceTXID,
      sourceOutputIndex,
      sourceSatoshis: sourceOutput.satoshis || 1000,
      lockingScript: lockingScriptHex,
      transactionVersion: spendingTx.version,
      otherInputs,
      outputs,
      unlockingScript,
      inputSequence: sequence,
      inputIndex,
      lockTime: spendingTx.lockTime,
    };
  }

  /**
   * List all cached transaction IDs (sorted by most recently accessed)
   */
  list(): string[] {
    return Object.entries(this.index.transactions)
      .map(([txid, meta]) => ({ txid, lastAccessed: meta.lastAccessed }))
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .map(item => item.txid);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const maxSize = this.getMaxSizeBytes();
    return {
      totalSize: this.index.totalSize,
      totalSizeMB: this.index.totalSize / (1024 * 1024),
      maxSizeMB: maxSize / (1024 * 1024),
      transactionCount: Object.keys(this.index.transactions).length,
      utilizationPercent: (this.index.totalSize / maxSize) * 100
    };
  }

  /**
   * Manual pruning to target size (optional)
   */
  prune(targetSizeMB?: number): number {
    const targetBytes = targetSizeMB
      ? targetSizeMB * 1024 * 1024
      : this.getMaxSizeBytes() * 0.8; // Prune to 80% if no target

    const sortedTxs = Object.entries(this.index.transactions)
      .map(([txid, meta]) => ({ txid, ...meta }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let currentSize = this.index.totalSize;
    let prunedCount = 0;

    for (const tx of sortedTxs) {
      if (currentSize <= targetBytes) {
        break;
      }

      this.deleteTransactionFile(tx.txid, tx.network);
      delete this.index.transactions[tx.txid];
      currentSize -= tx.size;
      prunedCount++;
    }

    this.index.totalSize = currentSize;
    this.saveIndex();

    console.log(`[TxCache] Manual prune: removed ${prunedCount} transactions`);
    return prunedCount;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const entries = Object.entries(this.index.transactions);
    for (const [txid, meta] of entries) {
      this.deleteTransactionFile(txid, meta.network);
    }

    this.index = {
      transactions: {},
      totalSize: 0
    };
    this.saveIndex();

    console.log('[TxCache] Cleared all transactions');
  }

  /**
   * Update transaction label
   */
  setLabel(txid: string, label: string): boolean {
    const tx = this.index.transactions[txid];
    if (!tx) {
      console.warn(`[TxCache] Cannot set label for non-existent transaction ${txid}`);
      return false;
    }

    tx.label = label || undefined;
    this.saveIndex();
    console.log(`[TxCache] Updated label for ${txid}: "${label}"`);
    return true;
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.transactionsDir;
  }
}

// Singleton instance
export const txCache = new TxCache();
