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
}

interface StorageIndex {
  transactions: { [txid: string]: Omit<TransactionMetadata, 'txid'> };
  totalSize: number;
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
 * - File-based cache (.bitcoin/transactions/<txid>.hex)
 * - LRU (Least Recently Used) pruning
 * - Configurable size limits (10MB-10GB, default 100MB)
 * - Unified fetch: Cache → JungleBus → WhatOnChain → Error
 * - Batch operations
 * - Transaction decoding
 */
export class TxCache {
  private transactionsDir: string;
  private indexFile: string;
  private index: StorageIndex;
  private readonly ABSOLUTE_MIN_SIZE_MB = 10;
  private readonly ABSOLUTE_MAX_SIZE_MB = 10240;

  constructor(workspaceRoot?: string) {
    const bitcoinDir = this.getBitcoinDirectory(workspaceRoot);
    this.transactionsDir = path.join(bitcoinDir, 'transactions');
    this.indexFile = path.join(this.transactionsDir, 'index.json');

    this.ensureDirectory();
    this.index = this.loadIndex();
  }

  private getBitcoinDirectory(workspaceRoot?: string): string {
    if (workspaceRoot) {
      const config = vsApi.workspace.getConfiguration('bitcoin');
      const bitcoinPath = config.get<string>('workspace.path') || '.bitcoin';
      return path.join(workspaceRoot, bitcoinPath);
    }

    const config = vsApi.workspace.getConfiguration('bitcoin');
    const bitcoinPath = config.get<string>('workspace.path') || '.bitcoin';

    if (!vsApi?.workspace?.workspaceFolders?.length) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
      return path.join(homeDir, bitcoinPath);
    }

    const wsRoot = vsApi.workspace.workspaceFolders[0].uri.fsPath;
    return path.join(wsRoot, bitcoinPath);
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.transactionsDir)) {
      fs.mkdirSync(this.transactionsDir, { recursive: true });
    }
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

      this.deleteTransactionFile(tx.txid);
      delete this.index.transactions[tx.txid];
      currentSize -= tx.size;

      console.log(`[TxCache] Pruned ${tx.txid} (${tx.size} bytes, last accessed ${new Date(tx.lastAccessed).toISOString()})`);
    }

    this.index.totalSize = currentSize;
    this.saveIndex();
  }

  private deleteTransactionFile(txid: string): void {
    const filePath = path.join(this.transactionsDir, `${txid}.hex`);
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
   */
  get(txid: string): string | null {
    const filePath = path.join(this.transactionsDir, `${txid}.hex`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const rawTxHex = fs.readFileSync(filePath, 'utf-8');

      // Update last accessed time (LRU tracking)
      if (this.index.transactions[txid]) {
        this.index.transactions[txid].lastAccessed = Date.now();
        this.saveIndex();
      }

      return rawTxHex;
    } catch (error) {
      console.error(`[TxCache] Failed to load ${txid}:`, error);
      return null;
    }
  }

  /**
   * Save transaction to cache
   */
  set(txid: string, rawTxHex: string): void {
    const size = Buffer.byteLength(rawTxHex, 'utf-8');
    const now = Date.now();

    const existing = this.index.transactions[txid];
    if (existing) {
      existing.lastAccessed = now;
      this.saveIndex();
      console.log(`[TxCache] Updated access time for ${txid}`);
      return;
    }

    this.pruneIfNeeded(size);

    const filePath = path.join(this.transactionsDir, `${txid}.hex`);
    fs.writeFileSync(filePath, rawTxHex, 'utf-8');

    this.index.transactions[txid] = {
      size,
      timestamp: now,
      lastAccessed: now
    };
    this.index.totalSize += size;
    this.saveIndex();

    console.log(`[TxCache] Saved ${txid} (${size} bytes). Total: ${this.index.totalSize} bytes`);
  }

  /**
   * Check if transaction exists in cache
   */
  exists(txid: string): boolean {
    return !!this.index.transactions[txid];
  }

  /**
   * Delete transaction from cache
   */
  delete(txid: string): boolean {
    const meta = this.index.transactions[txid];
    if (!meta) {
      return false;
    }

    this.deleteTransactionFile(txid);
    this.index.totalSize -= meta.size;
    delete this.index.transactions[txid];
    this.saveIndex();

    console.log(`[TxCache] Deleted ${txid}`);
    return true;
  }

  /**
   * Fetch transaction with unified fallback strategy
   * Order: Cache → JungleBus → WhatOnChain → Error
   *
   * @param txid Transaction ID
   * @param network Network to use for WhatOnChain fallback (default: 'mainnet')
   * @returns Raw transaction hex
   */
  async fetch(txid: string, network: string = 'mainnet'): Promise<string> {
    // 1. Check cache
    const cached = this.get(txid);
    if (cached) {
      console.log(`[TxCache] Cache hit for ${txid}`);
      return cached;
    }

    console.log(`[TxCache] Cache miss for ${txid}, fetching...`);

    // 2. Try JungleBus (primary)
    try {
      const rawTx = await this.fetchFromJungleBus(txid);
      console.log(`[TxCache] Fetched ${txid} from JungleBus`);
      this.set(txid, rawTx);
      return rawTx;
    } catch (error) {
      console.warn(`[TxCache] JungleBus failed for ${txid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Fallback to WhatOnChain (try mainnet)
    try {
      const rawTx = await this.fetchFromWhatOnChain(txid, 'mainnet');
      console.log(`[TxCache] Fetched ${txid} from WhatOnChain (mainnet)`);
      this.set(txid, rawTx);
      return rawTx;
    } catch (mainnetError) {
      console.warn(`[TxCache] WhatOnChain mainnet failed for ${txid}, trying testnet...`);

      // 4. Last resort: WhatOnChain testnet
      try {
        const rawTx = await this.fetchFromWhatOnChain(txid, 'testnet');
        console.log(`[TxCache] Fetched ${txid} from WhatOnChain (testnet)`);
        this.set(txid, rawTx);
        return rawTx;
      } catch (testnetError) {
        throw new Error(`Failed to fetch ${txid} from all sources (JungleBus, WhatOnChain mainnet/testnet)`);
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

      this.deleteTransactionFile(tx.txid);
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
    const txids = Object.keys(this.index.transactions);
    for (const txid of txids) {
      this.deleteTransactionFile(txid);
    }

    this.index = {
      transactions: {},
      totalSize: 0
    };
    this.saveIndex();

    console.log('[TxCache] Cleared all transactions');
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
