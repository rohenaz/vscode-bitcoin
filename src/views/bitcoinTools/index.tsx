import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { KeyVault } from '../../keyVault';
import { walletState } from '../../services/walletState';
import { transactionService, TransactionError } from '../../services/transactionService';
import { ordinalsService } from '../../services/ordinalsService';
import { tokenTransferService } from '../../services/tokenTransferService';
import { ordinalTransferService } from '../../services/ordinalTransferService';
import { PrivateKey, Script, Transaction, LockingScript, UnlockingScript } from '@bsv/sdk';
import type { VaultBackup } from 'bitcoin-backup';
import { encryptBackup, decryptBackup } from 'bitcoin-backup';
import { detectFormat, convertData } from '../../utils';
import { ScriptExecutor } from '../../utils/scriptExecutor';
import { BapService } from '../../bapService';
import { BapPanel } from '../../bapPanel';

export class BitcoinToolsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bitcoin.toolsView';
  private _view?: vscode.WebviewView;
  private scriptExecutors: Map<string, any> = new Map(); // Will hold ScriptExecutor instances

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _vault: KeyVault
  ) {
    // Listen for vault unlock events to update vault stats
    this._vault.onDidUnlock(() => {
      if (this._view) {
        this.handleGetVaultStats(this._view);
      }
    });

    // Listen for key changes to update vault stats
    this._vault.onDidChangeKeys(() => {
      if (this._view) {
        console.log('[BitcoinToolsView] Keys changed, broadcasting vault stats');
        this.handleGetVaultStats(this._view);
      }
    });
  }

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
            case 'wallet:enableBsv20':
              await this.handleToggleBsv20(webviewView, true);
              break;
            case 'wallet:disableBsv20':
              await this.handleToggleBsv20(webviewView, false);
              break;
            case 'wallet:enableBsv21':
              await this.handleToggleBsv21(webviewView, true);
              break;
            case 'wallet:disableBsv21':
              await this.handleToggleBsv21(webviewView, false);
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

        // Handle ordinal transfer messages
        if (message.type.startsWith('ordinal:transfer:')) {
          switch (message.type) {
            case 'ordinal:transfer:estimate':
              await this.handleTransferOrdinalEstimate(webviewView, message.data);
              break;
            case 'ordinal:transfer:send':
              await this.handleTransferOrdinal(webviewView, message.data);
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
              await this.handleExportVault(webviewView, message.data);
              break;
            case 'vault:import':
              await this.handleImportVault(webviewView);
              break;
          }
          return;
        }

        // Handle BAP identity messages
        if (message.type === 'getIdentities') {
          await this.handleGetIdentities(webviewView);
          return;
        }
        if (message.type === 'discoverIdentities') {
          await this.handleDiscoverIdentities(webviewView);
          return;
        }
        if (message.type === 'createIdentity') {
          await this.handleCreateIdentity(webviewView, message.name);
          return;
        }
        if (message.type === 'viewProfile') {
          await this.handleViewProfile(webviewView, message.idKey);
          return;
        }
        if (message.type === 'setIdentityKey') {
          vscode.commands.executeCommand('bitcoin.showKeyVault');
          return;
        }
        if (message.type === 'openKeyVault') {
          // Open key vault and optionally scroll to specific designation
          vscode.commands.executeCommand('bitcoin.showKeyVault', message.data?.scrollTo);
          return;
        }

        // Handle transaction decode messages
        if (message.type === 'transaction:decode') {
          await this.handleTransactionDecode(webviewView, message.data);
          return;
        }

        // Handle open transaction in window
        if (message.type === 'transaction:openInWindow') {
          vscode.commands.executeCommand('bitcoin.openTransactionDecoder', message.data?.rawTxHex);
          return;
        }

        // Handle transaction broadcast messages
        if (message.type === 'transaction:broadcast') {
          await this.handleTransactionBroadcast(webviewView, message.data);
          return;
        }

        // Handle script execution messages
        if (message.type === 'transaction:executeScript') {
          // Check if this is standalone script execution or transaction-based
          if (message.data.script && !message.data.sourceTXID) {
            await this.handleStandaloneScriptExecution(webviewView, message.data);
          } else {
            await this.handleExecuteScript(webviewView, message.data);
          }
          return;
        }

        // Handle script executor lifecycle messages
        if (message.type.startsWith('scriptExecutor:')) {
          await this.handleScriptExecutorMessage(webviewView, message);
          return;
        }

        // Handle data conversion messages
        switch (message.type) {
          case 'detect':
            const detected = detectFormat(message.input);
            webviewView.webview.postMessage({ type: 'detected', format: detected });
            break;
          case 'convert':
            try {
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
        // Handle openSettings command
        if (message.command === 'openSettings') {
          await vscode.commands.executeCommand('workbench.action.openSettings', message.setting);
          return;
        }
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
   * Handle toggling BSV-20 tokens
   */
  private async handleToggleBsv20(webviewView: vscode.WebviewView, enable: boolean) {
    try {
      // Update configuration
      await vscode.workspace.getConfiguration('bitcoin.wallet').update('showBsv20', enable, vscode.ConfigurationTarget.Global);

      // Refresh wallet data to fetch/clear BSV-20 tokens
      await walletState.refreshAllData();
    } catch (error) {
      console.error('Error toggling BSV-20:', error);
      vscode.window.showErrorMessage(`Failed to ${enable ? 'enable' : 'disable'} BSV-20 tokens`);
    }
  }

  /**
   * Handle toggling BSV-21 tokens
   */
  private async handleToggleBsv21(webviewView: vscode.WebviewView, enable: boolean) {
    try {
      // Update configuration
      await vscode.workspace.getConfiguration('bitcoin.wallet').update('showBsv21', enable, vscode.ConfigurationTarget.Global);

      // Refresh wallet data to fetch/clear BSV-21 tokens
      await walletState.refreshAllData();
    } catch (error) {
      console.error('Error toggling BSV-21:', error);
      vscode.window.showErrorMessage(`Failed to ${enable ? 'enable' : 'disable'} BSV-21 tokens`);
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

      // Check autoBroadcast setting
      const autoBroadcast = vscode.workspace.getConfiguration('bitcoin.wallet').get('autoBroadcast', false);

      if (!autoBroadcast) {
        // Open in transaction decoder window instead of broadcasting
        vscode.commands.executeCommand('bitcoin.openTransactionDecoder', rawTx);

        vscode.window.showInformationMessage(
          'Transaction created. Review in the Transaction Decoder and broadcast when ready.'
        );

        // Return success to close dialog
        webviewView.webview.postMessage({
          type: 'wallet:sendBsv:result',
          data: {
            success: true,
            fee: result.fee,
            message: 'Transaction ready for review',
          },
        });
        return;
      }

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
   * Handle ordinal transfer estimate request
   */
  private async handleTransferOrdinalEstimate(
    webviewView: vscode.WebviewView,
    data: { nfts: any[]; recipientAddress: string }
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

      // Fetch payment UTXOs
      const paymentUtxos = await ordinalsService.getPaymentUtxos(payAddress);
      if (paymentUtxos.length === 0) {
        throw new Error('No payment UTXOs available');
      }

      // Convert NFTs to Utxo format
      const ordinals = data.nfts.map(nft => ordinalTransferService.nftToUtxo(nft));

      // Estimate fee
      const estimate = await ordinalTransferService.estimateTransferFee({
        ordinals,
        paymentUtxos,
        paymentPk: PrivateKey.fromWif(fundingKey.value),
        ordPk: PrivateKey.fromWif(ordinalsKey.value),
        recipientAddress: data.recipientAddress,
        changeAddress: payAddress,
      });

      // Send estimate back to webview
      webviewView.webview.postMessage({
        type: 'ordinal:transfer:estimateResult',
        data: estimate,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'ordinal:transfer:estimateResult',
        data: {
          success: false,
          error: errorMessage,
        },
      });
    }
  }

  /**
   * Handle ordinal transfer transaction
   */
  private async handleTransferOrdinal(
    webviewView: vscode.WebviewView,
    data: { nfts: any[]; recipientAddress: string }
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

      // Fetch fresh payment UTXOs
      const paymentUtxos = await ordinalsService.getPaymentUtxos(payAddress);
      if (paymentUtxos.length === 0) {
        throw new Error('No payment UTXOs available');
      }

      // Convert NFTs to Utxo format
      const ordinals = data.nfts.map(nft => ordinalTransferService.nftToUtxo(nft));

      // Execute transfer
      const result = await ordinalTransferService.transferOrdinals({
        ordinals,
        paymentUtxos,
        paymentPk: PrivateKey.fromWif(fundingKey.value),
        ordPk: PrivateKey.fromWif(ordinalsKey.value),
        recipientAddress: data.recipientAddress,
        changeAddress: payAddress,
      });

      // Get raw transaction hex
      const rawTx = result.tx.toHex();

      // Broadcast transaction
      const broadcastResult = await transactionService.broadcastTransaction(rawTx);

      if (broadcastResult.status === 'success') {
        // Success
        webviewView.webview.postMessage({
          type: 'ordinal:transfer:result',
          data: {
            success: true,
            txid: broadcastResult.txid,
            fee: result.fee,
          },
        });

        // Show success notification
        vscode.window.showInformationMessage(
          `${data.nfts.length} ordinal${data.nfts.length > 1 ? 's' : ''} sent successfully! ${broadcastResult.txid?.slice(0, 8)}...`
        );

        // Refresh wallet data
        await walletState.refreshAllData();
      } else {
        throw new Error(broadcastResult.message || 'Broadcast failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      webviewView.webview.postMessage({
        type: 'ordinal:transfer:result',
        data: {
          success: false,
          error: errorMessage,
        },
      });

      // Show error notification
      vscode.window.showErrorMessage(`Ordinal transfer failed: ${errorMessage}`);
    }
  }

  /**
   * Handle transaction decode request
   */
  private async handleTransactionDecode(
    webviewView: vscode.WebviewView,
    data: { rawTx: string }
  ) {
    try {
      const tx = Transaction.fromHex(data.rawTx);

      const decodedTx = {
        txid: tx.id('hex') as string,
        version: tx.version,
        lockTime: tx.lockTime,
        size: data.rawTx.length / 2,
        inputs: tx.inputs.map((input, index) => ({
          index,
          sourceTXID: input.sourceTXID?.toString() || '',
          sourceOutputIndex: input.sourceOutputIndex,
          unlockingScript: input.unlockingScript?.toHex() || '',
          unlockingScriptAsm: input.unlockingScript?.toASM() || '',
          sequence: input.sequence
        })),
        outputs: tx.outputs.map((output, index) => ({
          index,
          satoshis: output.satoshis || 0,
          lockingScript: output.lockingScript.toHex(),
          lockingScriptAsm: output.lockingScript.toASM()
        }))
      };

      webviewView.webview.postMessage({
        type: 'transaction:decoded',
        data: decodedTx
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'transaction:decode:error',
        data: { error: `Failed to decode transaction: ${errorMessage}` }
      });
    }
  }

  /**
   * Handle transaction broadcast request
   */
  private async handleTransactionBroadcast(
    webviewView: vscode.WebviewView,
    data: { rawTx: string }
  ) {
    try {
      const broadcastResult = await transactionService.broadcastTransaction(data.rawTx);

      if (broadcastResult.status === 'success') {
        webviewView.webview.postMessage({
          type: 'transaction:broadcast:result',
          data: {
            success: true,
            txid: broadcastResult.txid,
            message: broadcastResult.message,
          },
        });

        vscode.window.showInformationMessage(
          `Transaction broadcast successfully! ${broadcastResult.txid?.slice(0, 8)}...`
        );
      } else {
        throw new Error(broadcastResult.message || 'Broadcast failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'transaction:broadcast:result',
        data: {
          success: false,
          error: errorMessage,
        },
      });

      vscode.window.showErrorMessage(`Broadcast failed: ${errorMessage}`);
    }
  }

  /**
   * Handle standalone script execution (no transaction context)
   */
  private async handleStandaloneScriptExecution(
    webviewView: vscode.WebviewView,
    data: { script: string }
  ) {
    try {
      // Parse the script - it can be in hex, ASM, or mixed format
      let script: any;
      const scriptInput = data.script.trim();

      try {
        // Try parsing as ASM first (most common for user input)
        script = Script.fromASM(scriptInput);
      } catch (asmError) {
        try {
          // Try parsing as hex
          script = Script.fromHex(scriptInput);
        } catch (hexError) {
          throw new Error('Invalid script format. Please provide script in ASM or hex format.');
        }
      }

      // For standalone execution, treat the entire script as the locking script
      const lockingScript = script.toHex();
      const lockingScriptAsm = script.toASM();

      // Send to the script executor component
      webviewView.webview.postMessage({
        type: 'script:ready',
        data: {
          spendParams: {
            lockingScript: lockingScript,
            lockingScriptAsm: lockingScriptAsm,
            unlockingScript: '', // Empty unlocking script for standalone
            sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
            sourceOutputIndex: 0,
            satoshis: 0
          }
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'script:error',
        data: { error: errorMessage }
      });
    }
  }

  /**
   * Handle script execution request (from transaction context)
   */
  private async handleExecuteScript(
    webviewView: vscode.WebviewView,
    data: {
      inputIndex: number;
      unlockingScript: string;
      sourceTXID: string;
      sourceOutputIndex: number;
    }
  ) {
    try {
      vscode.window.showInformationMessage(
        `Fetching source transaction ${data.sourceTXID.slice(0, 8)}... to execute script`
      );

      // Fetch the source transaction to get the locking script
      const response = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${data.sourceTXID}/hex`);
      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }

      const sourceRawTx = await response.text();
      const sourceTx = Transaction.fromHex(sourceRawTx);

      // Get the locking script from the source output
      const sourceOutput = sourceTx.outputs[data.sourceOutputIndex];
      if (!sourceOutput) {
        throw new Error(`Source output ${data.sourceOutputIndex} not found in transaction`);
      }

      const lockingScript = sourceOutput.lockingScript.toHex();
      const lockingScriptAsm = sourceOutput.lockingScript.toASM();
      const satoshis = sourceOutput.satoshis || 0;

      // Send script execution data to webview
      webviewView.webview.postMessage({
        type: 'scriptExecutor:show',
        data: {
          inputIndex: data.inputIndex,
          unlockingScript: data.unlockingScript,
          lockingScript: lockingScript,
          lockingScriptAsm: lockingScriptAsm,
          sourceTXID: data.sourceTXID,
          sourceOutputIndex: data.sourceOutputIndex,
          satoshis: satoshis
        }
      });

      vscode.window.showInformationMessage(
        `Script executor ready for input #${data.inputIndex}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to execute script: ${errorMessage}`);

      webviewView.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { error: errorMessage }
      });
    }
  }

  /**
   * Handle script executor lifecycle messages
   */
  private async handleScriptExecutorMessage(
    webviewView: vscode.WebviewView,
    message: any
  ) {
    try {
      const { type, data } = message;
      const { id } = data;

      switch (type) {
        case 'scriptExecutor:init':
          await this.initScriptExecutor(webviewView, id, data.spendParams);
          break;

        case 'scriptExecutor:stepForward':
          await this.stepExecutorForward(webviewView, id);
          break;

        case 'scriptExecutor:stepBackward':
          await this.stepExecutorBackward(webviewView, id);
          break;

        case 'scriptExecutor:runToEnd':
          await this.runExecutorToEnd(webviewView, id);
          break;

        case 'scriptExecutor:reset':
          await this.resetExecutor(webviewView, id);
          break;

        case 'scriptExecutor:destroy':
          this.scriptExecutors.delete(id);
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Script executor error: ${errorMessage}`);
    }
  }

  /**
   * Initialize a new script executor instance
   */
  private async initScriptExecutor(
    webviewView: vscode.WebviewView,
    id: string,
    spendParams: any
  ) {
    try {
      // Create new executor instance
      const executor = new ScriptExecutor(spendParams);
      this.scriptExecutors.set(id, executor);

      // Parse scripts to get chunks for display
      const unlockingScript = UnlockingScript.fromHex(spendParams.unlockingScript);
      const lockingScript = LockingScript.fromHex(spendParams.lockingScript);

      const unlockingChunks = unlockingScript.chunks.map((chunk: any) => ({
        op: chunk.op,
        data: chunk.data ? Array.from(chunk.data) : undefined
      }));

      const lockingChunks = lockingScript.chunks.map((chunk: any) => ({
        op: chunk.op,
        data: chunk.data ? Array.from(chunk.data) : undefined
      }));

      // Send back initialization success with script chunks
      webviewView.webview.postMessage({
        type: 'scriptExecutor:initialized',
        data: {
          id,
          unlockingScript: { chunks: unlockingChunks },
          lockingScript: { chunks: lockingChunks }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      });
    }
  }

  /**
   * Step executor forward one opcode
   */
  private async stepExecutorForward(webviewView: vscode.WebviewView, id: string) {
    const executor = this.scriptExecutors.get(id);
    if (!executor) {
      return;
    }

    try {
      const step = executor.stepForward();

      if (step) {
        webviewView.webview.postMessage({
          type: 'scriptExecutor:step',
          data: { id, step }
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      });
    }
  }

  /**
   * Step executor backward one opcode
   */
  private async stepExecutorBackward(webviewView: vscode.WebviewView, id: string) {
    const executor = this.scriptExecutors.get(id);
    if (!executor) {
      return;
    }

    try {
      const step = executor.stepBackward();

      if (step) {
        webviewView.webview.postMessage({
          type: 'scriptExecutor:step',
          data: { id, step }
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      });
    }
  }

  /**
   * Run executor to completion
   */
  private async runExecutorToEnd(webviewView: vscode.WebviewView, id: string) {
    const executor = this.scriptExecutors.get(id);
    if (!executor) {
      return;
    }

    try {
      const steps = executor.runToEnd();

      webviewView.webview.postMessage({
        type: 'scriptExecutor:runComplete',
        data: { id, steps }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      });
    }
  }

  /**
   * Reset executor to initial state
   */
  private async resetExecutor(webviewView: vscode.WebviewView, id: string) {
    const executor = this.scriptExecutors.get(id);
    if (!executor) {
      return;
    }

    try {
      executor.reset();

      webviewView.webview.postMessage({
        type: 'scriptExecutor:reset',
        data: { id }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webviewView.webview.postMessage({
        type: 'scriptExecutor:error',
        data: { id, error: errorMessage }
      });
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
    const isLocked = !this._vault.isUnlocked;

    webviewView.webview.postMessage({
      type: 'vault:stats',
      data: stats ? { ...stats, isLocked } : { isLocked }
    });
  }

  /**
   * Handle exporting vault backup using bitcoin-backup library
   */
  private async handleExportVault(webviewView: vscode.WebviewView, data?: { password?: string }) {
    try {
      // If password provided from dialog, verify it first
      if (data?.password) {
        try {
          // Try to export vault with the provided password to verify it's correct
          await this._vault.exportVaultBackup();
        } catch (error) {
          webviewView.webview.postMessage({
            type: 'vault:export:error',
            data: { error: 'Incorrect vault password' }
          });
          vscode.window.showErrorMessage('Export failed: Incorrect vault password');
          return;
        }
      }

      const vaultData = await this._vault.exportVaultBackup();

      if (!vaultData) {
        vscode.window.showErrorMessage('Vault is empty or not initialized');
        return;
      }

      // Use provided password as backup passphrase, or prompt if not provided
      let backupPassphrase = data?.password;

      if (!backupPassphrase) {
        backupPassphrase = await vscode.window.showInputBox({
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

        // Notify webview of success
        webviewView.webview.postMessage({
          type: 'vault:export:success'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to export vault: ${errorMessage}`);

      // Notify webview of error
      webviewView.webview.postMessage({
        type: 'vault:export:error',
        data: { error: errorMessage }
      });
    }
  }

  /**
   * Handle importing vault backup using bitcoin-backup library
   */
  private async handleImportVault(webviewView: vscode.WebviewView) {
    try {
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

  /**
   * Handle getting identities
   */
  private async handleGetIdentities(webviewView: vscode.WebviewView) {
    try {
      const bapService = new BapService();

      // Get identity key from vault
      const identityKey = await this._vault.getIdentityKey();
      if (!identityKey) {
        // No identity key set, return empty list with flag
        webviewView.webview.postMessage({
          type: 'identitiesUpdated',
          identities: [],
          hasIdentityKey: false,
          isMasterKey: false
        });
        return;
      }

      // Initialize BAP with identity key
      bapService.initializeWithKey(identityKey);

      // Get local identities
      const identities = bapService.getLocalIdentities();
      const isMasterKey = bapService.isMaster();

      webviewView.webview.postMessage({
        type: 'identitiesUpdated',
        identities,
        hasIdentityKey: true,
        isMasterKey
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to load identities: ${errorMessage}`);
    }
  }

  /**
   * Handle discovering identities on-chain
   */
  private async handleDiscoverIdentities(webviewView: vscode.WebviewView) {
    try {
      const bapService = new BapService();

      // Get identity key from vault
      const identityKey = await this._vault.getIdentityKey();
      if (!identityKey) {
        vscode.window.showErrorMessage('No identity key set. Please designate an identity key in Key Vault first.');
        webviewView.webview.postMessage({
          type: 'discoveryComplete'
        });
        return;
      }

      // Initialize BAP with identity key
      bapService.initializeWithKey(identityKey);

      // Discover identities (checks counters 0-9 by default)
      const discovered = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Discovering BAP identities on-chain...',
          cancellable: false
        },
        () => bapService.discoverIdentities(10)
      );

      // Get all identities after discovery
      const allIdentities = bapService.getLocalIdentities();
      const isMasterKey = bapService.isMaster();

      webviewView.webview.postMessage({
        type: 'identitiesUpdated',
        identities: allIdentities,
        hasIdentityKey: true,
        isMasterKey
      });

      webviewView.webview.postMessage({
        type: 'discoveryComplete'
      });

      if (discovered.length > 0) {
        vscode.window.showInformationMessage(`Found ${discovered.length} identity/identities on-chain`);
      } else {
        vscode.window.showInformationMessage('No existing identities found');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Discovery failed: ${errorMessage}`);
      webviewView.webview.postMessage({
        type: 'discoveryComplete'
      });
    }
  }

  /**
   * Handle creating a new identity
   */
  private async handleCreateIdentity(webviewView: vscode.WebviewView, name: string) {
    try {
      const bapService = new BapService();

      // Get identity key from vault
      const identityKey = await this._vault.getIdentityKey();
      if (!identityKey) {
        vscode.window.showErrorMessage('No identity key set. Please designate an identity key in Key Vault first.');
        return;
      }

      // Initialize BAP with identity key
      bapService.initializeWithKey(identityKey);

      // Create identity (master key only)
      const result = bapService.createIdentity(name);
      if (!result) {
        throw new Error('Failed to create identity');
      }

      const { updatedIds } = result;

      // Update the identity key's metadata with new bapIds
      await this._vault.updateKeyMetadata(identityKey.id, { bapIds: updatedIds });

      // Get updated list
      const identities = bapService.getLocalIdentities();
      const isMasterKey = bapService.isMaster();

      webviewView.webview.postMessage({
        type: 'identitiesUpdated',
        identities,
        hasIdentityKey: true,
        isMasterKey
      });

      vscode.window.showInformationMessage(`Created identity: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to create identity: ${errorMessage}`);
    }
  }

  /**
   * Handle viewing a profile
   */
  private async handleViewProfile(webviewView: vscode.WebviewView, idKey: string) {
    try {
      const bapService = new BapService();

      // Fetch profile from indexer
      const profile = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Loading BAP profile...',
          cancellable: false
        },
        () => bapService.getProfile(idKey)
      );

      // Show profile in webview within the tools view
      webviewView.webview.postMessage({
        type: 'profileLoaded',
        profile
      });

      // Also open in separate panel for detailed view
      BapPanel.show(profile);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to load profile: ${errorMessage}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for the unified webview build artifacts
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'webview', 'dist', 'assets', 'index.css')
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
        <script nonce="${nonce}">
          window.PANEL_TYPE = 'bitcoin-tools';
        </script>
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
