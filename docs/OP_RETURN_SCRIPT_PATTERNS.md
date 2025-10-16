# OP_RETURN Script Assembly Patterns

## Overview
This document describes the correct patterns for building OP_RETURN scripts with the BSV SDK (@bsv/sdk) based on examples from the codebase.

## Correct Pattern (BSV SDK)

### Multi-Pushdata OP_RETURN Script

```typescript
import { Script, Utils } from '@bsv/sdk';
const { toHex } = Utils;

// Input: Array of number arrays (number[][])
// Each number[] represents a data chunk that should become a separate pushdata
const signedOpReturn: number[][] = [
  [0x31, 0x42, 0x41, 0x50...],  // "1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT"
  [0x41, 0x4c, 0x49, 0x41, 0x53], // "ALIAS"
  [0x47, 0x6f...],                 // Identity key
  [0x7b, 0x22...],                 // JSON data
  // ... AIP signature fields
];

// Build script using ASM format
// Each chunk is converted to hex and joined with spaces
const script = Script.fromASM(
  `OP_0 OP_RETURN ${signedOpReturn.map((chunk) => toHex(chunk)).join(' ')}`
);

// Use in transaction output
tx.addOutput({
  satoshis: 0,
  lockingScript: script
});
```

### Key Points

1. **Use `Utils.toHex()`**: The BSV SDK's `Utils.toHex()` function properly converts `number[]` to hex string
2. **Join with space**: `.join(' ')` creates space-separated hex values
3. **OP_0 OP_RETURN prefix**: `OP_0` (alias for `OP_FALSE`) followed by `OP_RETURN`
4. **Each chunk becomes separate pushdata**: The Script.fromASM parser interprets each space-separated hex value as a separate pushdata operation

## Result

The resulting script will have the structure:
```
OP_0
OP_RETURN
OP_PUSH <data1>
OP_PUSH <data2>
OP_PUSH <data3>
...
```

Each field (protocol prefix, "ALIAS", identity key, JSON, signature) is visible as plaintext in transaction decoders.

## Examples from Codebase

### sigmaidentity (src/services/blockchain.ts)
```typescript
export const buildBaseTx = (script: number[][]) => {
  const s = Script.fromASM(
    `OP_0 OP_RETURN ${script.map((n) => toHex(n)).join(" ")}`
  );

  const transaction = new Transaction();
  transaction.addOutput({
    lockingScript: s,
    satoshis: 0,
    change: false,
  } as TransactionOutput);

  return { script: s, txHex: transaction.toHex() };
};
```

### bmap (src/utils/signatureVerification.ts)
```typescript
const dataArrays = signatureBufferStatements.map(b => toArray(b));
const script = Script.fromASM(`OP_FALSE OP_RETURN ${dataArrays.join("")}`);
```

## Common Mistakes

### ❌ Wrong: Manual Buffer Concatenation
```typescript
// DON'T DO THIS - creates single blob
let scriptChunks: Buffer[] = [Buffer.from([0x6a])];
for (const chunk of signedOpReturn) {
  const buf = Buffer.from(chunk);
  scriptChunks.push(Buffer.from([buf.length]));
  scriptChunks.push(buf);
}
const script = Script.fromBinary(Buffer.concat(scriptChunks));
```

### ❌ Wrong: Using Buffer.from().toString('hex')
```typescript
// DON'T DO THIS - may not handle encoding correctly
const asmParts = ['OP_RETURN'];
for (const chunk of signedOpReturn) {
  const buf = Buffer.from(chunk);
  asmParts.push(buf.toString('hex')); // Should use Utils.toHex()
}
```

### ✅ Correct: Use Utils.toHex()
```typescript
import { Utils } from '@bsv/sdk';

const script = Script.fromASM(
  `OP_0 OP_RETURN ${signedOpReturn.map((chunk) => Utils.toHex(chunk)).join(' ')}`
);
```

## Testing

To verify the script is correctly formatted:
1. Build the transaction and export as hex
2. Load into transaction decoder
3. Check ASM view - should show separate pushdatas, not one large hex blob
4. Plaintext fields like "ALIAS" should be visible

## References

- BSV SDK Script: https://github.com/bitcoin-sv/ts-sdk
- sigmaidentity: /Users/satchmo/code/sigmaidentity/src/services/blockchain.ts
- bmap: /Users/satchmo/code/bmap/src/utils/signatureVerification.ts
- BAP Library: /Users/satchmo/code/bsv-bap/src/index.ts
