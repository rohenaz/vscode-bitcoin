# UTXO Satoshis Corruption Debug Investigation

## Problem Statement
BAP profile publishing fails with corrupted satoshis value: `222710631843` (~2,227 BSV)
Error: "Number can only safely store up to 53 bits"

## Data Flow
1. GorillaPool API → js-1sat-ord `fetchPayUtxos()` → returns UTXOs
2. TxCache stores UTXOs in `.bitcoin/utxos/{address}.json`
3. TxCache fetches and caches source transactions
4. Transaction building reads UTXOs from cache
5. Transaction building reads source transactions from cache
6. Inputs added with `sourceTransaction` object
7. Decoder extracts `satoshis` from `sourceTransaction.outputs[vout]`

## Investigation Plan

### Phase 1: Verify Raw Data from API
- [ ] Check what GorillaPool actually returns for the UTXO
- [ ] Verify js-1sat-ord fetchPayUtxos returns correct satoshis
- [ ] Log actual UTXO data before caching

### Phase 2: Verify Cache Storage
- [ ] Check `.bitcoin/utxos/{address}.json` file contents
- [ ] Verify satoshis values are correct in cache
- [ ] Check if corruption happens during JSON serialization

### Phase 3: Verify Source Transaction Cache
- [ ] Check cached source transaction in `.bitcoin/transactions/main/{txid}.json`
- [ ] Verify the output at the correct vout has correct satoshis
- [ ] Check if Transaction.fromHex() corrupts the data

### Phase 4: Verify Transaction Building
- [ ] Log sourceTx.outputs[vout].satoshis when adding inputs
- [ ] Check type of satoshis (number vs BigInt)
- [ ] Verify no corruption during input addition

### Phase 5: Verify Decoder
- [ ] Check sourceOutput.satoshis type in decoder
- [ ] Verify extraction logic is correct

## Test Case
- Address: (to be filled)
- UTXO txid: `18bd33e6a12890cc1cfeb1a1a6053166f52f4819e4d54099aee8c2dcbbc35b46`
- UTXO vout: 1
- Expected satoshis: (to be determined)
- Actual corrupted value: `222710631843`

## Findings

### Root Cause Found!
**Location**: `src/views/bitcoinTools/index.tsx:2434`

**Problem**:
```typescript
satoshis: tx.outputs[changeOutputIdx].satoshis as number,
```

The `as number` is a TypeScript type cast that does NOT convert BigInt to number at runtime.
If `tx.outputs[changeOutputIdx].satoshis` returns a BigInt, it stays as BigInt.

**Evidence from logs**:
```
[BitcoinTools] UTXO cache updated: spent 1, change: 57013921750686 sats
```
57 trillion satoshis = corrupted BigInt serialization

**Why this happens**:
1. BSV SDK Transaction outputs may return `satoshis` as BigInt
2. TypeScript `as number` cast doesn't convert at runtime
3. BigInt gets serialized to JSON incorrectly
4. When deserialized, becomes corrupted huge number
5. Later operations fail with "Number can only safely store up to 53 bits"

## Resolution

### The Full Story
1. BSV SDK `tx.fee()` sets `output.satoshis` as BigInt (not number)
2. When we use `Number(bigIntValue)` where bigIntValue exceeds safe integer range, JavaScript corrupts it
3. Corrupted BigInt (57013921750686) gets saved to UTXO cache
4. Next transaction tries to spend corrupted UTXO
5. Fails immediately with "Number can only safely store up to 53 bits"

### Immediate Fix
Delete corrupted cache: `rm ~/.bitcoin/utxos/*.json`

### Proper Fix Needed
Must convert BigInt safely:
```typescript
const satoshis = typeof value === 'bigint' ? Number(value) : value;
```

But this still doesn't solve WHY the BigInt is so large in the first place. Need to investigate BSV SDK behavior.
