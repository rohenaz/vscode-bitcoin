# Storage Solution Comparison: spv-store vs wallet-toolbox

## Executive Summary

**RECOMMENDATION: Use spv-store with fake-indexeddb**

While wallet-toolbox offers SQLite support which would be ideal for a VS Code extension, its scope far exceeds our needs. spv-store is the right tool for UTXO tracking and transaction caching.

---

## Comparison Matrix

| Feature | spv-store | wallet-toolbox |
|---------|-----------|----------------|
| **Primary Purpose** | UTXO tracking & tx cache | Full BRC-100 wallet |
| **Storage Backends** | IndexedDB only | Knex (SQLite, MySQL), IndexedDB |
| **Dependencies** | `spv-store`, `fake-indexeddb` | `knex`, `sqlite3`, `mysql2`, `express`, `ws`, + many more |
| **Package Size** | ~500KB | ~5MB+ |
| **API Complexity** | Simple (search, getTx, broadcast) | Complex (createAction, signAction, listOutputs, certificates, etc.) |
| **Use Case** | Transaction storage & UTXO index | Full custodial wallet service |
| **yours-wallet uses** | ✅ Yes | ❌ No |
| **Node.js Support** | Via fake-indexeddb | ✅ Native |

---

## Detailed Analysis

### spv-store

**What it provides:**
- Transaction storage (Txn) with status tracking
- UTXO storage (Txo) with indexing
- Block header storage for SPV validation
- Modular indexers (FundIndexer, InscriptionIndexer, etc.)
- Simple API: `search()`, `getTx()`, `broadcast()`

**Storage Structure:**
```typescript
// Three IndexedDB databases:
blocks-{network}     // Block headers for SPV
txns-{network}       // Transaction cache
txos-{accountId}-{network}  // UTXO database

// Core data type:
interface Txo {
  outpoint: { txid: string; vout: number }
  satoshis: bigint
  script: number[]
  spend?: { txid: string; vin: number }
  owner: string
  indexer data: any
}
```

**Usage Pattern (from yours-wallet):**
```typescript
// Initialize
const spv = await OneSatWebSPV.init(
  accountId, indexers, owners, network,
  true, syncSources, ParseMode.Persist
)

// Get UTXOs
const results = await spv.search(new TxoLookup('fund'), TxoSort.DESC, 0)
const utxos = results.txos.filter(txo => !txo.spend)

// Get transaction
const tx = await spv.getTx(txid)

// Broadcast (automatically updates UTXO states)
await spv.broadcast(tx)
```

**Pros:**
- ✅ Exactly what yours-wallet uses successfully
- ✅ Focused scope - does one thing well
- ✅ Lightweight dependencies
- ✅ Simple integration
- ✅ Proven in production (yours-wallet)
- ✅ Already have detailed migration plan

**Cons:**
- ❌ IndexedDB only (need fake-indexeddb shim)
- ❌ IndexedDB persistence in Node.js is less tested

---

### wallet-toolbox

**What it provides:**
- Full BRC-100 compliant wallet implementation
- User management (multi-user support)
- Action processing (`createAction`, `signAction`, `abortAction`)
- Output baskets for coin selection
- Certificate management (identity certificates)
- Transaction labels and tags
- Proven transaction tracking with merkle proofs
- Background monitor daemon
- Wallet sync between storage providers
- Key derivation and privileged key management

**Storage Structure:**
```sql
-- Many tables for full wallet functionality:
users               -- User accounts
transactions        -- All transactions
outputs             -- All outputs (UTXOs)
output_baskets      -- Output organization
proven_txs          -- Confirmed transactions with proofs
proven_tx_reqs      -- Pending transaction broadcasts
certificates        -- Identity certificates
certificate_fields  -- Certificate data
tx_labels           -- Transaction labels
tx_labels_map       -- Label associations
output_tags         -- Output tags
output_tags_map     -- Tag associations
commissions         -- Commission tracking
sync_states         -- Multi-storage sync
monitor_events      -- Background task events
```

**Usage Pattern:**
```typescript
// Initialize (much more complex)
const storage = new StorageKnex({
  knex: knexInstance,
  chain: 'main',
  feeModel: { model: 'sat/kb', value: 1 },
  commissionSatoshis: 0
})
await storage.migrate(storageName, identityKey)

const wallet = new Wallet({
  chain: 'main',
  keyDeriver,
  storage: new WalletStorageManager(storage),
  services,
  monitor
})

// Create transaction (action-based model)
const result = await wallet.createAction({
  outputs: [{
    lockingScript: script,
    satoshis: amount,
    outputDescription: 'description'
  }],
  labels: ['label'],
  description: 'action description'
})

// List outputs (UTXOs)
const outputs = await wallet.listOutputs({
  basket: 'default',
  spendable: true
})
```

**Pros:**
- ✅ Native SQLite support (better for VS Code)
- ✅ Comprehensive wallet functionality
- ✅ Well-tested in production environments
- ✅ Multi-user support
- ✅ Advanced features (certificates, baskets, labels)

**Cons:**
- ❌ **MASSIVE scope increase** - full wallet, not just storage
- ❌ Heavy dependencies (Knex, SQLite3, Express, WS)
- ❌ Complex integration requiring understanding of BRC-100 actions model
- ❌ Requires user management even for single user
- ❌ Action-based API doesn't match our current architecture
- ❌ NOT what yours-wallet uses
- ❌ Overkill for our use case

---

## Decision Factors

### Our Requirements
We need:
1. ✅ UTXO tracking for address(es)
2. ✅ Transaction caching
3. ✅ Automatic UTXO state updates after broadcast
4. ✅ Ability to spend change outputs immediately
5. ✅ SPV validation (optional but nice)

### What We Don't Need
wallet-toolbox provides but we don't need:
- ❌ Multi-user management
- ❌ Action/basket/certificate abstractions
- ❌ Label and tag management
- ❌ Commission tracking
- ❌ Multi-storage sync
- ❌ Privileged key management
- ❌ Background monitor daemon
- ❌ Express server components

---

## Recommendation

**Use spv-store with fake-indexeddb**

### Reasoning

1. **Scope Alignment**: spv-store does exactly what we need - UTXO tracking and transaction caching. wallet-toolbox is a full wallet implementation that brings unnecessary complexity.

2. **Proven Solution**: yours-wallet successfully uses spv-store for the exact same purpose. We have a working reference implementation.

3. **Simpler Integration**: spv-store has a clean, simple API. wallet-toolbox requires understanding the BRC-100 action model and restructuring our transaction building.

4. **Lighter Weight**: spv-store has minimal dependencies. wallet-toolbox brings in database ORMs, HTTP servers, and websocket libraries we don't need.

5. **Migration Plan Ready**: We already have a detailed migration plan for spv-store. Using wallet-toolbox would require starting over.

6. **IndexedDB Trade-off Acceptable**: While SQLite would be better, fake-indexeddb provides IndexedDB API in Node.js with file persistence. The trade-off is worth it for the simpler integration.

### Risk Mitigation

The main concern with spv-store is using IndexedDB in Node.js via fake-indexeddb:

**Mitigation strategies:**
- fake-indexeddb is well-maintained (used by many projects)
- Data persists to `~/.bitcoin/.fakeIndexedDB/`
- Can switch storage backend later if issues arise
- spv-store's abstraction makes storage swappable

### Future Options

If IndexedDB persistence becomes problematic:
1. Contribute SQLite backend to spv-store (implement TxoStorage, TxnStorage, BlockStorage interfaces)
2. Switch to wallet-toolbox if we later need full wallet features
3. Create custom file-based storage implementing spv-store interfaces

---

## Conclusion

**Proceed with spv-store + fake-indexeddb migration as planned.**

wallet-toolbox is an excellent library, but it's solving a different problem. It's designed for building custodial wallet services with multi-user support and comprehensive wallet management. We need simple UTXO tracking for a VS Code extension.

The existing SPV_STORE_MIGRATION_PLAN.md remains valid. Proceed with implementation.
