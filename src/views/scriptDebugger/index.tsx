import * as vscode from 'vscode'
import { LockingScript, UnlockingScript, Transaction } from '@bsv/sdk'
import { ScriptDebugger } from '../../utils/scriptDebugger'
import { txCache } from '../../services/txCache'
import fetch from 'node-fetch'

export class ScriptDebuggerPanel {
  public static currentPanel: ScriptDebuggerPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []
  private scriptDebuggers: Map<string, ScriptDebugger> = new Map()

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, spendParams?: any) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, spendParams)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    )
  }

  public static initialize(context: vscode.ExtensionContext) {
    // TxCache is a singleton, no initialization needed
  }

  public static show(extensionUri: vscode.Uri, spendParams?: any) {
    console.log('[ScriptDebuggerPanel.show] Called, spendParams:', !!spendParams)

    if (ScriptDebuggerPanel.currentPanel) {
      console.log('[ScriptDebuggerPanel.show] Reusing existing panel, recreating with new data')
      ScriptDebuggerPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
      // Recreate HTML with new spendParams
      ScriptDebuggerPanel.currentPanel._panel.webview.html =
        ScriptDebuggerPanel.currentPanel._getHtmlForWebview(
          ScriptDebuggerPanel.currentPanel._panel.webview,
          spendParams
        )
      return
    }

    console.log('[ScriptDebuggerPanel.show] Creating NEW panel')
    const panel = vscode.window.createWebviewPanel(
      'bitcoinScriptDebugger',
      'Script Execution Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'views', 'webview', 'dist')]
      }
    )

    console.log('[ScriptDebuggerPanel.show] Creating panel instance')
    ScriptDebuggerPanel.currentPanel = new ScriptDebuggerPanel(panel, extensionUri, spendParams)
    console.log('[ScriptDebuggerPanel.show] Panel instance created')
  }

  private async handleMessage(message: any) {
    const { type, data } = message
    console.log('[ScriptDebuggerPanel] Received message:', type, data)

    // Handle transaction:executeScript (coming from Transaction Decoder or TXID loader)
    if (type === 'transaction:executeScript') {
      console.log('[ScriptDebuggerPanel] Executing script from transaction')
      await this.executeInputFromTx(data)
      return
    }

    // Handle transaction:loadByTxid - fetch and decode transaction
    if (type === 'transaction:loadByTxid') {
      console.log('[ScriptDebuggerPanel] Loading transaction by TXID:', data.txid)
      await this.handleLoadByTxid(data.txid, data.network)
      return
    }

    // Handle transaction:decode - decode raw transaction hex
    if (type === 'transaction:decode') {
      console.log('[ScriptDebuggerPanel] Decoding transaction')
      await this.handleDecodeTransaction(data.rawTx)
      return
    }

    if (!type.startsWith('scriptDebugger:')) {
      return
    }

    const { id } = data || {}

    switch (type) {
      case 'scriptDebugger:init':
        await this.initScriptDebugger(id, data.spendParams)
        break
      case 'scriptDebugger:stepForward':
        await this.stepExecutorForward(id)
        break
      case 'scriptDebugger:stepBackward':
        await this.stepExecutorBackward(id)
        break
      case 'scriptDebugger:runToEnd':
        await this.runExecutorToEnd(id)
        break
      case 'scriptDebugger:reset':
        await this.resetExecutor(id)
        break
      case 'scriptDebugger:toggleBreakpoint':
        await this.toggleBreakpoint(id, data.context, data.index, data.enabled)
        break
      case 'scriptDebugger:destroy':
        this.scriptDebuggers.delete(id)
        break
    }
  }

  private async initScriptDebugger(id: string, spendParams: any) {
    try {
      const executor = new ScriptDebugger(spendParams)
      this.scriptDebuggers.set(id, executor)

      const unlockingScript = UnlockingScript.fromHex(spendParams.unlockingScript)
      const lockingScript = LockingScript.fromHex(spendParams.lockingScript)

      const unlockingChunks = unlockingScript.chunks.map((chunk: any) => ({
        op: chunk.op,
        data: chunk.data ? Array.from(chunk.data) : undefined
      }))

      const lockingChunks = lockingScript.chunks.map((chunk: any) => ({
        op: chunk.op,
        data: chunk.data ? Array.from(chunk.data) : undefined
      }))

      // Send initial step representing "ready" state (about to execute first instruction)
      const initialStep = {
        stepNumber: 0,
        context: 'UnlockingScript' as const,
        programCounter: 0,
        opcode: 0,
        opcodeName: 'READY',
        opcodeHex: '0x00',
        data: undefined,
        stack: [],
        altStack: [],
        ifStack: [],
        stackMem: 0,
        altStackMem: 0,
        description: 'Ready to execute',
        stackDiff: {
          mainStackChanges: [],
          altStackChanges: [],
          ifStackChanges: []
        },
        success: true
      }

      this._panel.webview.postMessage({
        type: 'scriptDebugger:initialized',
        data: {
          id,
          unlockingScript: {
            chunks: unlockingChunks,
            hex: unlockingScript.toHex(),
            asm: unlockingScript.toASM()
          },
          lockingScript: {
            chunks: lockingChunks,
            hex: lockingScript.toHex(),
            asm: lockingScript.toASM()
          },
          initialStep
        }
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error('[ScriptDebuggerPanel] initScriptDebugger ERROR:', errorMessage, errorStack)
      this._panel.webview.postMessage({
        type: 'scriptDebugger:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async stepExecutorForward(id: string) {
    const executor = this.scriptDebuggers.get(id)
    if (!executor) {
      return
    }

    try {
      const step = executor.stepForward()
      if (step) {
        // Send step directly (for both normal steps and breakpoint hits)
        this._panel.webview.postMessage({
          type: 'scriptDebugger:step',
          data: {
            id,
            step
          }
        })
      } else {
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptDebugger:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async stepExecutorBackward(id: string) {
    const executor = this.scriptDebuggers.get(id)
    if (!executor) return

    try {
      const step = executor.stepBackward()
      if (step) {
        // Send history update with current position
        this._panel.webview.postMessage({
          type: 'scriptDebugger:history',
          data: {
            id,
            history: executor.getHistory(),
            currentIndex: executor.getCurrentStepIndex()
          }
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptDebugger:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async runExecutorToEnd(id: string) {
    const executor = this.scriptDebuggers.get(id)
    if (!executor) return

    try {
      const steps = executor.runToEnd()
      this._panel.webview.postMessage({
        type: 'scriptDebugger:runComplete',
        data: { id, steps }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptDebugger:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async resetExecutor(id: string) {
    const executor = this.scriptDebuggers.get(id)
    if (!executor) return

    try {
      executor.reset()
      this._panel.webview.postMessage({
        type: 'scriptDebugger:reset',
        data: { id }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptDebugger:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async toggleBreakpoint(id: string, context: 'UnlockingScript' | 'LockingScript', index: number, enabled: boolean) {
    const executor = this.scriptDebuggers.get(id)
    if (!executor) return

    try {
      if (enabled) {
        executor.setBreakpoint(context, index)
      } else {
        executor.removeBreakpoint(context, index)
      }

      // Send confirmation back to frontend
      this._panel.webview.postMessage({
        type: 'scriptDebugger:breakpointToggled',
        data: { id, context, index, enabled }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptDebugger:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async handleLoadByTxid(txid: string, network: string) {
    try {
      console.log('[ScriptDebuggerPanel] Fetching transaction:', txid, network)

      // Use unified txCache with automatic fallback
      // Normalize network: WhatOnChain uses 'main'/'test', txCache uses 'mainnet'/'testnet'
      const normalizedNetwork = network === 'main' ? 'mainnet' : network === 'test' ? 'testnet' : network
      const rawTxHex = await txCache.fetch(txid, normalizedNetwork)

      console.log('[ScriptDebuggerPanel] Fetched raw transaction, length:', rawTxHex.length)
      await this.handleDecodeTransaction(rawTxHex)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ScriptDebuggerPanel] Error loading transaction:', errorMessage)
      this._panel.webview.postMessage({
        type: 'transaction:decode:error',
        data: { error: errorMessage }
      })
    }
  }

  private async handleDecodeTransaction(rawTx: string) {
    try {
      console.log('[ScriptDebuggerPanel] Decoding transaction...')
      const tx = Transaction.fromHex(rawTx)
      const txid = tx.id('hex')
      const size = rawTx.length / 2

      const decodedTx = {
        version: tx.version,
        lockTime: tx.lockTime,
        txid,
        size,
        network: 'main',
        inputs: tx.inputs.map((input, index) => {
          let sourceTXID = input.sourceTXID || ''
          if (!sourceTXID && input.sourceTransaction) {
            sourceTXID = input.sourceTransaction.id('hex')
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

      console.log('[ScriptDebuggerPanel] Transaction decoded successfully:', txid, 'inputs:', decodedTx.inputs.length)
      console.log('[ScriptDebuggerPanel] Sending transaction:decoded message to webview')
      this._panel.webview.postMessage({
        type: 'transaction:decoded',
        data: decodedTx
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ScriptDebuggerPanel] Decode error:', errorMessage)
      this._panel.webview.postMessage({
        type: 'transaction:decode:error',
        data: { error: `Failed to decode transaction: ${errorMessage}` }
      })
    }
  }

  private async executeInputFromTx(data: any) {
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
      } = data

      if (!sourceTXID || sourceTXID === '0000000000000000000000000000000000000000000000000000000000000000') {
        vscode.window.showWarningMessage('Cannot fetch source transaction (coinbase or not on chain).')
        return
      }

      // Use unified txCache with automatic fallback
      let sourceRawTx: string
      try {
        sourceRawTx = await txCache.fetch(sourceTXID)
      } catch (error) {
        vscode.window.showWarningMessage(`Source transaction ${sourceTXID.slice(0, 8)}... not found on chain.`)
        return
      }

      const sourceTx = Transaction.fromHex(sourceRawTx)

      const sourceOutput = sourceTx.outputs[sourceOutputIndex]
      if (!sourceOutput?.lockingScript) {
        throw new Error(`Source output ${sourceOutputIndex} not found or has no locking script`)
      }

      const lockingScriptHex = sourceOutput.lockingScript.toHex()

      const otherInputs = spendingTxInputs
        .filter((_: any, i: number) => i !== inputIndex)
        .map((input: any) => ({
          sourceTXID: input.sourceTXID,
          sourceOutputIndex: input.sourceOutputIndex,
          sequence: input.sequence
        }))

      const outputs = spendingTxOutputs.map((output: any) => ({
        satoshis: output.satoshis,
        lockingScript: output.lockingScript
      }))

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

      // Reload the panel with the new spendParams
      console.log('[ScriptDebuggerPanel] Reloading panel with spendParams')
      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, spendParams)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      vscode.window.showErrorMessage(`Failed to execute script: ${errorMessage}`)
    }
  }

  public dispose() {
    ScriptDebuggerPanel.currentPanel = undefined
    this.scriptDebuggers.clear()
    this._panel.dispose()
    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) x.dispose()
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, spendParams?: any) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.css')
    )
    const nonce = getNonce()

    // Build INITIAL_DATA with spendParams for immediate frontend access
    // If spendParams only has a txid field, treat it as initialTxid instead
    let initialDataScript = ''
    if (spendParams) {
      if (spendParams.txid && !spendParams.sourceTXID) {
        // Only txid provided - set as initialTxid for the input form (auto-load mode)
        const network = spendParams.network || 'main'
        initialDataScript = `window.INITIAL_DATA = ${JSON.stringify({ txid: spendParams.txid, network })};`
      } else {
        // Full spendParams - set for immediate execution
        initialDataScript = `window.INITIAL_DATA = ${JSON.stringify({ spendParams })};`
      }
    }

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Script Execution Visualizer</title>
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
          window.PANEL_TYPE = 'script-executor';
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
