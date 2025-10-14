import * as vscode from 'vscode'
import fetch from 'node-fetch'
import { txCache } from '../../services/txCache'

interface CachedTransaction {
  decodedTx: any
  resolvedInputs?: any[]
  spendingInfo?: any
  rawTxHex: string
  timestamp: number
}

export class TransactionDecoderPanel {
  public static currentPanel: TransactionDecoderPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []
  private _txCache: Map<string, CachedTransaction> = new Map()

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, txid?: string, network: 'main' | 'test' = 'main') {
    this._panel = panel
    this._extensionUri = extensionUri
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, txid, network)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    )
  }

  private getWhatOnChainUrl(network: string, endpoint: string): string {
    const baseUrl = network === 'testnet'
      ? 'https://api.whatsonchain.com/v1/bsv/test'
      : 'https://api.whatsonchain.com/v1/bsv/main'

    const apiKey = vscode.workspace.getConfiguration('bitcoin.whatsonchain').get('apiKey', '')
    const url = `${baseUrl}${endpoint}`

    // API key is added as query parameter if provided
    return apiKey ? `${url}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}` : url
  }

  private async handleMessage(message: any) {
    const { Transaction } = await import('@bsv/sdk')

    // Handle external link opening
    if (message.type === 'openExternal' && message.url) {
      vscode.env.openExternal(vscode.Uri.parse(message.url))
      return
    }

    // Handle WhatOnChain query hooks
    if (message.type === 'whatsonchain:fetchTransactionHex') {
      return this.handleFetchTransactionHex(message.txid, message.network)
    }

    if (message.type === 'whatsonchain:fetchTransactionDetails') {
      return this.handleFetchTransactionDetails(message.txid, message.network)
    }

    if (message.type === 'whatsonchain:checkTransactionExists') {
      return this.handleCheckTransactionExists(message.txid, message.network)
    }

    if (message.type === 'whatsonchain:resolveInputs') {
      return this.handleResolveInputsQuery(message.txid, message.inputs, message.network)
    }

    if (message.type === 'whatsonchain:broadcastTransaction') {
      return this.handleBroadcastTransaction(message.rawTx, message.network)
    }

    if (message.type === 'transaction:decode') {
      try {
        const rawTx = message.data.rawTx
        const tx = Transaction.fromHex(rawTx)
        const txid = tx.id('hex')

        // Check cache first
        const cached = this._txCache.get(txid)
        if (cached) {
          console.log(`Using cached transaction ${txid}`)
          this._panel.webview.postMessage({
            type: 'transaction:decoded',
            data: cached.decodedTx
          })

          if (cached.resolvedInputs) {
            this._panel.webview.postMessage({
              type: 'transaction:inputsResolved',
              data: {
                txid,
                inputs: cached.resolvedInputs
              }
            })
          }

          if (cached.spendingInfo) {
            this._panel.webview.postMessage({
              type: 'transaction:spendingInfo',
              data: cached.spendingInfo
            })
          }

          // Still check on-chain status in case it changed
          this.checkTransactionOnChain(txid, cached.decodedTx.network)

          // If inputs weren't resolved, resolve them now
          if (!cached.resolvedInputs) {
            this.resolveInputs(cached.decodedTx, cached.decodedTx.network)
          }

          // If spending info wasn't fetched, fetch it now
          if (!cached.spendingInfo) {
            this.fetchSpendingInfo(txid, cached.decodedTx.network)
          }

          return
        }

        // Calculate size in bytes
        const size = rawTx.length / 2

        // Detect network (this is a heuristic - may need user input for BTC)
        let network = 'mainnet' // default BSV mainnet

        const decodedTx = {
          version: tx.version,
          lockTime: tx.lockTime,
          txid,
          size,
          network,
          inputs: tx.inputs.map((input, index) => {
            // Get source TXID - may need to extract from sourceTransaction if sourceTXID is not set
            let sourceTXID = input.sourceTXID || ''
            if (!sourceTXID && input.sourceTransaction) {
              sourceTXID = input.sourceTransaction.id('hex')
            }

            // Debug log the input structure
            if (index === 0) {
              console.log('First input structure:', {
                sourceTXID,
                hasSourceTransaction: !!input.sourceTransaction,
                sourceOutputIndex: input.sourceOutputIndex,
                inputKeys: Object.keys(input)
              })
            }

            return {
              index,
              sourceTXID,
              sourceOutputIndex: input.sourceOutputIndex,
              unlockingScript: input.unlockingScript ? input.unlockingScript.toHex() : '',
              unlockingScriptAsm: input.unlockingScript ? input.unlockingScript.toASM() : '',
              sequence: input.sequence || 0xffffffff
            }
          }),
          outputs: tx.outputs.map((output, index) => ({
            index,
            satoshis: output.satoshis || 0,
            lockingScript: output.lockingScript.toHex(),
            lockingScriptAsm: output.lockingScript.toASM()
          }))
        }

        this._panel.webview.postMessage({
          type: 'transaction:decoded',
          data: decodedTx
        })

        // Store to panel cache
        this._txCache.set(txid, {
          decodedTx,
          rawTxHex: rawTx,
          timestamp: Date.now()
        })

        // Save to persistent txCache (provides filesystem-backed history)
        txCache.set(txid, rawTx, network === 'testnet' ? 'test' : 'main', {
          inputCount: tx.inputs.length,
          outputCount: tx.outputs.length
        })

        // Check if transaction exists on chain
        this.checkTransactionOnChain(txid, network)

        // Fetch spending information for outputs
        this.fetchSpendingInfo(txid, network)

        // Resolve input transactions
        this.resolveInputs(decodedTx, network)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this._panel.webview.postMessage({
          type: 'transaction:decode:error',
          data: { error: `Failed to decode transaction: ${errorMessage}` }
        })
      }
    } else if (message.type === 'transaction:loadByTxid') {
      // Load a transaction by its txid
      try {
        const { txid, network = 'mainnet' } = message.data

        // Use unified txCache with automatic fallback
        const rawTxHex = await txCache.fetch(txid, network)

        this._panel.webview.postMessage({
          type: 'transaction:populate',
          data: { rawTxHex }
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        vscode.window.showErrorMessage(`Failed to load transaction: ${errorMessage}`)
      }
    } else if (message.type === 'transaction:executeScript') {
      // Fetch source transaction to get locking script, then open script executor
      try {
        const {
          sourceTXID,
          sourceOutputIndex,
          unlockingScript,
          inputIndex,
          spendingTxInputs,
          spendingTxOutputs,
          transactionVersion,
          transactionLockTime
        } = message.data

        if (!sourceTXID || sourceTXID === '0000000000000000000000000000000000000000000000000000000000000000') {
          // Coinbase transaction or no valid source - prompt for manual entry
          vscode.window.showWarningMessage(
            'Cannot fetch source transaction (coinbase or not on chain). Please use the Script Debugger to manually enter the locking script.',
            'Open Script Debugger'
          ).then(selection => {
            if (selection === 'Open Script Debugger') {
              vscode.commands.executeCommand('bitcoin.openScriptDebugger')
            }
          })
          return
        }

        // Use unified txCache with automatic fallback
        let sourceRawTx: string
        try {
          sourceRawTx = await txCache.fetch(sourceTXID)
        } catch (error) {
          // Transaction not found on chain
          vscode.window.showWarningMessage(
            `Source transaction ${sourceTXID.slice(0, 8)}... not found on chain. The locking script cannot be retrieved automatically.`,
            'Open Script Debugger',
            'Enter Scripts Manually'
          ).then(selection => {
            if (selection === 'Open Script Debugger') {
              vscode.commands.executeCommand('bitcoin.openScriptDebugger')
            } else if (selection === 'Enter Scripts Manually') {
              // Open with just the unlocking script pre-filled
              const partialParams = {
                sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
                sourceOutputIndex: 0,
                sourceSatoshis: 1000,
                lockingScript: '', // User will need to provide
                transactionVersion: 1,
                otherInputs: [],
                outputs: [],
                unlockingScript,
                inputSequence: 0xffffffff,
                inputIndex: 0,
                lockTime: 0,
              }
              vscode.commands.executeCommand('bitcoin.openScriptDebugger', partialParams)
            }
          })
          return
        }

        const sourceTx = Transaction.fromHex(sourceRawTx)

        const sourceOutput = sourceTx.outputs[sourceOutputIndex]
        if (!sourceOutput) {
          throw new Error(`Source output ${sourceOutputIndex} not found`)
        }

        if (!sourceOutput.lockingScript) {
          throw new Error('Source output has no locking script')
        }

        const lockingScriptHex = sourceOutput.lockingScript.toHex()
        if (!lockingScriptHex) {
          throw new Error('Failed to convert locking script to hex')
        }

        // Build otherInputs from spending transaction (all inputs except the current one)
        const otherInputs = spendingTxInputs
          .filter((_: { index: number }, i: number) => i !== inputIndex)
          .map((input: { sourceTXID: string; sourceOutputIndex: number; sequence: number }) => ({
            sourceTXID: input.sourceTXID,
            sourceOutputIndex: input.sourceOutputIndex,
            sequence: input.sequence
          }))

        // Build outputs from spending transaction
        const outputs = spendingTxOutputs.map((output: { satoshis: number; lockingScript: string }) => ({
          satoshis: output.satoshis,
          lockingScript: output.lockingScript
        }))

        // Get sequence from the input being executed
        const inputSequence = spendingTxInputs[inputIndex].sequence

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

        console.log('[TransactionDecoder] Built spendParams:', {
          hasLockingScript: !!spendParams.lockingScript,
          lockingScriptLength: spendParams.lockingScript?.length,
          hasUnlockingScript: !!spendParams.unlockingScript,
          otherInputsCount: otherInputs.length,
          outputsCount: outputs.length
        })

        console.log('[TransactionDecoder] Calling bitcoin.openScriptDebugger command')
        vscode.commands.executeCommand('bitcoin.openScriptDebugger', spendParams)
        console.log('[TransactionDecoder] Command executed')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        vscode.window.showErrorMessage(`Failed to execute script: ${errorMessage}`)
      }
    }
  }

  public static async show(extensionUri: vscode.Uri, dataOrRawTxHex?: string | { txid: string; network?: string }) {
    let txid: string | undefined
    let network: 'main' | 'test' = 'main'

    // Handle both raw hex string and { txid } object (like script debugger)
    if (typeof dataOrRawTxHex === 'string') {
      // Legacy: raw hex provided directly
      try {
        const { Transaction } = await import('@bsv/sdk')
        const tx = Transaction.fromHex(dataOrRawTxHex)
        txid = tx.id('hex') as string

        // Save to storage with metadata
        txCache.set(txid, dataOrRawTxHex, 'main', {
          inputCount: tx.inputs.length,
          outputCount: tx.outputs.length
        })
        console.log(`[TransactionDecoderPanel] Saved transaction ${txid} to storage`)
      } catch (error) {
        console.error('[TransactionDecoderPanel] Failed to decode/save transaction:', error)
      }
    } else if (dataOrRawTxHex && typeof dataOrRawTxHex === 'object' && 'txid' in dataOrRawTxHex) {
      // New: txid provided, will be fetched by frontend
      txid = dataOrRawTxHex.txid
      network = dataOrRawTxHex.network === 'test' || dataOrRawTxHex.network === 'testnet' ? 'test' : 'main'
      console.log(`[TransactionDecoderPanel] Opening with txid: ${txid}, network: ${network}`)
    }

    if (TransactionDecoderPanel.currentPanel) {
      TransactionDecoderPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
      if (txid) {
        // Reload with new txid/network
        TransactionDecoderPanel.currentPanel._panel.webview.html =
          TransactionDecoderPanel.currentPanel._getHtmlForWebview(TransactionDecoderPanel.currentPanel._panel.webview, txid, network)
      }
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'bitcoinTransactionDecoder',
      'Transaction Decoder',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'views', 'webview', 'dist')]
      }
    )

    const instance = new TransactionDecoderPanel(panel, extensionUri, txid, network)
    TransactionDecoderPanel.currentPanel = instance
  }

  private async checkTransactionOnChain(txid: string, network: string) {
    try {
      const response = await fetch(this.getWhatOnChainUrl(network, `/tx/hash/${txid}`))

      if (response.ok) {
        // Transaction found on chain
        this._panel.webview.postMessage({
          type: 'transaction:onChainStatus',
          data: { txid, onChain: true, network }
        })
      } else if (response.status === 404) {
        // Transaction not found - can be broadcast
        this._panel.webview.postMessage({
          type: 'transaction:onChainStatus',
          data: { txid, onChain: false, network }
        })
      }
    } catch (error) {
      // Network error or API down - allow broadcast
      console.warn('Failed to check transaction on chain:', error)
    }
  }

  private async fetchSpendingInfo(txid: string, network: string) {
    try {
      // Fetch transaction details with output spending info
      const response = await fetch(this.getWhatOnChainUrl(network, `/tx/${txid}`))

      if (!response.ok) {
        return // Transaction not on chain, no spending info available
      }

      const txData = await response.json() as { vout?: Array<{ spentTxId?: string; spentIndex?: number }> }
      const spending: { [outputIndex: number]: { txid: string; vout: number } } = {}

      // WhatOnChain API returns vout array with spending txid
      if (txData.vout) {
        for (let i = 0; i < txData.vout.length; i++) {
          const output = txData.vout[i]
          if (output.spentTxId) {
            spending[i] = {
              txid: output.spentTxId,
              vout: output.spentIndex || 0
            }
          }
        }
      }

      const spendingData = { txid, spending }
      this._panel.webview.postMessage({
        type: 'transaction:spendingInfo',
        data: spendingData
      })

      // Update cache
      const cached = this._txCache.get(txid)
      if (cached) {
        cached.spendingInfo = spendingData
      }
    } catch (error) {
      console.warn('Failed to fetch spending info:', error)
    }
  }

  private async resolveInputs(decodedTx: any, network: string) {
    const { Transaction } = await import('@bsv/sdk')

    try {
      // Fetch all unique source transactions
      const uniqueSources = new Set<string>()
      decodedTx.inputs.forEach((input: any) => {
        console.log('Input sourceTXID:', input.sourceTXID, 'index:', input.index)
        if (input.sourceTXID && input.sourceTXID !== '0000000000000000000000000000000000000000000000000000000000000000') {
          uniqueSources.add(input.sourceTXID)
        }
      })

      console.log('Unique source TXIDs to fetch:', Array.from(uniqueSources))

      if (uniqueSources.size === 0) {
        console.warn('No source TXIDs to resolve')
        return
      }

      // Fetch all source transactions in parallel using txCache
      const sourcePromises = Array.from(uniqueSources).map(async (sourceTxid) => {
        try {
          console.log(`Fetching source tx ${sourceTxid}...`)
          const rawHex = await txCache.fetch(sourceTxid, network)
          console.log(`Successfully fetched source tx ${sourceTxid}`)
          const tx = Transaction.fromHex(rawHex)
          return { txid: sourceTxid, tx }
        } catch (error) {
          console.warn(`Failed to fetch source tx ${sourceTxid}:`, error)
          return { txid: sourceTxid, tx: null }
        }
      })

      const sourceResults = await Promise.all(sourcePromises)
      const sourceTxMap = new Map<string, any>()
      sourceResults.forEach(result => {
        if (result.tx) {
          sourceTxMap.set(result.txid, result.tx)
        }
      })

      // Resolve each input
      const resolvedInputs = decodedTx.inputs.map((input: any) => {
        const sourceTx = sourceTxMap.get(input.sourceTXID)
        if (!sourceTx) {
          return {
            ...input,
            resolved: false
          }
        }

        const sourceOutput = sourceTx.outputs[input.sourceOutputIndex]
        if (!sourceOutput) {
          return {
            ...input,
            resolved: false
          }
        }

        return {
          ...input,
          resolved: true,
          lockingScript: sourceOutput.lockingScript.toHex(),
          lockingScriptAsm: sourceOutput.lockingScript.toASM(),
          satoshis: sourceOutput.satoshis || 0
        }
      })

      console.log('Sending inputsResolved message:', {
        txid: decodedTx.txid,
        inputCount: resolvedInputs.length,
        firstInput: resolvedInputs[0]
      })

      this._panel.webview.postMessage({
        type: 'transaction:inputsResolved',
        data: {
          txid: decodedTx.txid,
          inputs: resolvedInputs
        }
      })

      // Update cache with resolved inputs
      const cached = this._txCache.get(decodedTx.txid)
      if (cached) {
        cached.resolvedInputs = resolvedInputs
      }

    } catch (error) {
      console.error('Failed to resolve inputs:', error)
    }
  }

  private async handleFetchTransactionHex(txid: string, network: string) {
    try {
      // Use unified txCache with automatic fallback
      const rawTxHex = await txCache.fetch(txid, network)

      this._panel.webview.postMessage({
        type: 'whatsonchain:transactionHex:success',
        txid,
        data: rawTxHex
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'whatsonchain:transactionHex:error',
        txid,
        error: errorMessage
      })
    }
  }

  private async handleFetchTransactionDetails(txid: string, network: string) {
    try {
      const response = await fetch(this.getWhatOnChainUrl(network, `/tx/${txid}`))

      if (!response.ok) {
        throw new Error(`Transaction ${txid} not found on chain`)
      }

      const data = await response.json()
      this._panel.webview.postMessage({
        type: 'whatsonchain:transactionDetails:success',
        txid,
        data
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'whatsonchain:transactionDetails:error',
        txid,
        error: errorMessage
      })
    }
  }

  private async handleCheckTransactionExists(txid: string, network: string) {
    try {
      const response = await fetch(this.getWhatOnChainUrl(network, `/tx/hash/${txid}`))

      this._panel.webview.postMessage({
        type: 'whatsonchain:transactionExists:success',
        txid,
        data: { exists: response.ok }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'whatsonchain:transactionExists:error',
        txid,
        error: errorMessage
      })
    }
  }

  private async handleResolveInputsQuery(txid: string, inputs: any[], network: string) {
    const { Transaction } = await import('@bsv/sdk')

    try {
      // Fetch all unique source transactions
      const uniqueSources = new Set<string>()
      inputs.forEach((input: any) => {
        if (input.sourceTXID && input.sourceTXID !== '0000000000000000000000000000000000000000000000000000000000000000') {
          uniqueSources.add(input.sourceTXID)
        }
      })

      // Fetch all source transactions in parallel using txCache
      const sourcePromises = Array.from(uniqueSources).map(async (sourceTxid) => {
        try {
          const rawHex = await txCache.fetch(sourceTxid, network)
          const tx = Transaction.fromHex(rawHex)
          return { txid: sourceTxid, tx }
        } catch (error) {
          return { txid: sourceTxid, tx: null }
        }
      })

      const sourceResults = await Promise.all(sourcePromises)
      const sourceTxMap = new Map<string, any>()
      sourceResults.forEach(result => {
        if (result.tx) {
          sourceTxMap.set(result.txid, result.tx)
        }
      })

      // Resolve each input
      const resolvedInputs = inputs.map((input: any) => {
        const sourceTx = sourceTxMap.get(input.sourceTXID)
        if (!sourceTx) {
          return {
            ...input,
            resolved: false
          }
        }

        const sourceOutput = sourceTx.outputs[input.sourceOutputIndex]
        if (!sourceOutput) {
          return {
            ...input,
            resolved: false
          }
        }

        return {
          ...input,
          resolved: true,
          lockingScript: sourceOutput.lockingScript.toHex(),
          lockingScriptAsm: sourceOutput.lockingScript.toASM(),
          satoshis: sourceOutput.satoshis || 0
        }
      })

      this._panel.webview.postMessage({
        type: 'whatsonchain:inputsResolved:success',
        txid,
        data: resolvedInputs
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'whatsonchain:inputsResolved:error',
        txid,
        error: errorMessage
      })
    }
  }

  private async handleBroadcastTransaction(rawTx: string, network: string) {
    try {
      const response = await fetch(this.getWhatOnChainUrl(network, '/tx/raw'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txhex: rawTx })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Broadcast failed')
      }

      const result = await response.text()
      this._panel.webview.postMessage({
        type: 'whatsonchain:broadcast:result',
        data: {
          success: true,
          txid: result
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'whatsonchain:broadcast:result',
        data: {
          success: false,
          error: errorMessage
        }
      })
    }
  }

  public dispose() {
    TransactionDecoderPanel.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) x.dispose()
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, txid?: string, network: 'main' | 'test' = 'main') {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.css')
    )
    const nonce = getNonce()

    // Build INITIAL_DATA if txid is provided
    let initialDataScript = ''
    if (txid) {
      const cached = txCache.get(txid)
      if (cached) {
        // Transaction in cache - provide rawTxHex for immediate display
        initialDataScript = `window.INITIAL_DATA = ${JSON.stringify({ txid, rawTxHex: cached.rawTxHex, network: cached.network })};`
      } else {
        // Not in cache - provide just txid, frontend will fetch with network preference
        initialDataScript = `window.INITIAL_DATA = ${JSON.stringify({ txid, network })};`
      }
    }

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Transaction Decoder</title>
        <style>
          .loader-container {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: var(--vscode-editor-background);
          }
          .loader {
            border: 3px solid transparent;
            border-top-color: var(--vscode-progressBar-background);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader-container" id="initial-loader">
          <div class="loader"></div>
        </div>
        <div id="root"></div>
        <script nonce="${nonce}">
          window.PANEL_TYPE = 'transaction-decoder';
          ${initialDataScript}
        </script>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`
  }
}

function getNonce() {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
