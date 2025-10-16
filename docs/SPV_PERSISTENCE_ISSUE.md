# SPV Store Persistence - FIXED ✅

## Solution Implemented

**Replaced fake-indexeddb with indexeddbshim**

- indexeddbshim uses SQLite3 for persistent file storage
- Database files stored in VS Code's global storage directory
- Persists between restarts just like Yours Wallet!

## Previous Problem (SOLVED)

The SPV store did not persist between VS Code extension restarts because:
- fake-indexeddb was memory-only (designed for testing, not production)
- Yours-wallet works because Chrome provides real IndexedDB with disk persistence
- Our extension needed a Node.js IndexedDB implementation that persists to disk

## Implementation Details

### Storage Location
```
~/.vscode/extensions/opl.bitcoin-x.x.x/globalStorage/opl.bitcoin/
```

Database files:
- `__websql_default_indexedDB_txos-default-mainnet` - UTXO database
- `__websql_default_indexedDB_blocks-mainnet` - Block headers
- `__websql_default_indexedDB_txns-default-mainnet` - Transaction cache

### How It Works

1. **Extension activation** (extension.tsx:213-225):
   - Creates storage directory if it doesn't exist
   - Initializes indexeddbshim with `databaseBasePath` pointing to VS Code storage
   - Sets up SQLite3-backed IndexedDB implementation

2. **SPV Store initialization** (spvService.ts):
   - Creates OneSatWebSPV instance with FundIndexer + InscriptionIndexer
   - Syncs block headers from network
   - Indexes UTXOs and ordinals
   - **All data persists to SQLite files**

3. **On restart**:
   - indexeddbshim loads existing SQLite databases
   - SPV store reads cached block headers and UTXOs
   - Only syncs NEW blocks since last run
   - Balance shows immediately from cache!

## Additional Features Implemented

### 1. Show Cached Balance During Sync ✅
- Immediate balance refresh when sync starts (shows cached data if available)
- Periodic refresh every 5 seconds during sync
- Balance updates in real-time as sync progresses

### 2. Visual Sync Feedback ✅
- Status bar shows: "Syncing blocks: 350,000/870,000 (40%)"
- Green dot pulses during balance fetch
- Users know sync is happening

### 3. InscriptionIndexer Added ✅
- SPV store now tracks ordinals/inscriptions
- Follows yours-wallet pattern with FundIndexer + InscriptionIndexer

## Testing Persistence

1. Load wallet, wait for sync to complete
2. Check SQLite files exist:
   ```bash
   ls ~/.vscode/extensions/opl.bitcoin-*/globalStorage/opl.bitcoin/
   ```
3. Reload VS Code extension (Cmd+R in Extension Development Host)
4. Balance should appear immediately from cache
5. Status bar should show "Syncing blocks" only for NEW blocks

## Migration from fake-indexeddb

If you were using fake-indexeddb previously:
- Old data is lost (it was in-memory only)
- First sync after upgrade will take ~5-10 minutes
- Subsequent restarts will be instant!

---

## Original Investigation (Historical)

### Other Solutions Considered

### Option 1: Use VS Code Extension Storage
```typescript
// Save SPV state on sync complete
await context.globalState.update('spv-cache', {
  lastSyncHeight: height,
  utxos: [...],
  timestamp: Date.now()
});

// Restore on startup
const cached = context.globalState.get('spv-cache');
```

**Pros**: Simple, uses VS Code APIs
**Cons**: Need to serialize/deserialize all SPV data, might be large

### Option 2: File-based IndexedDB Alternative
Replace fake-indexeddb with a persistent storage like:
- better-sqlite3
- level/leveldb
- lokijs with file adapter

**Pros**: True persistence
**Cons**: Requires spv-store to support different storage backends (currently IDB only)

### Option 3: Accept Non-Persistence
Document that sync doesn't persist and optimize sync speed:
- Use faster block header sync
- Cache only essential data in VS Code storage
- Make sync fast enough (~30 seconds) to not be annoying

**Pros**: No code changes needed
**Cons**: User friction on every restart

## Recommended Approach

**Short term**: Option 3 (document limitation)
- Current implementation works fine during a session
- Balance updates in real-time during sync
- Users see progress in status bar

**Long term**: Option 1 (VS Code storage)
- Cache UTXO balances and essential data
- Resume sync from last known block height
- Falls back to full sync if cache invalid

## Implementation Notes

If implementing VS Code storage caching:

```typescript
interface SpvCache {
  accountId: string;
  lastSyncHeight: number;
  lastSyncTimestamp: number;
  utxos: Array<{
    txid: string;
    vout: number;
    satoshis: number;
    script: string;
    owner: string;
  }>;
  ordinals: Array<{
    outpoint: string;
    owner: string;
    // ... inscription data
  }>;
}
```

Save cache:
- On sync complete (100%)
- On extension deactivate
- Periodically during sync (every 10k blocks)

Restore cache:
- On extension activate
- Initialize SPV with cached UTXOs
- Resume sync from lastSyncHeight

## References

- fake-indexeddb: https://github.com/dumbmatter/fakeIndexedDB
- SPV Store: Uses IndexedDB only, no alternative storage backends
- Yours Wallet: Chrome extension with real IndexedDB persistence
