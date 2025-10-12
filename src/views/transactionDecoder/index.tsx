import * as vscode from 'vscode'
import fetch from 'node-fetch'

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
  private _pendingRawTxHex?: string
  private _txCache: Map<string, CachedTransaction> = new Map()

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, rawTxHex?: string) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._pendingRawTxHex = rawTxHex
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
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

    // Handle webview ready signal
    if (message.type === 'webview:ready') {
      if (this._pendingRawTxHex) {
        this._panel.webview.postMessage({
          type: 'transaction:populate',
          data: { rawTxHex: this._pendingRawTxHex }
        })
        this._pendingRawTxHex = undefined
      }
      return
    }

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

        // Store to cache
        this._txCache.set(txid, {
          decodedTx,
          rawTxHex: rawTx,
          timestamp: Date.now()
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
      // Load a transaction by its txid from WhatOnChain
      try {
        const { txid, network = 'mainnet' } = message.data

        const response = await fetch(this.getWhatOnChainUrl(network, `/tx/${txid}/hex`))

        if (!response.ok) {
          // Try the other network if not found
          const altNetwork = network === 'testnet' ? 'mainnet' : 'testnet'
          const altResponse = await fetch(this.getWhatOnChainUrl(altNetwork, `/tx/${txid}/hex`))

          if (!altResponse.ok) {
            throw new Error(`Transaction ${txid} not found on chain`)
          }

          const rawTxHex = await altResponse.text()
          this._panel.webview.postMessage({
            type: 'transaction:populate',
            data: { rawTxHex }
          })
          return
        }

        const rawTxHex = await response.text()
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
        const { sourceTXID, sourceOutputIndex, unlockingScript } = message.data

        if (!sourceTXID || sourceTXID === '0000000000000000000000000000000000000000000000000000000000000000') {
          // Coinbase transaction or no valid source - prompt for manual entry
          vscode.window.showWarningMessage(
            'Cannot fetch source transaction (coinbase or not on chain). Please use the Script Executor to manually enter the locking script.',
            'Open Script Executor'
          ).then(selection => {
            if (selection === 'Open Script Executor') {
              vscode.commands.executeCommand('bitcoin.openScriptExecutor')
            }
          })
          return
        }

        // Try mainnet first
        let response = await fetch(this.getWhatOnChainUrl('mainnet', `/tx/${sourceTXID}/hex`))

        // If not found, try testnet
        if (response.status === 404) {
          response = await fetch(this.getWhatOnChainUrl('testnet', `/tx/${sourceTXID}/hex`))
        }

        if (!response.ok) {
          // Transaction not found on chain
          vscode.window.showWarningMessage(
            `Source transaction ${sourceTXID.slice(0, 8)}... not found on chain. The locking script cannot be retrieved automatically.`,
            'Open Script Executor',
            'Enter Scripts Manually'
          ).then(selection => {
            if (selection === 'Open Script Executor') {
              vscode.commands.executeCommand('bitcoin.openScriptExecutor')
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
              vscode.commands.executeCommand('bitcoin.openScriptExecutor', partialParams)
            }
          })
          return
        }

        const sourceRawTx = await response.text()
        const sourceTx = Transaction.fromHex(sourceRawTx)

        const sourceOutput = sourceTx.outputs[sourceOutputIndex]
        if (!sourceOutput) {
          throw new Error(`Source output ${sourceOutputIndex} not found`)
        }

        const spendParams = {
          sourceTXID,
          sourceOutputIndex,
          sourceSatoshis: sourceOutput.satoshis || 1000,
          lockingScript: sourceOutput.lockingScript.toHex(),
          transactionVersion: 1,
          otherInputs: [],
          outputs: [],
          unlockingScript,
          inputSequence: 0xffffffff,
          inputIndex: 0,
          lockTime: 0,
        }

        vscode.commands.executeCommand('bitcoin.openScriptExecutor', spendParams)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        vscode.window.showErrorMessage(`Failed to execute script: ${errorMessage}`)
      }
    }
  }

  public static show(extensionUri: vscode.Uri, rawTxHex?: string) {
    if (TransactionDecoderPanel.currentPanel) {
      TransactionDecoderPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
      if (rawTxHex) {
        TransactionDecoderPanel.currentPanel._panel.webview.postMessage({
          type: 'transaction:populate',
          data: { rawTxHex }
        })
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

    TransactionDecoderPanel.currentPanel = new TransactionDecoderPanel(panel, extensionUri, rawTxHex)
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

      const txData = await response.json()
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

      // Fetch all source transactions in parallel
      const sourcePromises = Array.from(uniqueSources).map(async (sourceTxid) => {
        try {
          console.log(`Fetching source tx ${sourceTxid} from ${network}...`)
          // Try specified network first
          let response = await fetch(this.getWhatOnChainUrl(network, `/tx/${sourceTxid}/hex`))

          // Try alternate network if not found
          if (!response.ok) {
            console.log(`Not found on ${network}, trying alternate network...`)
            const altNetwork = network === 'testnet' ? 'mainnet' : 'testnet'
            response = await fetch(this.getWhatOnChainUrl(altNetwork, `/tx/${sourceTxid}/hex`))
          }

          if (!response.ok) {
            console.warn(`Source tx ${sourceTxid} not found on chain (status: ${response.status})`)
            return { txid: sourceTxid, tx: null }
          }

          const rawHex = await response.text()
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
      const response = await fetch(this.getWhatOnChainUrl(network, `/tx/${txid}/hex`))

      if (!response.ok) {
        // Try alternate network
        const altNetwork = network === 'testnet' ? 'mainnet' : 'testnet'
        const altResponse = await fetch(this.getWhatOnChainUrl(altNetwork, `/tx/${txid}/hex`))

        if (!altResponse.ok) {
          throw new Error(`Transaction ${txid} not found on chain`)
        }

        const rawTxHex = await altResponse.text()
        this._panel.webview.postMessage({
          type: 'whatsonchain:transactionHex:success',
          txid,
          data: rawTxHex
        })
        return
      }

      const rawTxHex = await response.text()
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

      // Fetch all source transactions in parallel
      const sourcePromises = Array.from(uniqueSources).map(async (sourceTxid) => {
        try {
          let response = await fetch(this.getWhatOnChainUrl(network, `/tx/${sourceTxid}/hex`))

          if (!response.ok) {
            const altNetwork = network === 'testnet' ? 'mainnet' : 'testnet'
            response = await fetch(this.getWhatOnChainUrl(altNetwork, `/tx/${sourceTxid}/hex`))
          }

          if (!response.ok) {
            return { txid: sourceTxid, tx: null }
          }

          const rawHex = await response.text()
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

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.css')
    )
    const nonce = getNonce()

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
