# Send BSV Feature - Implementation Guide

## Overview

This document describes the implementation of the "Send BSV" feature in the VS Code Bitcoin extension. The feature allows users to send Bitcoin SV (BSV) from their funding key to any P2PKH address.

## Architecture

### File Structure

```
src/
├── services/
│   ├── transactionService.ts     # Transaction building & broadcasting
│   ├── ordinalsService.ts        # UTXO fetching (existing)
│   └── walletState.ts            # Wallet state management (existing)
├── views/
│   └── bitcoinTools/
│       ├── index.tsx             # Message handler integration
│       └── webview/
│           └── src/
│               └── components/
│                   ├── WalletTab.tsx        # Main wallet UI (updated)
│                   └── SendBsvDialog.tsx    # Send dialog component
```

## Components

### 1. Transaction Service (`transactionService.ts`)

**Responsibilities:**
- Build BSV transactions using @bsv/sdk
- Select UTXOs (coin selection)
- Calculate transaction fees
- Sign transactions with WIF
- Broadcast to BSV network

**Key Functions:**

#### `buildSendBsvTransaction(params: SendBsvParams): SendBsvResult`

Builds and signs a complete transaction:
- Validates recipient address (P2PKH format)
- Selects UTXOs using largest-first strategy
- Excludes 1-sat UTXOs (potential ordinals)
- Estimates fees based on transaction size
- Creates change output if needed
- Signs transaction with private key

**Fee Estimation:**
```typescript
// Formula: (numInputs * 148 + numOutputs * 34 + 10) bytes * satsPerKb / 1000
// Default: 50 sat/kb
```

**UTXO Selection:**
- Filters out 1-sat UTXOs (protects ordinals)
- Sorts by value descending (largest first)
- Adds UTXOs until target + fee is met
- Throws error if insufficient funds

#### `broadcastTransaction(rawTx: string): Promise<BroadcastResult>`

Broadcasts transaction with fallback strategy:
1. **Primary**: WhatsOnChain API
2. **Fallback**: GorillaPool ARC

**WhatsOnChain Broadcasting:**
```typescript
POST https://api.whatsonchain.com/v1/bsv/main/tx/raw
Body: { "txhex": "..." }
```

**ARC Broadcasting:**
```typescript
// Uses @bsv/sdk ARC class
const arc = new ARC('https://arc.gorillapool.io', { apiKey: '...' })
await arc.broadcast(rawTx)
```

### 2. Send BSV Dialog (`SendBsvDialog.tsx`)

**States:**
1. **idle** - Input form (recipient + amount)
2. **confirming** - Review transaction details
3. **broadcasting** - Transaction being broadcast
4. **success** - Transaction confirmed
5. **error** - Transaction failed

**Features:**
- BSV/sats toggle with automatic conversion
- "Max" button (reserves 500 sats for fee)
- Real-time validation (address format, amount)
- Self-address detection
- Fee estimation preview
- Transaction confirmation step
- Success/error feedback
- Link to WhatsOnChain explorer

**Validation:**
- Address: Must be valid P2PKH mainnet address (`^1[a-km-zA-HJ-NP-Z1-9]{25,34}$`)
- Amount: Must be > 0 and ≤ spendable balance
- Prevents sending to own address

### 3. Message Flow

```
WebView (React)          Extension (Node)
─────────────────        ────────────────

1. User clicks "Send BSV"
   └─> Opens SendBsvDialog

2. User enters recipient & amount
   └─> wallet:sendBsv:estimate
                              ├─> Get funding key from vault
                              ├─> Fetch UTXOs
                              ├─> Build transaction
                              └─> Calculate fee
   <─┘ wallet:sendBsv:estimate
       { success, fee, changeAmount }

3. User reviews & confirms
   └─> wallet:sendBsv:send
                              ├─> Get funding key from vault
                              ├─> Fetch fresh UTXOs
                              ├─> Build transaction
                              ├─> Sign transaction
                              ├─> Broadcast to network
                              └─> Wait for confirmation
   <─┘ wallet:sendBsv:result
       { success, txid, fee }

4. User sees success/error
   └─> wallet:refreshBalance (on close)
```

## Error Handling

### Transaction Errors

```typescript
class TransactionError extends Error {
  code: string
}
```

**Error Codes:**
- `INVALID_ADDRESS` - Recipient address invalid
- `INVALID_AMOUNT` - Amount ≤ 0
- `INVALID_WIF` - Cannot decode WIF key
- `NO_UTXOS` - No spendable UTXOs available
- `INSUFFICIENT_FUNDS` - Balance too low for amount + fee
- `SIGNING_FAILED` - Transaction signing failed
- `TX_FETCH_FAILED` - Cannot fetch transaction from network

### Broadcast Errors

- Network errors (timeout, connection)
- Invalid transaction (rejected by node)
- Double-spend detected
- Mempool full

### UI Error Handling

All errors are displayed in the dialog with:
- Clear error messages
- Red alert box
- Option to retry or close
- Error logged to console

## Security Considerations

### Key Management
- WIF keys never leave extension host
- Keys retrieved from encrypted vault on-demand
- No keys stored in webview state
- Vault auto-locks after inactivity

### Transaction Safety
- Validates all inputs before building
- Shows confirmation step with full details
- Prevents accidental self-sends
- Protects 1-sat ordinals from spending
- Fresh UTXO fetch before broadcast

### Network Security
- Uses HTTPS for all API calls
- Multiple broadcast endpoints (redundancy)
- Validates broadcast responses
- No credential storage

## Testing Strategy

### Unit Tests (Recommended)

```typescript
// transactionService.test.ts
describe('TransactionService', () => {
  it('should build valid transaction', () => {
    const result = transactionService.buildSendBsvTransaction({
      recipientAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      satoshis: 10000,
      wif: 'L5EYT...',
      utxos: mockUtxos,
      changeAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
    })
    expect(result.tx).toBeDefined()
    expect(result.fee).toBeGreaterThan(0)
  })

  it('should throw on insufficient funds', () => {
    expect(() => {
      transactionService.buildSendBsvTransaction({
        satoshis: 1000000,
        utxos: [{ satoshis: 1000 }] // Not enough
      })
    }).toThrow('INSUFFICIENT_FUNDS')
  })

  it('should exclude 1-sat ordinals', () => {
    const utxos = [
      { satoshis: 1 },    // Ordinal
      { satoshis: 10000 } // Spendable
    ]
    const result = transactionService.buildSendBsvTransaction({
      satoshis: 5000,
      utxos
    })
    expect(result.tx.inputs.length).toBe(1)
  })
})
```

### Integration Tests

1. **Fee Estimation**
   - Test with different UTXO sets
   - Verify fee accuracy

2. **Broadcasting**
   - Test with small amounts on mainnet
   - Verify transaction appears on-chain
   - Test error handling (invalid tx)

3. **UI Flow**
   - Test form validation
   - Test state transitions
   - Test error displays

## Configuration

### Fee Rate
Default: 50 sat/kb (adjustable in `buildSendBsvTransaction`)

```typescript
transactionService.buildSendBsvTransaction({
  // ...
  satsPerKb: 100 // Custom fee rate
})
```

### Broadcast Endpoints

Update in `transactionService.ts`:

```typescript
async broadcastTransaction(rawTx: string) {
  const broadcasters = [
    () => this.broadcastToWhatsOnChain(rawTx),
    () => this.broadcastToArc(rawTx),
    // Add more here
  ]
}
```

## Usage

### For Users

1. Open Bitcoin Tools sidebar
2. Navigate to Wallet tab
3. Ensure funding key is selected and vault unlocked
4. Click "Send BSV" button
5. Enter recipient address and amount
6. Click "Review"
7. Verify transaction details
8. Click "Confirm & Send"
9. Wait for broadcast confirmation
10. View transaction on WhatsOnChain

### For Developers

**Build a transaction:**

```typescript
import { transactionService } from './services/transactionService'

const result = transactionService.buildSendBsvTransaction({
  recipientAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  satoshis: 10000,
  wif: privateKeyWif,
  utxos: paymentUtxos,
  changeAddress: myAddress,
  satsPerKb: 50 // optional
})

console.log('Transaction ID:', result.txid)
console.log('Fee:', result.fee, 'sats')
console.log('Change:', result.changeAmount, 'sats')
```

**Broadcast a transaction:**

```typescript
const rawTx = result.tx.toHex()
const broadcast = await transactionService.broadcastTransaction(rawTx)

if (broadcast.status === 'success') {
  console.log('TXID:', broadcast.txid)
} else {
  console.error('Failed:', broadcast.message)
}
```

## Future Enhancements

### Potential Features

1. **Custom Fees**
   - Allow user to set custom fee rate
   - Show fee priority (low/normal/high)

2. **Address Book**
   - Save frequently used addresses
   - Label addresses for easy selection

3. **Transaction History**
   - Show past transactions
   - Filter by date/amount
   - Export to CSV

4. **Multi-Recipient**
   - Send to multiple addresses in one transaction
   - Batch payments for efficiency

5. **OP_RETURN Data**
   - Add custom data to transactions
   - Support for protocols (MAP, etc.)

6. **UTXO Selection**
   - Advanced coin control
   - Manual UTXO selection
   - Privacy-focused selection strategies

7. **Fee Estimation**
   - Dynamic fee estimation from mempool
   - Multiple fee tiers

8. **Transaction Templates**
   - Save common transaction patterns
   - One-click sends

## Troubleshooting

### Common Issues

**"No UTXOs available"**
- Vault may be locked
- Funding key has no balance
- Network error fetching UTXOs
- **Fix**: Unlock vault, fund address, check network

**"Insufficient funds"**
- Amount + fee exceeds balance
- Only 1-sat ordinals available
- **Fix**: Reduce amount or add more funds

**"Invalid Bitcoin address"**
- Address not P2PKH format
- Wrong network (testnet vs mainnet)
- **Fix**: Verify address format

**"Broadcast failed"**
- Network connectivity issues
- Transaction rejected by node
- Double-spend detected
- **Fix**: Check network, verify UTXOs not spent

**"Transaction failed: signing error"**
- Wrong WIF for UTXOs
- Corrupted transaction
- **Fix**: Verify funding key is correct

## API Reference

### TransactionService

```typescript
interface SendBsvParams {
  recipientAddress: string
  satoshis: number
  wif: string
  utxos: Utxo[]
  changeAddress: string
  satsPerKb?: number
}

interface SendBsvResult {
  tx: Transaction
  txid: string
  fee: number
  changeAmount: number
  inputAmount: number
}

interface BroadcastResult {
  status: 'success' | 'error'
  txid?: string
  message?: string
}
```

### Message Protocol

**Estimate Request:**
```typescript
{
  type: 'wallet:sendBsv:estimate',
  data: {
    recipientAddress: string
    satoshis: number
  }
}
```

**Estimate Response:**
```typescript
{
  type: 'wallet:sendBsv:estimate',
  data: {
    success: boolean
    fee?: number
    changeAmount?: number
    inputAmount?: number
    error?: string
  }
}
```

**Send Request:**
```typescript
{
  type: 'wallet:sendBsv:send',
  data: {
    recipientAddress: string
    satoshis: number
  }
}
```

**Send Response:**
```typescript
{
  type: 'wallet:sendBsv:result',
  data: {
    success: boolean
    txid?: string
    fee?: number
    message?: string
    error?: string
  }
}
```

## Resources

- **@bsv/sdk Documentation**: https://docs.bsvblockchain.org/
- **WhatsOnChain API**: https://developers.whatsonchain.com/
- **1Sat Ordinals**: https://1satordinals.com
- **Bitcoin SV Wiki**: https://wiki.bitcoinsv.io/

## License

Same as parent project (MIT)
