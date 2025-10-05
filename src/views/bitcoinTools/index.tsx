import * as vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import { walletState } from '../../services/walletState';
import { transactionService, TransactionError } from '../../services/transactionService';
import { ordinalsService } from '../../services/ordinalsService';

export class BitcoinToolsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bitcoin.toolsView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _vault: KeyVault
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Initialize wallet state manager
    walletState.initialize(this._vault, webviewView);

    // Refresh wallet state when webview becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        walletState.checkVaultStatus();
      }
    });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type) {
        // Handle wallet messages
        if (message.type.startsWith('wallet:')) {
          switch (message.type) {
            case 'wallet:getFundingKey':
              await walletState.loadFundingKey();
              break;
            case 'wallet:refreshBalance':
              await walletState.refreshAllData();
              break;
            case 'wallet:checkVaultStatus':
              await walletState.checkVaultStatus();
              break;
            case 'wallet:getNfts':
            case 'wallet:getTokens':
              // State already loaded, just push current state
              walletState.pushState();
              break;
            case 'wallet:sendBsv:estimate':
              await this.handleSendBsvEstimate(webviewView, message.data);
              break;
            case 'wallet:sendBsv:send':
              await this.handleSendBsv(webviewView, message.data);
              break;
          }
          return;
        }

        // Handle data conversion messages
        switch (message.type) {
          case 'detect':
            const { detectFormat } = await import('../../utils');
            const detected = detectFormat(message.input);
            webviewView.webview.postMessage({ type: 'detected', format: detected });
            break;
          case 'convert':
            try {
              const { convertData } = await import('../../utils');
              const result = convertData(message.input, message.fromFormat, message.toFormat);
              webviewView.webview.postMessage({ type: 'result', value: result });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              vscode.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
            }
            break;
          case 'copy':
            if (message.value) {
              await vscode.env.clipboard.writeText(message.value);
              vscode.window.showInformationMessage('Copied to clipboard');
            }
            break;
        }
      } else if (message.command) {
        // Handle command messages
        if (message.command === 'openExternal' && message.url) {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        } else {
          vscode.commands.executeCommand(message.command);
        }
      }
    });

    // Handle disposal
    webviewView.onDidDispose(() => {
      walletState.dispose();
    });
  }

  public setConversionInput(value: string) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'setConversionInput', value });
    }
  }

  public setConversionResult(value: string) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'setConversionResult', value });
    }
  }

  /**
   * Handle Send BSV estimate request
   */
  private async handleSendBsvEstimate(
    webviewView: vscode.WebviewView,
    data: { recipientAddress: string; satoshis: number }
  ) {
    try {
      // Get funding key
      const fundingKey = await this._vault.getFundingKey();
      if (!fundingKey || fundingKey.type !== 'wif') {
        throw new Error('No funding key available');
      }

      // Get payment address
      const payAddress = ordinalsService.deriveOrdAddress(fundingKey.value);

      // Fetch UTXOs
      const utxos = await ordinalsService.getPaymentUtxos(payAddress);
      if (utxos.length === 0) {
        throw new TransactionError('No UTXOs available', 'NO_UTXOS');
      }

      // Build transaction (this will estimate fee)
      const result = transactionService.buildSendBsvTransaction({
        recipientAddress: data.recipientAddress,
        satoshis: data.satoshis,
        wif: fundingKey.value,
        utxos,
        changeAddress: payAddress,
      });

      // Send estimate back to webview
      webviewView.webview.postMessage({
        type: 'wallet:sendBsv:estimate',
        data: {
          success: true,
          fee: result.fee,
          changeAmount: result.changeAmount,
          inputAmount: result.inputAmount,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'wallet:sendBsv:estimate',
        data: {
          success: false,
          error: errorMessage,
        },
      });
    }
  }

  /**
   * Handle Send BSV transaction
   */
  private async handleSendBsv(
    webviewView: vscode.WebviewView,
    data: { recipientAddress: string; satoshis: number }
  ) {
    try {
      // Get funding key
      const fundingKey = await this._vault.getFundingKey();
      if (!fundingKey || fundingKey.type !== 'wif') {
        throw new Error('No funding key available');
      }

      // Get payment address
      const payAddress = ordinalsService.deriveOrdAddress(fundingKey.value);

      // Fetch fresh UTXOs
      const utxos = await ordinalsService.getPaymentUtxos(payAddress);
      if (utxos.length === 0) {
        throw new TransactionError('No UTXOs available', 'NO_UTXOS');
      }

      // Build transaction
      const result = transactionService.buildSendBsvTransaction({
        recipientAddress: data.recipientAddress,
        satoshis: data.satoshis,
        wif: fundingKey.value,
        utxos,
        changeAddress: payAddress,
      });

      // Get raw transaction hex
      const rawTx = result.tx.toHex();

      // Broadcast transaction
      const broadcastResult = await transactionService.broadcastTransaction(rawTx);

      if (broadcastResult.status === 'success') {
        // Success
        webviewView.webview.postMessage({
          type: 'wallet:sendBsv:result',
          data: {
            success: true,
            txid: broadcastResult.txid,
            fee: result.fee,
            message: broadcastResult.message,
          },
        });

        // Show success notification
        vscode.window.showInformationMessage(
          `Transaction sent successfully! ${broadcastResult.txid?.slice(0, 8)}...`
        );
      } else {
        throw new Error(broadcastResult.message || 'Broadcast failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      webviewView.webview.postMessage({
        type: 'wallet:sendBsv:result',
        data: {
          success: false,
          error: errorMessage,
        },
      });

      // Show error notification
      vscode.window.showErrorMessage(`Transaction failed: ${errorMessage}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for the React app build artifacts
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'bitcoinTools', 'webview', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'bitcoinTools', 'webview', 'dist', 'assets', 'index.css')
    );

    // Generate a nonce for CSP
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Bitcoin Tools</title>
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
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
