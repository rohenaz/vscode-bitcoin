import * as vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import { walletState } from '../../services/walletState';
import { transactionService, TransactionError } from '../../services/transactionService';
import { ordinalsService } from '../../services/ordinalsService';
import { tokenTransferService } from '../../services/tokenTransferService';
import { PrivateKey } from '@bsv/sdk';
import type { VaultBackup } from 'bitcoin-backup';

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
            case 'wallet:transferToken:estimate':
              await this.handleTransferTokenEstimate(webviewView, message.data);
              break;
            case 'wallet:transferToken:send':
              await this.handleTransferToken(webviewView, message.data);
              break;
          }
          return;
        }

        // Handle vault messages
        if (message.type.startsWith('vault:')) {
          switch (message.type) {
            case 'vault:getStats':
              await this.handleGetVaultStats(webviewView);
              break;
            case 'vault:export':
              await this.handleExportVault(webviewView);
              break;
            case 'vault:import':
              await this.handleImportVault(webviewView);
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
        } else if (message.command === 'downloadOrdinal' && message.origin) {
          await this.handleDownloadOrdinal(webviewView, message.origin, message.contentType);
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

  /**
   * Handle token transfer estimate request
   */
  private async handleTransferTokenEstimate(
    webviewView: vscode.WebviewView,
    data: {
      tokenId: string;
      protocol: 'BSV20' | 'BSV21';
      amount: number;
      recipientAddress: string;
    }
  ) {
    try {
      // Get both funding and ordinals keys
      const fundingKey = await this._vault.getFundingKey();
      const ordinalsKey = await this._vault.getOrdinalsKey();

      if (!fundingKey || fundingKey.type !== 'wif') {
        throw new Error('No funding key available');
      }
      if (!ordinalsKey || ordinalsKey.type !== 'wif') {
        throw new Error('No ordinals key available');
      }

      // Get addresses
      const payAddress = ordinalsService.deriveOrdAddress(fundingKey.value);
      const ordAddress = ordinalsService.deriveOrdAddress(ordinalsKey.value);

      // Fetch token info
      const tokenInfo = await tokenTransferService.getTokenInfo(data.protocol, data.tokenId);
      if (!tokenInfo) {
        throw new Error('Token not found');
      }

      // Fetch UTXOs
      const paymentUtxos = await ordinalsService.getPaymentUtxos(payAddress);
      const tokenUtxos = await tokenTransferService.fetchTokenUtxos(
        data.protocol,
        data.tokenId,
        ordAddress
      );

      if (paymentUtxos.length === 0) {
        throw new Error('No payment UTXOs available');
      }
      if (tokenUtxos.length === 0) {
        throw new Error('No token UTXOs available');
      }

      // Estimate fee
      const estimate = await tokenTransferService.estimateTransferFee(
        tokenInfo,
        data.amount,
        tokenUtxos,
        paymentUtxos
      );

      // Send estimate back to webview
      webviewView.webview.postMessage({
        type: 'wallet:transferToken:estimateResult',
        data: estimate,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'wallet:transferToken:error',
        data: { error: errorMessage },
      });
    }
  }

  /**
   * Handle token transfer transaction
   */
  private async handleTransferToken(
    webviewView: vscode.WebviewView,
    data: {
      tokenId: string;
      protocol: 'BSV20' | 'BSV21';
      amount: number;
      recipientAddress: string;
      isBurn?: boolean;
    }
  ) {
    try {
      // Get both funding and ordinals keys
      const fundingKey = await this._vault.getFundingKey();
      const ordinalsKey = await this._vault.getOrdinalsKey();

      if (!fundingKey || fundingKey.type !== 'wif') {
        throw new Error('No funding key available');
      }
      if (!ordinalsKey || ordinalsKey.type !== 'wif') {
        throw new Error('No ordinals key available');
      }

      // Get addresses
      const payAddress = ordinalsService.deriveOrdAddress(fundingKey.value);
      const ordAddress = ordinalsService.deriveOrdAddress(ordinalsKey.value);

      // Fetch token info
      const tokenInfo = await tokenTransferService.getTokenInfo(data.protocol, data.tokenId);
      if (!tokenInfo) {
        throw new Error('Token not found');
      }

      // Fetch fresh UTXOs
      const paymentUtxos = await ordinalsService.getPaymentUtxos(payAddress);
      const tokenUtxos = await tokenTransferService.fetchTokenUtxos(
        data.protocol,
        data.tokenId,
        ordAddress
      );

      if (paymentUtxos.length === 0) {
        throw new Error('No payment UTXOs available');
      }
      if (tokenUtxos.length === 0) {
        throw new Error('No token UTXOs available');
      }

      // Build transfer config
      const transferConfig = {
        tokenInfo,
        amount: data.amount,
        recipientAddress: data.recipientAddress,
        paymentUtxos,
        tokenUtxos,
        paymentPk: PrivateKey.fromWif(fundingKey.value),
        ordPk: PrivateKey.fromWif(ordinalsKey.value),
        changeAddress: payAddress,
        ordAddress,
      };

      // Execute transfer
      const result = data.isBurn
        ? await tokenTransferService.burnToken(transferConfig)
        : await tokenTransferService.transferToken(transferConfig);

      // Get raw transaction hex
      const rawTx = result.tx.toHex();

      // Broadcast transaction
      const broadcastResult = await transactionService.broadcastTransaction(rawTx);

      if (broadcastResult.status === 'success') {
        // Success
        webviewView.webview.postMessage({
          type: 'wallet:transferToken:success',
          data: {
            txid: broadcastResult.txid,
            fee: result.fee,
            tokenChange: result.tokenChange,
            payChange: result.payChange,
          },
        });

        // Show success notification
        const action = data.isBurn ? 'Tokens burned' : 'Tokens sent';
        vscode.window.showInformationMessage(
          `${action} successfully! ${broadcastResult.txid?.slice(0, 8)}...`
        );

        // Refresh wallet data
        await walletState.refreshAllData();
      } else {
        throw new Error(broadcastResult.message || 'Broadcast failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      webviewView.webview.postMessage({
        type: 'wallet:transferToken:error',
        data: { error: errorMessage },
      });

      // Show error notification
      vscode.window.showErrorMessage(`Token transfer failed: ${errorMessage}`);
    }
  }

  /**
   * Handle downloading an ordinal file from ordfs.network
   */
  private async handleDownloadOrdinal(
    webviewView: vscode.WebviewView,
    origin: string,
    contentType?: string
  ) {
    try {
      const url = `https://ordfs.network/${origin}`;

      // For images and viewable content, download and save locally
      if (contentType?.startsWith('image/') || contentType?.startsWith('text/') || contentType?.startsWith('application/json')) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        // Get file extension from content type
        let extension = '.bin';
        if (contentType) {
          const cleanMimeType = contentType.split(';')[0];
          const mimeMap: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'text/plain': '.txt',
            'text/html': '.html',
            'application/json': '.json',
          };
          extension = mimeMap[cleanMimeType.toLowerCase()] || '.bin';
        }

        // Download as buffer and save directly
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save to ~/.bitcoin/media folder
        const os = await import('os');
        const path = await import('path');
        const fs = await import('fs');

        const mediaDir = path.join(os.homedir(), '.bitcoin', 'media');
        if (!fs.existsSync(mediaDir)) {
          fs.mkdirSync(mediaDir, { recursive: true });
        }

        const filename = `ordinal_${origin.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}${extension}`;
        const filePath = path.join(mediaDir, filename);

        fs.writeFileSync(filePath, buffer);

        // Open the file in VSCode
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('vscode.open', uri);
      } else {
        // For other content types, open externally in browser
        await vscode.env.openExternal(vscode.Uri.parse(url));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to open ordinal: ${errorMessage}`);
    }
  }

  /**
   * Handle getting vault stats
   */
  private async handleGetVaultStats(webviewView: vscode.WebviewView) {
    const stats = this._vault.getVaultStats();
    const isLocked = !this._vault.isUnlocked();

    webviewView.webview.postMessage({
      type: 'vault:stats',
      data: stats ? { ...stats, isLocked } : { isLocked }
    });
  }

  /**
   * Handle exporting vault backup using bitcoin-backup library
   */
  private async handleExportVault(webviewView: vscode.WebviewView) {
    try {
      const { encryptBackup } = await import('bitcoin-backup');

      const vaultData = await this._vault.exportVaultBackup();

      if (!vaultData) {
        vscode.window.showErrorMessage('Vault is empty or not initialized');
        return;
      }

      // Prompt for backup passphrase (different from vault password)
      const backupPassphrase = await vscode.window.showInputBox({
        prompt: 'Enter backup passphrase (protects backup file)',
        password: true,
        placeHolder: 'Minimum 8 characters',
        validateInput: (value) => {
          if (value.length < 8) {
            return 'Passphrase must be at least 8 characters';
          }
          return null;
        }
      });

      if (!backupPassphrase) {
        return; // User cancelled
      }

      // Create VaultBackup object
      const vaultBackup: VaultBackup = {
        encryptedVault: vaultData.encryptedVault,
        keyCount: vaultData.keyCount,
        label: 'VSCode Bitcoin Vault',
      };

      // Encrypt with bitcoin-backup (second encryption layer)
      const encrypted = await encryptBackup(vaultBackup, backupPassphrase);

      // Prompt user to save the backup file
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('bitcoin-vault.bep'),
        filters: {
          'Bitcoin Backup Files': ['bep'],
          'All Files': ['*']
        }
      });

      if (uri) {
        // Write encrypted backup to file
        await vscode.workspace.fs.writeFile(uri, Buffer.from(encrypted, 'utf-8'));
        vscode.window.showInformationMessage(`Vault backup saved to ${uri.fsPath}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to export vault: ${errorMessage}`);
    }
  }

  /**
   * Handle importing vault backup using bitcoin-backup library
   */
  private async handleImportVault(webviewView: vscode.WebviewView) {
    try {
      const { decryptBackup } = await import('bitcoin-backup');

      // Step 1: Select backup file
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'Bitcoin Backup Files': ['bep'],
          'All Files': ['*']
        },
        title: 'Select Vault Backup File'
      });

      if (!uris || uris.length === 0) {
        return;
      }

      // Step 2: Read encrypted backup
      const fileContent = await vscode.workspace.fs.readFile(uris[0]);
      const encryptedBackup = Buffer.from(fileContent).toString('utf-8');

      // Step 3: Prompt for backup passphrase
      const backupPassphrase = await vscode.window.showInputBox({
        prompt: 'Enter backup passphrase',
        password: true,
        placeHolder: 'Passphrase used when creating backup'
      });

      if (!backupPassphrase) {
        return;
      }

      // Step 4: Decrypt backup (first layer)
      let vaultBackup: VaultBackup;
      try {
        const decrypted = await decryptBackup(encryptedBackup, backupPassphrase);
        vaultBackup = decrypted as VaultBackup;
      } catch (error) {
        throw new Error('Failed to decrypt backup. Check your passphrase.');
      }

      // Step 5: Show import preview with vault info
      const currentStats = this._vault.getVaultStats();
      const existingKeyCount = currentStats?.totalKeys ?? 0;
      const importedKeyCount = vaultBackup.keyCount ?? 0;

      // Step 6: Warning - this will REPLACE the vault
      const action = await vscode.window.showWarningMessage(
        `⚠️  VAULT IMPORT WARNING\n\n` +
        `Backup: ${vaultBackup.label || 'Unnamed'}\n` +
        `Keys to import: ${importedKeyCount}\n` +
        `Current vault keys: ${existingKeyCount}\n\n` +
        `This will REPLACE your current vault entirely.\n` +
        `All existing keys will be lost unless you have a backup.\n\n` +
        `Are you ABSOLUTELY SURE you want to continue?`,
        { modal: true },
        'Cancel',
        'Replace Vault'
      );

      if (action !== 'Replace Vault') {
        vscode.window.showInformationMessage('Import cancelled');
        return;
      }

      // Step 7: Final confirmation with password verification
      const finalConfirm = await vscode.window.showWarningMessage(
        `⛔ FINAL CONFIRMATION\n\n` +
        `This action CANNOT be undone.\n` +
        `Your current vault with ${existingKeyCount} key(s) will be permanently replaced.\n\n` +
        `Type "REPLACE" to confirm:`,
        { modal: true },
        'Cancel'
      );

      if (finalConfirm !== 'Cancel') {
        const typed = await vscode.window.showInputBox({
          prompt: 'Type REPLACE in all caps to confirm',
          placeHolder: 'REPLACE',
          validateInput: (value) => {
            return value === 'REPLACE' ? null : 'Must type REPLACE exactly';
          }
        });

        if (typed !== 'REPLACE') {
          vscode.window.showInformationMessage('Import cancelled');
          return;
        }
      } else {
        vscode.window.showInformationMessage('Import cancelled');
        return;
      }

      // Step 8: Import the vault
      await this._vault.importVaultBackup(vaultBackup.encryptedVault);

      vscode.window.showInformationMessage(
        `Vault backup imported successfully!\n` +
        `Please unlock your vault with the vault password (NOT the backup passphrase).`
      );

      // Refresh vault stats
      await this.handleGetVaultStats(webviewView);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to import vault: ${errorMessage}`);
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src https://ordfs.network data:;">
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
