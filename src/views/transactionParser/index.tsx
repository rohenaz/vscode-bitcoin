import * as vscode from 'vscode'
import { TransactionParser } from '../../utils/transactionParser'

export class TransactionParserPanel {
  public static currentPanel: TransactionParserPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, rawTxHex?: string) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, rawTxHex)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    )
  }

  private async handleMessage(message: any) {
    // Handle external link opening
    if (message.type === 'openExternal' && message.url) {
      vscode.env.openExternal(vscode.Uri.parse(message.url))
      return
    }

    // Handle opening transaction in decoder window
    if (message.type === 'transaction:openInWindow') {
      vscode.commands.executeCommand('bitcoin.openTransactionDecoder', message.data?.rawTxHex)
      return
    }

    if (message.type === 'transaction:parse') {
      try {
        const rawTx = message.data.rawTx
        const parser = new TransactionParser(rawTx)
        const result = parser.parse()

        // Convert BigInt values to strings for JSON serialization
        const serializedResult = {
          ...result,
          fields: result.fields.map(field => ({
            ...field,
            value: typeof field.value === 'bigint' ? field.value.toString() : field.value
          }))
        }

        this._panel.webview.postMessage({
          type: 'transaction:parsed',
          data: serializedResult
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this._panel.webview.postMessage({
          type: 'transaction:parse:error',
          data: { error: `Failed to parse transaction: ${errorMessage}` }
        })
      }
    }
  }

  public static async show(extensionUri: vscode.Uri, rawTxHex?: string) {
    if (TransactionParserPanel.currentPanel) {
      TransactionParserPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
      if (rawTxHex) {
        // Reload with new transaction
        TransactionParserPanel.currentPanel._panel.webview.html =
          TransactionParserPanel.currentPanel._getHtmlForWebview(
            TransactionParserPanel.currentPanel._panel.webview,
            rawTxHex
          )
      }
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'bitcoinTransactionParser',
      'Transaction Parser',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'views', 'webview', 'dist')]
      }
    )

    const instance = new TransactionParserPanel(panel, extensionUri, rawTxHex)
    TransactionParserPanel.currentPanel = instance
  }

  public dispose() {
    TransactionParserPanel.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) x.dispose()
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, rawTxHex?: string) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.css')
    )
    const nonce = getNonce()

    // Build INITIAL_DATA if rawTxHex is provided
    let initialDataScript = ''
    if (rawTxHex) {
      initialDataScript = `window.INITIAL_DATA = ${JSON.stringify({ rawTxHex })};`
    }

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Transaction Parser</title>
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
          window.PANEL_TYPE = 'transaction-parser';
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
