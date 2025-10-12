import * as vscode from 'vscode'
import { LockingScript, UnlockingScript } from '@bsv/sdk'
import { ScriptExecutor } from '../../utils/scriptExecutor'

export class ScriptExecutorPanel {
  public static currentPanel: ScriptExecutorPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []
  private scriptExecutors: Map<string, ScriptExecutor> = new Map()

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    )
  }

  public static show(extensionUri: vscode.Uri, spendParams?: any) {
    if (ScriptExecutorPanel.currentPanel) {
      ScriptExecutorPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
      if (spendParams) {
        ScriptExecutorPanel.currentPanel._panel.webview.postMessage({
          type: 'script:populate',
          data: { spendParams }
        })
      }
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'bitcoinScriptExecutor',
      'Script Execution Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'views', 'webview', 'dist')]
      }
    )

    ScriptExecutorPanel.currentPanel = new ScriptExecutorPanel(panel, extensionUri)

    if (spendParams) {
      setTimeout(() => {
        ScriptExecutorPanel.currentPanel?._panel.webview.postMessage({
          type: 'script:populate',
          data: { spendParams }
        })
      }, 100)
    }
  }

  private async handleMessage(message: any) {
    const { type, data } = message

    if (!type.startsWith('scriptExecutor:')) {
      return
    }

    const { id } = data || {}

    switch (type) {
      case 'scriptExecutor:init':
        await this.initScriptExecutor(id, data.spendParams)
        break
      case 'scriptExecutor:stepForward':
        await this.stepExecutorForward(id)
        break
      case 'scriptExecutor:stepBackward':
        await this.stepExecutorBackward(id)
        break
      case 'scriptExecutor:runToEnd':
        await this.runExecutorToEnd(id)
        break
      case 'scriptExecutor:reset':
        await this.resetExecutor(id)
        break
      case 'scriptExecutor:destroy':
        this.scriptExecutors.delete(id)
        break
    }
  }

  private async initScriptExecutor(id: string, spendParams: any) {
    try {
      const executor = new ScriptExecutor(spendParams)
      this.scriptExecutors.set(id, executor)

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

      this._panel.webview.postMessage({
        type: 'scriptExecutor:initialized',
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
          }
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async stepExecutorForward(id: string) {
    const executor = this.scriptExecutors.get(id)
    if (!executor) return

    try {
      const step = executor.stepForward()
      if (step) {
        // Send history update with current position
        this._panel.webview.postMessage({
          type: 'scriptExecutor:history',
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
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async stepExecutorBackward(id: string) {
    const executor = this.scriptExecutors.get(id)
    if (!executor) return

    try {
      const step = executor.stepBackward()
      if (step) {
        // Send history update with current position
        this._panel.webview.postMessage({
          type: 'scriptExecutor:history',
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
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async runExecutorToEnd(id: string) {
    const executor = this.scriptExecutors.get(id)
    if (!executor) return

    try {
      const steps = executor.runToEnd()
      this._panel.webview.postMessage({
        type: 'scriptExecutor:runComplete',
        data: { id, steps }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      })
    }
  }

  private async resetExecutor(id: string) {
    const executor = this.scriptExecutors.get(id)
    if (!executor) return

    try {
      executor.reset()
      this._panel.webview.postMessage({
        type: 'scriptExecutor:reset',
        data: { id }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._panel.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      })
    }
  }

  public dispose() {
    ScriptExecutorPanel.currentPanel = undefined
    this.scriptExecutors.clear()
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
