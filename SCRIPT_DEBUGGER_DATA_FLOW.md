# Script Debugger & Transaction Decoder Data Flow Analysis

## Starting Point: Raw TX Hex in Bitcoin Tools Sidebar

**Location**: Bitcoin Tools webview sidebar
**Action**: User pastes raw transaction hex and clicks "Decode"
**Data**: Raw transaction hex string

---

## Data Flow Path 1: Transaction Decoder Opening

### 1. Bitcoin Tools → Backend Command
**Frontend**: `src/views/webview/src/components/TransactionsTab.tsx`
```typescript
vscode.postMessage({
  type: 'openTransactionDecoder',
  data: { rawTxHex }
})
```

### 2. Backend Creates Transaction Decoder Panel
**Backend**: `src/extension.tsx` or bitcoin tools handler
- Creates `TransactionDecoderPanel`
- Passes `rawTxHex` to panel

### 3. Transaction Decoder Panel Initialization
**Backend**: `src/views/transactionDecoder/index.tsx`
- Constructor stores `rawTxHex` in `_pendingRawTxHex` (line 25)
- Sets up message handler (line 30-34)
- Generates HTML with `PANEL_TYPE = 'transaction-decoder'` (line 847)

### 4. Frontend Webview Loads
**Frontend**: `src/views/webview/src/panels/TransactionDecoderPanel.tsx`
- Component mounts
- useEffect runs (line 16)
- Sends `webview:ready` message (line 41)

### 5. Backend Receives Ready Signal
**Backend**: `src/views/transactionDecoder/index.tsx`
```typescript
if (message.type === 'webview:ready') {  // line 53
  if (this._pendingRawTxHex) {
    this._panel.webview.postMessage({
      type: 'transaction:populate',
      data: { rawTxHex: this._pendingRawTxHex }
    })
  }
}
```

### 6. Frontend Receives Transaction Data
**Frontend**: `src/views/webview/src/panels/TransactionDecoderPanel.tsx`
```typescript
if (message.type === 'transaction:populate' && message.data?.rawTxHex) {  // line 49
  setRawTxHex(message.data.rawTxHex)
  shouldAutoDecode.current = true
}
```

---

## Data Flow Path 2: Decoding Transaction in Transaction Decoder

### 1. Frontend Triggers Decode
**Frontend**: `src/views/webview/src/components/DecodeTransaction/index.tsx`
- User clicks decode or auto-decode triggers
```typescript
vscode.postMessage({
  type: 'transaction:decode',
  data: { rawTx: rawTxHex }
})
```

### 2. Backend Decodes Transaction
**Backend**: `src/views/transactionDecoder/index.tsx` (line 91)
```typescript
if (message.type === 'transaction:decode') {
  const tx = Transaction.fromHex(rawTx)
  const decodedTx = {
    version, lockTime, txid, size,
    inputs: [...],  // with sourceTXID, sourceOutputIndex, unlockingScript, sequence
    outputs: [...]  // with satoshis, lockingScript
  }
}
```

### 3. Backend Resolves Input Sources
**Backend**: `src/views/transactionDecoder/index.tsx`
- Fetches source transactions from WhatOnChain
- Resolves locking scripts for each input
- Sends resolved data back

### 4. Frontend Displays Decoded Transaction
**Frontend**: Receives `transaction:decoded` message
**Frontend**: Receives `inputsResolved` message with source transaction data

---

## Data Flow Path 3: Execute Script Button (THE BROKEN FLOW)

### 1. User Clicks "Execute Script (Step-by-Step)" on an Input
**Frontend**: `src/views/webview/src/components/DecodeTransaction/TransactionInputs.tsx` (line 44)
```typescript
vscode.postMessage({
  type: 'transaction:executeScript',
  data: {
    inputIndex: input.index,
    unlockingScript: input.unlockingScript,
    sourceTXID: input.sourceTXID,
    sourceOutputIndex: input.sourceOutputIndex,
    spendingTxInputs: inputs,  // ALL inputs from spending tx
    spendingTxOutputs: outputs,  // ALL outputs from spending tx
    transactionVersion,
    transactionLockTime
  }
})
```

### 2. Transaction Decoder Backend Receives Message
**Backend**: `src/views/transactionDecoder/index.tsx` (line 258)
```typescript
if (message.type === 'transaction:executeScript') {
  // Extract data
  const { sourceTXID, sourceOutputIndex, unlockingScript, inputIndex,
          spendingTxInputs, spendingTxOutputs, transactionVersion, transactionLockTime } = message.data

  // Fetch source transaction from WhatOnChain
  const sourceRawTx = await fetch(`/tx/${sourceTXID}/hex`)
  const sourceTx = Transaction.fromHex(sourceRawTx)
  const sourceOutput = sourceTx.outputs[sourceOutputIndex]
  const lockingScriptHex = sourceOutput.lockingScript.toHex()

  // Build otherInputs (line 341-347)
  const otherInputs = spendingTxInputs
    .filter((_, i) => i !== inputIndex)
    .map(input => ({
      sourceTXID: input.sourceTXID,
      sourceOutputIndex: input.sourceOutputIndex,
      sequence: input.sequence
    }))

  // Build outputs (line 350-353)
  const outputs = spendingTxOutputs.map(output => ({
    satoshis: output.satoshis,
    lockingScript: output.lockingScript
  }))

  // Build complete spendParams (line 358-370)
  const spendParams = {
    sourceTXID,
    sourceOutputIndex,
    sourceSatoshis: sourceOutput.satoshis || 1000,
    lockingScript: lockingScriptHex,
    transactionVersion,
    otherInputs,
    outputs,
    unlockingScript,
    inputSequence,
    inputIndex,
    lockTime: transactionLockTime,
  }

  // Call command (line 381)
  vscode.commands.executeCommand('bitcoin.openScriptDebugger', spendParams)
}
```

### 3. Extension Command Handler
**Backend**: `src/extension.tsx` (line 356-363)
```typescript
const openScriptDebuggerCommand = vsApi.commands.registerCommand(
  'bitcoin.openScriptDebugger',
  async (spendParams?: any) => {
    console.log('[Extension] openScriptDebugger command called with spendParams:', !!spendParams);
    ScriptDebuggerPanel.show(context.extensionUri, spendParams);
  }
);
```

### 4. Script Debugger Panel Show Method
**Backend**: `src/views/scriptDebugger/index.tsx` (line 27)
```typescript
public static show(extensionUri: vscode.Uri, spendParams?: any) {
  if (ScriptDebuggerPanel.currentPanel) {
    // Reuse existing panel
    ScriptDebuggerPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
    if (spendParams) {
      ScriptDebuggerPanel.currentPanel._panel.webview.postMessage({
        type: 'script:populate',
        data: { spendParams }
      })
    }
    return
  }

  // Create NEW panel (line 44)
  const panel = vscode.window.createWebviewPanel(
    'bitcoinScriptDebugger',
    'Script Execution Visualizer',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true, ... }
  )

  ScriptDebuggerPanel.currentPanel = new ScriptDebuggerPanel(panel, extensionUri)

  if (spendParams) {
    // Wait 100ms then send (line 60-68)
    setTimeout(() => {
      const result = ScriptDebuggerPanel.currentPanel?._panel.webview.postMessage({
        type: 'script:populate',
        data: { spendParams }
      })
      console.log('[ScriptDebuggerPanel.show] postMessage returned:', result)
    }, 100)
  }
}
```

### 5. Script Debugger Frontend Webview Loads
**Frontend**: `src/views/webview/src/panels/ScriptDebuggerPanel.tsx`
```typescript
// HTML generated with PANEL_TYPE = 'script-executor' (line 508 of backend)
// App.tsx routes 'script-executor' to ScriptDebuggerPanel component

export function ScriptDebuggerPanel() {
  const [spendParams, setSpendParams] = useState<SpendParams | null>(null)
  const [initialUnlockingScript, setInitialUnlockingScript] = useState<string>('')

  useEffect(() => {
    // Set up message listener
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'script:populate' && message.data?.spendParams) {
        if (!message.data.spendParams.lockingScript) {
          setInitialUnlockingScript(message.data.spendParams.unlockingScript)
        } else {
          setSpendParams(message.data.spendParams)  // THIS SHOULD TRIGGER
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Render logic (line 54-80)
  return (
    <div>
      {!spendParams ? (
        <ScriptDebuggerInput onExecute={handleExecute} />  // THIS IS SHOWING
      ) : (
        <ScriptDebugger spendParams={spendParams} />  // THIS SHOULD SHOW
      )}
    </div>
  )
}
```

### 6. THE PROBLEM
**Backend logs show**: postMessage IS being called and returns Promise
**Frontend logs show**: Message listener IS added
**Frontend logs show**: NO MESSAGE RECEIVED

The `script:populate` message is being sent but NOT arriving at the frontend.

---

## Data Flow Path 4: TXID Form in Script Debugger (WORKING PATH)

### 1. User Opens Script Debugger Directly
Command: `bitcoin.openScriptDebugger` (no params)
Opens with empty form showing `ScriptDebuggerInput`

### 2. User Enters TXID and Clicks Load
**Frontend**: `src/views/webview/src/components/ScriptDebuggerInput.tsx` (line 48)
```typescript
vscode.postMessage({
  type: 'transaction:loadByTxid',
  data: { txid: txid.trim(), network: 'main' }
})
```

### 3. Backend Handles Load Request
**Backend**: `src/views/scriptDebugger/index.tsx` (line 84-87)
```typescript
if (type === 'transaction:loadByTxid') {
  await this.handleLoadByTxid(data.txid, data.network)
}
```

### 4. Backend Fetches and Decodes Transaction
**Backend**: `handleLoadByTxid()` (line 291) → `handleDecodeTransaction()` (line 323)
- Fetches raw tx from WhatOnChain
- Decodes transaction
- Sends `transaction:decoded` message

### 5. Frontend Receives Decoded Transaction
**Frontend**: `ScriptDebuggerInput.tsx` (line 26-28)
```typescript
if (message.type === 'transaction:decoded') {
  setTransaction(message.data)  // Shows input selection UI
}
```

### 6. User Selects Input to Debug
**Frontend**: `ScriptDebuggerInput.tsx` (line 61-73)
```typescript
vscode.postMessage({
  type: 'transaction:executeScript',
  data: {
    inputIndex,
    unlockingScript,
    sourceTXID,
    sourceOutputIndex,
    spendingTxInputs: transaction.inputs,
    spendingTxOutputs: transaction.outputs,
    transactionVersion,
    transactionLockTime
  }
})
```

### 7. Backend Handles Execute Request
**Backend**: `src/views/scriptDebugger/index.tsx` (line 77-80)
```typescript
if (type === 'transaction:executeScript') {
  await this.executeInputFromTx(data)
}
```

### 8. Backend Builds spendParams and Sends
**Backend**: `executeInputFromTx()` (line 375-451)
- Fetches source transaction
- Builds otherInputs and outputs (SAME AS TRANSACTION DECODER DOES)
- Creates spendParams
- Sends `script:populate` message (line 443-446)

### 9. Frontend Receives and Displays
**Frontend**: ScriptDebuggerPanel receives `script:populate` and displays ScriptDebugger

**NOTE**: This path WORKS because the panel is ALREADY LOADED and frontend IS LISTENING when the message is sent.

---

## ALL MESSAGE TYPES USED

### Transaction Decoder Messages

#### Frontend → Backend:
- `webview:ready` - Frontend signals it's ready to receive data
- `transaction:decode` - Request to decode raw transaction hex
- `transaction:loadByTxid` - Request to fetch and decode tx by TXID
- `transaction:executeScript` - Request to execute script for an input
- `openExternal` - Request to open external URL
- `whatsonchain:fetchTransactionHex` - Fetch raw tx hex
- `whatsonchain:fetchTransactionDetails` - Fetch tx details
- `whatsonchain:checkTransactionExists` - Check if tx exists
- `whatsonchain:resolveInputs` - Resolve input sources
- `whatsonchain:broadcastTransaction` - Broadcast transaction

#### Backend → Frontend:
- `transaction:populate` - Send raw tx hex to decode
- `transaction:decoded` - Send decoded transaction data
- `inputsResolved` - Send resolved input source data

### Script Debugger Messages

#### Frontend → Backend:
- `transaction:loadByTxid` - Load transaction by TXID
- `transaction:decode` - Decode raw transaction
- `transaction:executeScript` - Execute script for an input
- `scriptDebugger:init` - Initialize debugger instance
- `scriptDebugger:stepForward` - Step forward one opcode
- `scriptDebugger:stepBackward` - Step backward one opcode
- `scriptDebugger:runToEnd` - Run to completion
- `scriptDebugger:reset` - Reset execution
- `scriptDebugger:toggleBreakpoint` - Toggle breakpoint
- `scriptDebugger:destroy` - Destroy debugger instance

#### Backend → Frontend:
- `script:populate` - Send spendParams to load script context
- `transaction:decoded` - Send decoded transaction (from TXID load)
- `transaction:decode:error` - Transaction decode error
- `scriptDebugger:initialized` - Debugger instance created
- `scriptDebugger:step` - Step execution result
- `scriptDebugger:history` - Execution history update
- `scriptDebugger:runComplete` - Run to end complete
- `scriptDebugger:reset` - Reset confirmation
- `scriptDebugger:breakpointToggled` - Breakpoint toggle result
- `scriptDebugger:error` - Execution error

---

## KEY INTERFACES

### SpendParams
```typescript
interface SpendParams {
  sourceTXID: string
  sourceOutputIndex: number
  sourceSatoshis: number
  lockingScript: string  // Hex
  transactionVersion: number
  otherInputs: Array<{
    sourceTXID: string
    sourceOutputIndex: number
    sequence: number
  }>
  outputs: Array<{
    satoshis: number
    lockingScript: string  // Hex
  }>
  unlockingScript: string  // Hex
  inputSequence: number
  inputIndex: number
  lockTime: number
  memoryLimit?: number
}
```

---

## THE ACTUAL PROBLEM - ARCHITECTURE CHANGED

### How It Worked in df92c28 (WORKING VERSION):

**Transaction Decoder handled everything:**
```typescript
// Frontend sent minimal data:
{
  sourceTXID,
  sourceOutputIndex,
  unlockingScript
}

// Transaction Decoder backend:
1. Received transaction:executeScript message
2. Fetched source transaction
3. Built simple spendParams with EMPTY otherInputs and outputs:
   {
     sourceTXID,
     sourceOutputIndex,
     sourceSatoshis,
     lockingScript,
     transactionVersion: 1,
     otherInputs: [],     // EMPTY
     outputs: [],          // EMPTY
     unlockingScript,
     inputSequence: 0xffffffff,
     inputIndex: 0,
     lockTime: 0
   }
4. Called: vscode.commands.executeCommand('bitcoin.openScriptExecutor', spendParams)
```

**Script Executor backend ONLY handled:**
- `scriptExecutor:*` messages (init, step, reset, etc.)
- Did NOT handle `transaction:executeScript` at all
- setTimeout(100ms) worked fine because data was simple

### What Changed (CURRENT BROKEN VERSION):

**Frontend now sends FULL context:**
```typescript
{
  inputIndex,
  unlockingScript,
  sourceTXID,
  sourceOutputIndex,
  spendingTxInputs,        // NEW - all inputs from spending tx
  spendingTxOutputs,       // NEW - all outputs from spending tx
  transactionVersion,      // NEW
  transactionLockTime      // NEW
}
```

**BOTH backends try to handle transaction:executeScript:**

1. **Transaction Decoder backend** (line 258-382):
   - Receives `transaction:executeScript`
   - Fetches source transaction
   - Builds FULL spendParams with otherInputs and outputs arrays
   - Calls `bitcoin.openScriptDebugger` command with spendParams
   - Command opens panel and uses setTimeout(100ms)

2. **Script Debugger backend** (line 77-80):
   - ALSO has handler for `transaction:executeScript`
   - Has `executeInputFromTx()` method (line 375-451)
   - This code is UNREACHABLE from Transaction Decoder flow!
   - Only works when called from ScriptDebuggerInput TXID form

**The Conflict:**
- Message goes to Transaction Decoder backend first (active panel)
- Transaction Decoder handles it and calls openScriptDebugger command
- Script Debugger opens but its `transaction:executeScript` handler never runs
- Script Debugger backend has duplicate logic that's never used in this flow

---

## DUPLICATE CODE PATHS

Transaction Decoder backend (line 258-382) and Script Debugger backend (line 375-451) have IDENTICAL logic for:
- Fetching source transaction by TXID
- Extracting locking script from source output
- Building otherInputs array (filtering out current input)
- Building outputs array
- Creating spendParams object

**This duplication happened because:**
1. Someone added TXID loading feature to Script Debugger
2. Added `executeInputFromTx()` method to handle it
3. But didn't remove the duplicate logic from Transaction Decoder
4. Transaction Decoder still does all the work itself instead of delegating

**The Real Issue:**
The setTimeout(100ms) pattern worked before with simple data. But now both paths exist and Transaction Decoder is doing work that should be delegated to Script Debugger. The message passing architecture is confused - who owns the `transaction:executeScript` message?

**OLD WORKING FLOW:**
TransactionDecoder frontend → TransactionDecoder backend → builds simple params → opens ScriptExecutor → setTimeout works

**NEW BROKEN FLOW:**
TransactionDecoder frontend → TransactionDecoder backend → builds complex params → opens ScriptDebugger → setTimeout fails
                                                                                     ↓
                                            ScriptDebugger backend has UNREACHABLE transaction:executeScript handler

**ALTERNATIVE WORKING FLOW (TXID form):**
ScriptDebuggerInput → ScriptDebugger backend → executeInputFromTx() → sends script:populate → works (no timeout race)

---

## SOLUTION OPTIONS

### Option 1: Revert to Simple Flow (How it Worked Before)
**Transaction Decoder sends minimal data, builds simple params:**
- Frontend sends only: `sourceTXID`, `sourceOutputIndex`, `unlockingScript`
- Transaction Decoder backend builds simple spendParams with empty arrays
- Opens Script Debugger with setTimeout (worked before)
- **DOWNSIDE**: Loses otherInputs and outputs context needed for complex scripts

### Option 2: Delegate to Script Debugger (Eliminate Duplication)
**Transaction Decoder forwards message to Script Debugger:**
- Opens Script Debugger panel without params
- Forwards `transaction:executeScript` message to Script Debugger backend
- Script Debugger backend handles everything in `executeInputFromTx()`
- **DOWNSIDE**: Need inter-panel message forwarding mechanism

### Option 3: Fix the Timing Issue
**Keep current architecture but fix message delivery:**
- Transaction Decoder builds full spendParams (current behavior)
- Opens Script Debugger panel
- Use proper ready/ack pattern instead of setTimeout
- **DOWNSIDE**: Adds complexity with handshake protocol

### Option 4: Use Existing Ready Pattern (Like Transaction Decoder)
**Script Debugger adopts the webview:ready pattern:**
- Store pendingSpendParams when panel created
- Frontend sends `webview:ready` on mount
- Backend sends `script:populate` when ready signal received
- **DOWNSIDE**: Script Debugger doesn't currently send webview:ready

---

## THE ACTUAL ROOT CAUSE - NEW TXID FEATURE BROKE EVERYTHING

### What Changed (UNCOMMITTED):

**Old ScriptExecutorInput (committed in HEAD):**
```typescript
// NO useEffect
// NO message listener
// Just a simple form with Simple/Advanced tabs
// Users manually enter locking/unlocking scripts
// Calls onExecute(params) callback directly

export function ScriptExecutorInput({ onExecute, initialUnlockingScript = '' }) {
  const [unlockingScript, setUnlockingScript] = useState(initialUnlockingScript)
  const [lockingScript, setLockingScript] = useState('')

  const handleSimpleExecute = () => {
    const params: SpendParams = { /* ... */ }
    onExecute(params)  // Direct callback
  }

  return <Card> {/* Form with textareas */} </Card>
}
```

**New ScriptDebuggerInput (UNCOMMITTED - recently added):**
```typescript
// IMPORTS useEffect  <-- NEW
// ADDS message listener <-- NEW
// TXID loading feature <-- NEW
// Has its own vscode.postMessage calls <-- NEW

export function ScriptDebuggerInput(_props) {
  const vscode = getVscode()
  const [isLoading, setIsLoading] = useState(false)
  const [transaction, setTransaction] = useState(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isLoading) return  // <-- IGNORES messages when not loading!

      if (message.type === 'transaction:decoded') {
        setTransaction(message.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isLoading])  // <-- DEPENDS ON isLoading! Listener added/removed frequently!

  // Sends its own messages to backend
  vscode.postMessage({ type: 'transaction:loadByTxid', ... })
  vscode.postMessage({ type: 'transaction:executeScript', ... })
}
```

### The Problem

**Component Hierarchy:**
```
ScriptDebuggerPanel (has useEffect [] - adds message listener for 'script:populate')
  └─ ScriptDebuggerInput (has useEffect [isLoading] - adds message listener for 'transaction:decoded')
```

**Both components add listeners to the SAME `window` object!**

**The Race Condition:**

1. **Panel Creation:**
   - Backend creates new Script Debugger panel
   - Frontend starts loading (React bundle, component mount)
   - setTimeout(100ms) starts counting

2. **Component Mount (during those 100ms):**
   - ScriptDebuggerPanel mounts
   - ScriptDebuggerPanel useEffect runs (empty deps [])
   - Adds listener for 'script:populate'
   - Renders ScriptDebuggerInput child component
   - ScriptDebuggerInput mounts
   - ScriptDebuggerInput useEffect runs (deps: [isLoading])
   - isLoading is false initially
   - Adds SECOND listener

3. **Message Arrives (after 100ms):**
   - Backend sends 'script:populate' message
   - ScriptDebuggerInput's handler runs
   - Line 24: `if (!isLoading) return` - **IGNORES THE MESSAGE**
   - ScriptDebuggerPanel's handler should also run... but doesn't?

**The useEffect [isLoading] Dependency:**
- Every time isLoading changes, the useEffect cleanup runs
- Cleanup REMOVES the listener
- Then ADDS it back
- If message arrives during this swap, it could be lost
- Or the frequent add/remove might interfere with the other listener

### Why It Worked Before

**Old ScriptExecutorInput:**
- NO useEffect
- NO message listener
- Only ScriptDebuggerPanel had ONE listener
- No interference, no race conditions
- setTimeout(100ms) was sufficient

**Current ScriptDebuggerInput:**
- HAS useEffect with unstable dependency
- HAS message listener that interferes
- TWO listeners on same window
- Listener churning (add/remove/add/remove)
- Messages can be lost or ignored

### Eliminating Assumptions

**CONFIRMED:**
1. ✅ The TXID loading feature is what broke it
2. ✅ The old version had NO useEffect in ScriptExecutorInput
3. ✅ The new version ADDED a message listener with [isLoading] dependency
4. ✅ setTimeout(100ms) DID work before and the timing is NOT the root issue
5. ✅ The rename from ScriptExecutor → ScriptDebugger happened in uncommitted changes
6. ✅ There ARE two message listeners on the same window object

**ELIMINATED:**
1. ❌ NOT a panel ID or naming mismatch
2. ❌ NOT a VSCode API change
3. ❌ NOT about webview caching
4. ❌ NOT about CSP or security errors
5. ❌ NOT about React hydration timing
6. ❌ NOT about needing a webview:ready handshake (old code didn't have it)
