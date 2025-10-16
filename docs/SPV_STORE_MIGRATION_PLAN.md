# SPV-Store Migration Plan for VS Code Bitcoin Extension

## Executive Summary

**REPLACE** our current `txCache` system entirely with `spv-store` as THE ONLY transaction and UTXO storage system. No fallbacks, no dual systems - just spv-store, exactly like yours-wallet uses it.

## What We're Replacing

### Current System (BEING REMOVED)
**File:** `src/services/txCache.ts`

**What it does:**
- Stores raw transaction hex in `~/.bitcoin/transactions/{network}/{txid}.hex`
- Simple file-based cache
- NO UTXO tracking
- NO spend status
- Every time we need UTXOs, we call the API

**Problems:**
- ❌ No local UTXO state
- ❌ Can't track what's spent vs unspent
- ❌ Can't chain transactions (can't spend change immediately)
- ❌ Redundant API calls
- ❌ No indexing by address, type, etc.

## What We're Implementing

### New System (spv-store)
**Exactly like yours-wallet uses it**

**What it provides:**
- ✅ Local UTXO database with spend tracking
- ✅ Automatic state updates on broadcast
- ✅ Transaction chaining (spend change immediately)
- ✅ Indexers (fund, lock, inscription, etc.)
- ✅ Cached source transactions
- ✅ Block header tracking for SPV validation

**Reference Implementation:** `yours-wallet/src/services/Bsv.service.ts`

## How yours-wallet Does It

```typescript
// Get UTXOs (from local database)
fundingTxos = async () => {
  const results = await this.oneSatSPV.search(new TxoLookup('fund'), TxoSort.DESC, 0)
  return results.txos  // Returns unspent UTXOs from local storage
}

// Get source transaction (from local cache)
const sourceTx = await this.oneSatSPV.getTx(utxo.outpoint.txid)

// Broadcast transaction (automatically updates UTXO states)
await this.oneSatSPV.broadcast(tx)
// ↑ This marks spent UTXOs and adds change UTXOs automatically
```

**That's it. No API fallbacks. Local storage is the source of truth.**

## Storage Backend: fake-indexeddb

**Why:** spv-store only has IndexedDB storage implementation (browser-only)

**Solution:** `fake-indexeddb` - provides IndexedDB API in Node.js

**How it works:**
- Installed via npm: `fake-indexeddb@^6.2.3`
- Import at the top of extension: `import 'fake-indexeddb/auto'`
- Persists to disk automatically
- spv-store's existing IDB code works unchanged

**Storage location:** `~/.bitcoin/.fakeIndexedDB/`

## Architecture

### Components

#### 1. SPV Store (Core)
**Package:** `spv-store@^0.1.86`
**Reference:** `spv-store/src/spv-store.ts`

Main interface:
```typescript
interface SPVStore {
  // Search UTXOs by indexer tag
  search(lookup: TxoLookup, sort?: TxoSort, limit?: number): Promise<TxoResults>

  // Get cached transaction
  getTx(txid: string): Promise<Transaction>

  // Broadcast and update UTXO states
  broadcast(tx: Transaction): Promise<BroadcastResponse | BroadcastFailure>

  // Get current block height
  getSyncedBlock(): Promise<BlockHeader | undefined>

  // Clean up
  destroy(): Promise<void>
}
```

#### 2. Storage Layer (IndexedDB via fake-indexeddb)
**Reference:** `spv-store/src/storage/idb/`

Three databases:

**blocks-{network}**
- Key: `height`
- Value: `BlockHeader { height, hash, prevHash, merkleRoot }`
- Purpose: SPV validation

**txns-{network}**
- Key: `txid`
- Value: `Txn { txid, rawtx, proof, status, block }`
- Purpose: Transaction cache

**txos-{accountId}-{network}**
- Key: `[txid, vout]`
- Value: `Txo { outpoint, satoshis, script, spend, owner, data, ... }`
- Indexes: `spend`, `events`, `tags`, `logs`
- Purpose: UTXO state database

#### 3. Indexers
**Reference:** `spv-store/src/indexers/`

**FundIndexer** (primary - for spendable UTXOs)
```typescript
class FundIndexer extends Indexer {
  tag = "fund"

  // Parses transaction outputs
  async parse(ctx: IndexContext, vout: number): Promise<IndexData | undefined> {
    const address = parseAddress(script)
    if (address && this.owners.has(address) && satoshis >= 2) {
      return { data: address, events: [{ id: "address", value: address }] }
    }
  }

  // Syncs from API on startup
  async sync(txoStore: TxoStore, ingestQueue): Promise<number> {
    const oneSat = new OneSatProvider(this.network, accountId)
    for (const address of this.owners) {
      const utxos = await oneSat.txosByAddress(address)
      // Queue for ingestion into local database
    }
  }
}
```

**Available indexers we can enable:**
- `LockIndexer` - nLockTime outputs
- `OrdLockIndexer` - Locked ordinals
- `InscriptionIndexer` - Ordinals inscriptions
- `OriginIndexer` - 1Sat ordinals
- `Bsv20Indexer` / `Bsv21Indexer` - BSV-20/21 tokens
- `SigmaIndexer` - Sigma attestations
- `MapIndexer` - MAP protocol
- `CosignIndexer` - Co-signatures

**For now: Just FundIndexer**

#### 4. OneSatWebSPV (Pre-configured Setup)
**Reference:** `spv-store/src/pre-config/1sat-web.ts`

Factory that wires everything together:
```typescript
class OneSatWebSPV extends SPVStore {
  static async init(
    accountId: string,
    indexers: Indexer[],
    owners: Set<string>,
    network: Network,
    startSync: boolean,
    syncTags?: Set<string>,
    parseMode?: ParseMode
  ): Promise<SPVStore>
}
```

Works in Node.js when fake-indexeddb is loaded!

## Implementation Plan

### Phase 1: Install and Setup (1-2 hours)

#### 1.1 Install Dependencies

```bash
npm install spv-store@^0.1.86 fake-indexeddb@^6.2.3
```

#### 1.2 Create SpvService

**File:** `vscode-bitcoin/src/services/spvService.ts`

```typescript
import {
  FundIndexer,
  OneSatWebSPV,
  ParseMode,
  TxoLookup,
  TxoSort,
  type SPVStore,
  type Txo
} from 'spv-store'
import type { Transaction } from '@bsv/sdk'

export class SpvService {
  private spv: SPVStore | null = null
  private initPromise: Promise<SPVStore> | null = null

  /**
   * Initialize SPV store - MUST be called before any other methods
   */
  async initialize(
    accountId: string,
    addresses: string[],
    network: 'mainnet' | 'testnet'
  ): Promise<SPVStore> {
    // Prevent duplicate initialization
    if (this.initPromise) return this.initPromise
    if (this.spv) return this.spv

    this.initPromise = this._init(accountId, addresses, network)
    this.spv = await this.initPromise
    this.initPromise = null

    return this.spv
  }

  private async _init(
    accountId: string,
    addresses: string[],
    network: 'mainnet' | 'testnet'
  ): Promise<SPVStore> {
    const owners = new Set(addresses)
    const indexers = [
      new FundIndexer(owners, network, false) // false = don't sync full history
    ]

    const spv = await OneSatWebSPV.init(
      accountId,
      indexers,
      owners,
      network,
      true, // startSync - sync on initialization
      new Set(['fund']), // Only sync fund indexer
      ParseMode.Persist
    )

    console.log('[SpvService] Initialized - storage location: ~/.bitcoin/.fakeIndexedDB/')
    return spv
  }

  /**
   * Get funding UTXOs for an address
   * Returns LOCAL UTXOs from spv-store database
   */
  async getUtxos(address: string): Promise<Txo[]> {
    if (!this.spv) throw new Error('SPV not initialized - call initialize() first')

    const results = await this.spv.search(new TxoLookup('fund'), TxoSort.DESC, 0)
    return results.txos.filter(txo => txo.owner === address && !txo.spend)
  }

  /**
   * Get transaction from LOCAL cache
   * Source transactions are already cached by spv-store
   */
  async getTx(txid: string): Promise<Transaction> {
    if (!this.spv) throw new Error('SPV not initialized - call initialize() first')
    return await this.spv.getTx(txid)
  }

  /**
   * Broadcast transaction and UPDATE LOCAL UTXO states
   * Automatically marks spent UTXOs and adds change
   */
  async broadcast(tx: Transaction) {
    if (!this.spv) throw new Error('SPV not initialized - call initialize() first')
    return await this.spv.broadcast(tx)
  }

  /**
   * Get current synced block height
   */
  async getBlockHeight(): Promise<number> {
    if (!this.spv) throw new Error('SPV not initialized - call initialize() first')
    const header = await this.spv.getSyncedBlock()
    return header?.height || 0
  }

  /**
   * Clean up on extension deactivation
   */
  async destroy() {
    if (this.spv) {
      await this.spv.destroy()
      this.spv = null
    }
  }
}

export const spvService = new SpvService()
```

#### 1.3 Initialize on Extension Activation

**File:** `vscode-bitcoin/src/extension.tsx`

Add at the very top (before any other imports):
```typescript
import 'fake-indexeddb/auto'  // ⚠️ MUST BE FIRST!
```

Then in activate():
```typescript
import { spvService } from './services/spvService'

export async function activate(context: vscode.ExtensionContext) {
  console.log('[Extension] Activating vscode-bitcoin')

  // Initialize SPV store
  try {
    // TODO: Get from key vault or settings
    const accountId = 'default'
    const addresses = ['1YourBsvAddress...'] // Get from key vault
    const network = vscode.workspace.getConfiguration('bitcoin').get('network', 'mainnet')

    await spvService.initialize(accountId, addresses, network)
    console.log('[Extension] SPV store ready')
  } catch (error) {
    console.error('[Extension] SPV initialization failed:', error)
    vscode.window.showErrorMessage('Failed to initialize Bitcoin wallet storage')
  }

  // ... rest of activation
}

export function deactivate() {
  return spvService.destroy()
}
```

### Phase 2: Replace Transaction Building (2-3 hours)

#### 2.1 Update BAP Profile Publishing

**File:** `vscode-bitcoin/src/views/bitcoinTools/index.tsx:2354-2458`

**REMOVE:**
```typescript
// OLD - REMOVE THIS
const utxos = await txCache.getUtxos(address)
let cached = txCache.get(utxo.txid)
const sourceTx = Transaction.fromHex(cached.rawTxHex)
txCache.set(tx.id('hex'), tx.toHex(), 'main', { ... })
```

**REPLACE WITH:**
```typescript
// NEW - THE ONLY WAY
import { spvService } from '../../services/spvService'

// Get UTXOs from spv-store
progress.report({ message: 'Fetching UTXOs' })
const utxos = await spvService.getUtxos(address)

if (utxos.length === 0) {
  throw new Error('No UTXOs available. Please fund your wallet.')
}

// Sort largest first
const sortedUtxos = utxos.sort((a, b) => Number(b.satoshis - a.satoshis))

// Add inputs iteratively
const selectedUtxos: typeof utxos = []
let totalSatsIn = 0
const totalSatsOut = tx.outputs.reduce((sum, out) => sum + (out.satoshis || 0), 0)
const feeModel = new SatoshisPerKilobyte(10)
let currentFee = 0

for (const utxo of sortedUtxos) {
  // Get source transaction from spv-store cache
  const sourceTx = await spvService.getTx(utxo.outpoint.txid)

  tx.addInput({
    sourceTXID: utxo.outpoint.txid,
    sourceOutputIndex: utxo.outpoint.vout,
    sourceTransaction: sourceTx,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey),
    sequence: 0xffffffff
  })

  selectedUtxos.push(utxo)
  totalSatsIn += Number(utxo.satoshis)

  currentFee = await feeModel.computeFee(tx)

  if (totalSatsIn >= totalSatsOut + currentFee) {
    break
  }
}

if (totalSatsIn < totalSatsOut + currentFee) {
  throw new Error(
    `Not enough funds. Need ${totalSatsOut + currentFee} sats, have ${totalSatsIn}`
  )
}

// Add change output
tx.addOutput({
  lockingScript: new P2PKH().lock(address),
  change: true
})

// Calculate fee and sign
await tx.fee(feeModel)
await tx.sign()

// Broadcast - automatically updates UTXO states!
progress.report({ message: 'Broadcasting transaction' })
const response = await spvService.broadcast(tx)

if (response.status === 'success') {
  vscode.window.showInformationMessage(
    `Profile published! TXID: ${response.txid}`
  )
} else {
  throw new Error(response.description || 'Broadcast failed')
}
```

#### 2.2 Update Send Transaction Command

**File:** `vscode-bitcoin/src/commands/sendTransaction/index.ts:112-140`

**REMOVE:**
```typescript
// OLD
const { txCache } = await import('../../services/txCache')
const utxos = await txCache.getUtxos(address)
```

**REPLACE WITH:**
```typescript
// NEW
import { spvService } from '../../services/spvService'
const utxos = await spvService.getUtxos(address)
```

Similar changes for input building and broadcasting.

#### 2.3 Update Get UTXOs Command

**File:** `vscode-bitcoin/src/commands/getUtxosForAddress/index.ts:86-88`

**REMOVE:**
```typescript
// OLD
const { txCache } = await import('../../services/txCache')
const utxos = await txCache.getUtxos(address)
```

**REPLACE WITH:**
```typescript
// NEW
import { spvService } from '../../services/spvService'
const utxos = await spvService.getUtxos(address)

// Format for display
return {
  data: JSON.stringify(
    utxos.map(u => ({
      txid: u.outpoint.txid,
      vout: u.outpoint.vout,
      satoshis: Number(u.satoshis),
      address: u.owner
    })),
    null,
    2
  ),
  type: 'json'
}
```

#### 2.4 Update Ordinals Service

**File:** `vscode-bitcoin/src/services/ordinalsService.ts:42-50`

**REMOVE:**
```typescript
// OLD
async getPaymentUtxos(address: string): Promise<Utxo[]> {
  const { txCache } = await import('./txCache')
  return await txCache.getUtxos(address)
}
```

**REPLACE WITH:**
```typescript
// NEW
async getPaymentUtxos(address: string): Promise<Utxo[]> {
  const { spvService } = await import('./spvService')
  const txos = await spvService.getUtxos(address)

  // Convert Txo format to Utxo format
  return txos.map(txo => ({
    txid: txo.outpoint.txid,
    vout: txo.outpoint.vout,
    satoshis: Number(txo.satoshis),
    script: Utils.toBase64(txo.script)
  }))
}
```

### Phase 3: Remove Old System (1 hour)

#### 3.1 Delete or Gut TxCache

**File:** `vscode-bitcoin/src/services/txCache.ts`

**Option A:** Delete entirely
**Option B:** Keep only as a legacy migration helper

Recommendation: **Delete it**. Clean break.

#### 3.2 Update Transaction Decoder

**File:** `vscode-bitcoin/src/views/transactionDecoder/index.tsx`

Currently uses txCache for:
- Fetching transactions by txid
- Caching decoded transactions
- Resolving inputs

**Update to use spvService:**
```typescript
// Fetch transaction
const rawTxHex = await spvService.getTx(txid).then(tx => tx.toHex())

// For input resolution
const sourceTx = await spvService.getTx(input.sourceTXID)
```

#### 3.3 Search and Replace

Find all remaining references:
```bash
grep -r "txCache" src/ --include="*.ts" --include="*.tsx"
```

Replace with spvService usage.

### Phase 4: Testing (1-2 days)

#### 4.1 Unit Tests

Create: `vscode-bitcoin/src/services/__tests__/spvService.test.ts`

Tests:
- Initialize with addresses
- Get UTXOs
- Get transaction
- Broadcast and verify UTXO updates

#### 4.2 Integration Tests

1. **Basic Send Flow**
   - Initialize extension
   - Get UTXOs
   - Build transaction
   - Broadcast
   - Verify UTXO states updated

2. **Transaction Chaining**
   - Send tx1
   - Immediately send tx2 spending change from tx1
   - Verify both work

3. **Multiple Transactions**
   - Send 5 transactions sequentially
   - Verify balance correct
   - Verify all UTXOs tracked correctly

#### 4.3 Manual Testing Checklist

- [ ] Fresh install - first sync works
- [ ] Publish BAP identity
- [ ] Send BSV transaction
- [ ] Send multiple transactions in sequence
- [ ] Restart extension - state persists
- [ ] Switch accounts - UTXOs separate
- [ ] Network error handling - graceful failure
- [ ] Decoder shows transactions from cache

## Data Migration

### Existing Cached Transactions

**Current location:** `~/.bitcoin/transactions/main/*.hex`

**Migration strategy:**

**Option 1:** Let users re-sync (RECOMMENDED)
- On first load, spv-store syncs from API
- Clean slate, guaranteed correct state
- 10-30 seconds for most users

**Option 2:** Import existing cached transactions
- Read all .hex files
- Import into spv-store
- More complex, potential for issues

**Recommendation:** Option 1. Clean sync from API is fast and reliable.

## Benefits Summary

### What We Gain

1. **UTXO State Tracking**
   - Know exactly what's spent vs unspent
   - No API calls to check balance
   - Instant, accurate balance

2. **Transaction Chaining**
   - Spend change immediately
   - Build dependent transactions
   - No waiting for API sync

3. **Performance**
   - All transactions cached locally
   - Fast UTXO queries with indexes
   - No redundant API calls

4. **Consistency with Ecosystem**
   - Same system as yours-wallet
   - Same system other tools will use
   - Battle-tested, proven code

5. **Future Extensibility**
   - Add lock tracking
   - Add ordinals tracking
   - Add token tracking
   - Just enable more indexers!

### What We Lose

- Nothing. Old system had no advantages.

## Timeline

**Total: 1-2 weeks**

- **Day 1-2:** Setup (install, create spvService, initialize)
- **Day 3-4:** Replace transaction building code
- **Day 5:** Remove old txCache
- **Day 6-7:** Testing and polish

## Success Criteria

- [ ] Extension activates and syncs UTXOs
- [ ] Can publish BAP identity
- [ ] Can send BSV transaction
- [ ] Can send multiple transactions in sequence
- [ ] Balance updates immediately after broadcast
- [ ] No txCache code remains
- [ ] All tests pass

## References

### spv-store
- Main: `spv-store/src/spv-store.ts`
- IDB Storage: `spv-store/src/storage/idb/`
- Indexers: `spv-store/src/indexers/`
- Web Setup: `spv-store/src/pre-config/1sat-web.ts`

### yours-wallet
- Initialization: `yours-wallet/src/initSPVStore.ts:84-116`
- Usage: `yours-wallet/src/services/Bsv.service.ts:406-409, 172-290`

### vscode-bitcoin (Current - TO BE REPLACED)
- TxCache: `src/services/txCache.ts` ← DELETE
- Transaction Building: `src/views/bitcoinTools/index.tsx:2354-2458` ← UPDATE
- Send Command: `src/commands/sendTransaction/index.ts:112-140` ← UPDATE
- Get UTXOs: `src/commands/getUtxosForAddress/index.ts:86-88` ← UPDATE

## Next Steps

1. ✅ Review this plan
2. Install dependencies: `npm install spv-store fake-indexeddb`
3. Create spvService.ts
4. Initialize in extension.tsx
5. Update first transaction building code
6. Test it works
7. Continue replacing all usage
8. Delete txCache
9. Ship it!
