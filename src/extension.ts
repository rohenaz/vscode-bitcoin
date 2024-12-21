import * as path from 'node:path';
import {
  HD,
  Mnemonic,
  P2PKH,
  PrivateKey,
  PublicKey,
  Script,
  Transaction,
  Utils,
} from '@bsv/sdk';
import { BMAP, type BobTx, TransformTx, allProtocols } from 'bmapjs';
import { parse } from 'bpu-ts';
import fetch from 'node-fetch';
import { BapPanel } from './bapPanel';
import { BapService } from './bapService';
import { handleAddressFromHDPrivateKeyCommand } from './commands/addressFromHDPrivateKey';
import { handleAddressFromHDPublicKeyCommand } from './commands/addressFromHDPublicKey';
import { handleAddressFromPrivateKeyCommand } from './commands/addressFromPrivateKey';
import { addressFromPublicKey } from './commands/addressFromPublicKey';
import { addressFromWIF } from './commands/addressFromWIF';
import { asmFromScript } from './commands/asmFromScript';
import { handleConvertDataCommand } from './commands/convertData';
import { handleDecodeRawTxCommand } from './commands/decodeRawTx';
import { extendedPrivateKeyFromMnemonic } from './commands/extendedPrivateKeyFromMnemonic';
import { generateMnemonic } from './commands/generateMnemonic';
import { generatePrivateKey } from './commands/generatePrivateKey';
import { generatePublicKey } from './commands/generatePublicKey';
import { generateWIF } from './commands/generateWIF';
import { handleGetTxCommand } from './commands/getTx';
import { handleGetUtxosForAddressCommand } from './commands/getUtxosForAddress';
import { handleLookupBapProfileCommand } from './commands/lookupBapProfile';
import { publicKeyFromPrivateKey } from './commands/publicKeyFromPrivateKey';
import { publicKeyFromWIF } from './commands/publicKeyFromWIF';
import { handleRawTxToBobCommand } from './commands/rawTxToBob';
import { handleXPubFromXPrivCommand } from './commands/xPubFromxPriv';
import { EncryptionService } from './encryption';
import { KeyPanel } from './keyPanel';
import { KeyVault } from './keyVault';
import { OutputManager } from './output';
import vsApi, {
  ExtensionContext,
  WebviewPanel,
  WebviewView,
  WebviewViewProvider,
} from './vsShim';
import { WelcomePanel } from './welcomePanel';
import { WorkspaceManager } from './workspace';
import { handleDecodeFileCommand } from './commands/decodeFile';

const { fromBase58Check, toBase64, toArray } = Utils;

function registerCommand(
  context: ExtensionContext,
  outputManager: OutputManager,
  command: string,
  handler: () => Promise<
    { data: string; type: string; name?: string } | undefined
  >,
): void {
  const disposable = vsApi.commands.registerCommand(command, async () => {
    try {
      const result = await handler();
      if (result) {
        await outputManager.handleOutput(
          result.data,
          command.replace('bitcoin.', ''),
          result.type,
          result.name,
        );
      }
    } catch (error) {
      vsApi.window.showErrorMessage(
        `Command failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  });
  context.subscriptions.push(disposable);
}

interface Utxo {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
}

const API_HOST = 'https://ordinals.gorillapool.io/api';

const fetchPayUtxos = async (
  address: string,
  scriptEncoding: 'hex' | 'base64' | 'asm' = 'base64',
): Promise<Utxo[]> => {
  const payUrl = `${API_HOST}/txos/address/${address}/unspent?bsv20=false`;
  console.log({ payUrl });
  const payRes = await fetch(payUrl);
  if (payRes.status === 404) {
    return []; // No UTXOs found for this address
  }
  if (!payRes.ok) {
    const error = await payRes
      .json()
      .catch(() => ({ message: payRes.statusText }));
    // If it's a checksum mismatch, it might be a BAP ID
    if (error.message === 'Checksum mismatch') {
      throw new Error(
        'Invalid address format. If this is a BAP ID, please use the BAP lookup command instead.',
      );
    }
    throw new Error(
      `Error fetching pay utxos: ${payRes.status} ${
        error.message || payRes.statusText
      }`,
    );
  }
  let payUtxos = await payRes.json();
  // exclude all 1 satoshi utxos and locked utxos
  payUtxos = payUtxos.filter(
    (u: Utxo & { lock?: { address: string; until: number } }) =>
      u.satoshis !== 1 && !u.lock,
  );

  // Get pubkey hash from address
  const pubKeyHash = fromBase58Check(address);
  const p2pkhScript = new P2PKH().lock(pubKeyHash.data);
  payUtxos = payUtxos.map((utxo: Partial<Utxo>) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    satoshis: utxo.satoshis,
    script:
      scriptEncoding === 'hex' || scriptEncoding === 'base64'
        ? Buffer.from(p2pkhScript.toBinary()).toString(scriptEncoding)
        : p2pkhScript.toASM(),
  }));
  return payUtxos as Utxo[];
};

export type ImageContentType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/svg+xml'
  | 'image/webp';

export type TokenInscription = {
  p: 'bsv-20';
  amt: string;
  op: 'transfer' | 'mint' | 'deploy+mint' | 'burn';
  dec?: string;
};

export interface TransferTokenInscription extends TokenInscription {
  p: 'bsv-20';
  amt: string;
  op: 'transfer' | 'burn';
}

export interface TransferBSV20Inscription extends TransferTokenInscription {
  tick: string;
}

export interface TransferBSV21Inscription extends TransferTokenInscription {
  id: string;
}

export enum TokenType {
  BSV20 = 'bsv20',
  BSV21 = 'bsv21',
}

interface Inscription {
  txid: string;
  vout: number;
  outpoint: string;
  data?: {
    insc?: {
      file?: {
        hash: string;
        size: number;
        type: string | ImageContentType;
      };
      json?:
        | TokenInscription
        | TransferBSV20Inscription
        | TransferBSV21Inscription;
    };
    types?: string[];
    bsv20?: {
      id: string;
      op: 'transfer' | 'mint' | 'deploy+mint' | 'burn';
      amt: number;
      listing?: boolean;
    };
  };
  origin?: {
    data?: {
      insc?: {
        file?: {
          hash: string;
          size: number;
          type: string | ImageContentType;
        };
        json?:
          | TokenInscription
          | TransferBSV20Inscription
          | TransferBSV21Inscription;
      };
    };
    num?: string;
  };
}

const fetchInscriptionData = async (outpoint: string): Promise<Inscription> => {
  const url = `${API_HOST}/txos/${outpoint}`;
  console.log({ url });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Error fetching inscription: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};

const fetchInscriptionContent = async (
  inscription: Inscription,
): Promise<string | undefined> => {
  // First check if content is in the inscription data
  if (inscription.data?.insc?.json) {
    return JSON.stringify(inscription.data.insc.json, null, 2);
  }

  // If not, try to fetch from content endpoint
  const url = `${API_HOST}/content/${inscription.outpoint}`;
  console.log({ url });
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      return undefined;
    }
    throw new Error(
      `Error fetching inscription content: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
};

export async function activate(context: ExtensionContext) {
  console.log('Bitcoin extension activating...');

  // We can skip the welcome screen if in test env
  const isTestMode = process.env.TEST_ENV === 'true';

  // Construct managers
  const workspaceManager = new WorkspaceManager();
  const keyVault = new KeyVault(context);
  const encryptionService = new EncryptionService(keyVault);
  const outputManager = new OutputManager();

  // Register openConversionTool command
  const openConversionToolDisposable = vsApi.commands.registerCommand(
    'bitcoin.openConversionTool',
    async () => {
      try {
        // Get selected text if any
        const editor = vsApi.window.activeTextEditor;
        const selectedText = editor?.selection && !editor.selection.isEmpty
          ? editor.document.getText(editor.selection)
          : undefined;

        // Create and show webview panel
        const panel = vsApi.window.createWebviewPanel(
          'bitcoinConversion',
          'Bitcoin Conversion Tool',
          vsApi.window.activeTextEditor?.viewColumn || 1,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        // Set webview content
        panel.webview.html = getConversionWebviewContent(selectedText);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
          async (message) => {
            switch (message.command) {
              case 'convert': {
                try {
                  const doc = await vsApi.workspace.openTextDocument({
                    language: 'text',
                    content: message.result,
                  });
                  await vsApi.window.showTextDocument(doc, { preview: false });
                } catch (e) {
                  console.error(e);
                  vsApi.window.showErrorMessage(
                    `Failed to show conversion result: ${e instanceof Error ? e.message : 'Unknown error'}`
                  );
                }
                break;
              }
            }
          },
          undefined,
          context.subscriptions
        );
      } catch (e) {
        console.error(e);
        vsApi.window.showErrorMessage(
          `Failed to open conversion tool: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
      }
    }
  );
  context.subscriptions.push(openConversionToolDisposable);

  // Register other commands...
  registerCommand(context, outputManager, 'bitcoin.convertData', () =>
    handleConvertDataCommand()
  );

  // Register show key vault command
  const showKeyVaultCommand = vsApi.commands.registerCommand(
    'bitcoin.showKeyVault',
    () => {
      KeyPanel.show(keyVault);
    },
  );
  context.subscriptions.push(showKeyVaultCommand);

  // Register test command
  const testCommand = vsApi.commands.registerCommand('bitcoin.test', () => {
    console.log('Test command executed');
    vsApi.window.showInformationMessage('Test command works!');
  });
  context.subscriptions.push(testCommand);

  // Register detect and convert command
  registerCommand(
    context,
    outputManager,
    'bitcoin.decodeFile',
    async () => handleDecodeFileCommand(outputManager),
  );

  // Register key generation commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.generateHDPublicKey',
    async () => {
      const hdPrivKey = HD.fromRandom();
      const hdPubKey = hdPrivKey.toPublic();
      const value = hdPubKey.toString();

      // Store in vault
      await keyVault.storeKey({
        type: 'hdpublic',
        value,
        label: 'Generated HD Public Key',
      });

      return {
        data: value,
        type: 'keys',
        name: 'hdpubkey',
      };
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.generateHDPrivateKey',
    async () => {
      const hdPrivKey = HD.fromRandom();
      const value = hdPrivKey.toString();

      // Store in vault
      await keyVault.storeKey({
        type: 'hdprivate',
        value,
        label: 'Generated HD Private Key',
      });

      return {
        data: value,
        type: 'keys',
        name: 'hdprivkey',
      };
    },
  );

  registerCommand(context, outputManager, 'bitcoin.xPubFromxPriv', async () => {
    return handleXPubFromXPrivCommand(outputManager);
  });

  // Register address generation commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromHDPublicKey',
    async () => {
      return handleAddressFromHDPublicKeyCommand(outputManager);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromHDPrivateKey',
    async () => {
      return handleAddressFromHDPrivateKeyCommand(outputManager);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromPublicKey',
    async () => {
      return addressFromPublicKey(outputManager);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromPrivateKey',
    async () => {
      return handleAddressFromPrivateKeyCommand(outputManager);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromWIF',
    async () => {
      return addressFromWIF(outputManager);
    },
  );

  // Register transaction commands
  registerCommand(context, outputManager, 'bitcoin.getTx', async () => {
    return handleGetTxCommand(outputManager);
  });

  registerCommand(context, outputManager, 'bitcoin.decodeRawTx', async () => {
    return handleDecodeRawTxCommand(outputManager);
  });

  registerCommand(context, outputManager, 'bitcoin.rawTxToBob', async () => {
    return handleRawTxToBobCommand(outputManager);
  });

  // Register UTXO commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.getUtxosForAddress',
    async () => {
      return handleGetUtxosForAddressCommand(outputManager);
    },
  );

  // Register script commands
  registerCommand(context, outputManager, 'bitcoin.asmFromScript', async () => {
    return asmFromScript(outputManager);
  });

  // Register key generation commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.generatePrivateKey',
    async () => {
      return generatePrivateKey(outputManager, keyVault);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.generatePublicKey',
    async () => {
      return generatePublicKey(outputManager);
    },
  );

  registerCommand(context, outputManager, 'bitcoin.generateWIF', async () => {
    return generateWIF(outputManager, keyVault);
  });

  registerCommand(
    context,
    outputManager,
    'bitcoin.generateMnemonic',
    async () => {
      return generateMnemonic(outputManager, keyVault);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.extendedPrivateKeyFromMnemonic',
    async () => {
      return extendedPrivateKeyFromMnemonic(outputManager);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.publicKeyFromPrivateKey',
    async () => {
      return publicKeyFromPrivateKey(outputManager);
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.publicKeyFromWIF',
    async () => {
      return publicKeyFromWIF(outputManager);
    },
  );

  // Register output handler
  context.subscriptions.push(
    vsApi.commands.registerCommand(
      'bitcoin.handleOutput',
      async (output: string, type: string, suggestedName?: string) => {
        const config = vsApi.workspace.getConfiguration('bitcoin');
        const preference = config.get('outputPreference') as string;

        try {
          switch (preference) {
            case 'workspace': {
              const uri = await workspaceManager.saveFile(
                output,
                type,
                suggestedName,
              );
              vsApi.window.showInformationMessage(
                `Output saved to ${vsApi.workspace.asRelativePath(uri.fsPath)}`,
              );
              break;
            }

            case 'file': {
              const fileUri = await vsApi.window.showSaveDialog({
                defaultUri: vsApi.Uri.file(
                  suggestedName ?? `${type}_${Date.now()}.txt`,
                ),
                filters: { 'Text files': ['txt'] },
              });
              if (fileUri) {
                await vsApi.workspace.fs.writeFile(
                  fileUri,
                  Buffer.from(output),
                );
                vsApi.window.showInformationMessage(
                  `Output saved to ${vsApi.workspace.asRelativePath(fileUri)}`,
                );
              }
              break;
            }

            default: {
              // Handle clipboard (default case)
              await vsApi.env.clipboard.writeText(output);
              const changeSettings = 'Change Output Settings';
              const result = await vsApi.window.showInformationMessage(
                'Output copied to clipboard!',
                changeSettings,
              );
              if (result === changeSettings) {
                await vsApi.commands.executeCommand(
                  'workbench.action.openSettings',
                  'bitcoin.outputPreference',
                );
              }
              break;
            }
          }
        } catch (error) {
          vsApi.window.showErrorMessage(
            `Error handling output: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    ),
  );

  // Register encryption and decryption commands
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.encrypt', async () => {
      try {
        // Get active text editor
        const editor = vsApi.window.activeTextEditor;
        if (!editor) {
          vsApi.window.showErrorMessage('No active text editor');
          return;
        }

        // Get selected text or entire document
        const selection = editor.selection;
        const text = selection.isEmpty
          ? editor.document.getText()
          : editor.document.getText(selection);

        if (!text) {
          vsApi.window.showErrorMessage('No text to encrypt');
          return;
        }

        // Get encryption key
        const key = await encryptionService.promptForKey('encrypt');
        if (!key) {
          return; // User cancelled
        }

        // Generate filename from source
        const fileName =
          editor.document.uri.fsPath.split('/').pop() || 'unknown';

        // Encrypt the data
        const { encryptedData, privateKey } = await encryptionService.encrypt(
          text,
          key,
          {
            fileName,
            command: 'bitcoin.encrypt',
          },
        );

        // Save the encrypted data
        const uri = await workspaceManager.saveFile(
          encryptedData,
          'encrypted',
          `encrypted_${fileName}.dat`,
        );

        // Show success message with key
        const wif = privateKey.toWif();
        await vsApi.window.showInformationMessage(
          'Data encrypted and saved. Keep this key safe:',
          { modal: true },
        );
        await vsApi.window.showInformationMessage(wif, { modal: true });

        // Open the encrypted file
        const doc = await vsApi.workspace.openTextDocument(uri.fsPath);
        await vsApi.window.showTextDocument(doc);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Encryption failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),

    vsApi.commands.registerCommand('bitcoin.decrypt', async () => {
      try {
        // Get active text editor
        const editor = vsApi.window.activeTextEditor;
        if (!editor) {
          vsApi.window.showErrorMessage('No active text editor');
          return;
        }

        // Get selected text or entire document
        const selection = editor.selection;
        const text = selection.isEmpty
          ? editor.document.getText()
          : editor.document.getText(selection);

        if (!text) {
          vsApi.window.showErrorMessage('No text to decrypt');
          return;
        }

        // Get decryption key
        const key = await encryptionService.promptForKey('decrypt');
        if (!key) {
          return; // User cancelled
        }

        // Decrypt the data
        const decrypted = await encryptionService.decrypt(text, key);

        // Create new document with decrypted content
        const doc = await vsApi.workspace.openTextDocument({
          content: decrypted.toString(),
          language: 'plaintext',
        });
        await vsApi.window.showTextDocument(doc);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Decryption failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),
  );

  // Register BAP profile lookup command
  registerCommand(
    context,
    outputManager,
    'bitcoin.lookupBapProfile',
    async () => {
      return handleLookupBapProfileCommand(outputManager);
    },
  );

  // Register fetch ordinals inscription command
  registerCommand(
    context,
    outputManager,
    'bitcoin.fetchOrdinalsInscription',
    async () => {
      const outpoint = await vsApi.window.showInputBox({
        value: '',
        placeHolder:
          'Ex: 027cea24351db7081089108b59916e5c5e90893233a872266c013f7665c53758_1',
        validateInput: (text) => {
          return text.match(/^[a-fA-F0-9]{64}_[0-9]+$/)
            ? null
            : 'Invalid outpoint format. Expected: txid_vout';
        },
      });

      if (!outpoint) {
        return undefined;
      }

      try {
        // First fetch inscription metadata
        const inscription = await fetchInscriptionData(outpoint);

        // Then fetch or extract the content
        const content = await fetchInscriptionContent(inscription);

        if (!content) {
          throw new Error('No inscription content found');
        }

        // Try to parse as JSON for formatting
        try {
          const jsonContent = JSON.parse(content);
          return {
            data: JSON.stringify(jsonContent, null, 2),
            type: 'inscriptions',
            name: `inscription_${outpoint.replace('_', '-')}`,
          };
        } catch {
          // Not JSON, return as is
          return {
            data: content,
            type: 'inscriptions',
            name: `inscription_${outpoint.replace('_', '-')}`,
          };
        }
      } catch (error) {
        console.error('Inscription fetch error:', error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch inscription from ${API_HOST}/txos/${outpoint}\nError: ${errorMessage}`,
        );
      }
    },
  );

  // Add command to reset welcome screen
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.resetWelcomeScreen', async () => {
      await context.globalState.update('bitcoin.hasShownWelcome', false);
      vsApi.window.showInformationMessage(
        'Welcome screen has been reset. Please reload VS Code to see it.',
      );
    }),
  );

  console.log('Bitcoin extension activated successfully!');
}

// this method is called when your extension is deactivated
export function deactivate() {}

function getConversionWebviewContent(initialInput?: string) {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bitcoin Conversion Tool</title>
      <style>
        body {
          padding: 20px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        select, input, button {
          margin: 5px 0;
          padding: 5px;
          font-family: var(--vscode-font-family);
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        textarea {
          width: 100%;
          min-height: 100px;
          margin: 10px 0;
          padding: 8px;
          font-family: var(--vscode-editor-font-family);
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
        }
        .error {
          color: var(--vscode-errorForeground);
          margin-top: 5px;
          display: none;
        }
        .output-group {
          margin-top: 20px;
          display: none;
        }
        .output-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }
        .copy-button {
          padding: 4px 8px;
          font-size: 12px;
        }
        #output {
          background-color: var(--vscode-input-background);
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="form-group">
        <label for="input">Input:</label>
        <textarea id="input" placeholder="Enter text to convert">${initialInput || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="fromFormat">From Format:</label>
        <select id="fromFormat">
          <option value="utf8">UTF-8</option>
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
          <option value="binary">Binary Array</option>
        </select>
      </div>
      <div class="form-group">
        <label for="toFormat">To Format:</label>
        <select id="toFormat">
          <option value="utf8">UTF-8</option>
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
          <option value="binary">Binary Array</option>
        </select>
      </div>
      <button onclick="convert()">Convert</button>
      <div id="error" class="error"></div>
      <div class="output-group">
        <div class="output-header">
          <label for="output">Output:</label>
          <button onclick="copyOutput()" class="copy-button">Copy</button>
        </div>
        <textarea id="output" readonly></textarea>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let fromFormat = document.getElementById('fromFormat');
        let toFormat = document.getElementById('toFormat');
        let input = document.getElementById('input');
        let output = document.getElementById('output');
        let error = document.getElementById('error');
        let outputGroup = document.querySelector('.output-group');

        function detectFormat(input) {
          // Try binary array first (most specific format)
          if (/^\[(\d+,)*\d+\]$/.test(input)) {
            fromFormat.value = 'binary';
            return;
          }
          
          // Try base64 (specific pattern with padding)
          try {
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
              const decoded = atob(input);
              fromFormat.value = 'base64';
              return;
            }
          } catch {}
          
          // Try hex (must be even length and only hex chars)
          if (/^[0-9A-Fa-f]+$/.test(input) && input.length % 2 === 0) {
            fromFormat.value = 'hex';
            return;
          }

          // Default to UTF-8 for anything else
          fromFormat.value = 'utf8';
        }

        input.addEventListener('input', () => {
          detectFormat(input.value);
        });

        function showError(message) {
          error.textContent = message;
          error.style.display = 'block';
        }

        function hideError() {
          error.style.display = 'none';
        }

        function copyOutput() {
          output.select();
          document.execCommand('copy');
          // Deselect
          output.setSelectionRange(0, 0);
          output.blur();
        }

        function showOutput(result) {
          output.value = result;
          outputGroup.style.display = 'block';
        }

        function validateHex(input) {
          return /^[0-9A-Fa-f]+$/.test(input);
        }

        function validateBase64(input) {
          try {
            atob(input);
            return /^[A-Za-z0-9+/]*={0,2}$/.test(input);
          } catch {
            return false;
          }
        }

        function validateBinaryArray(input) {
          try {
            const arr = JSON.parse(input);
            return Array.isArray(arr) && arr.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
          } catch {
            return false;
          }
        }

        function utf8ToBytes(str) {
          const encoder = new TextEncoder();
          return Array.from(encoder.encode(str));
        }

        function bytesToUtf8(bytes) {
          const decoder = new TextDecoder();
          return decoder.decode(new Uint8Array(bytes));
        }

        function hexToBytes(hex) {
          const bytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
          }
          return bytes;
        }

        function base64ToBytes(base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return Array.from(bytes);
        }

        function bytesToHex(bytes) {
          return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        function bytesToBase64(bytes) {
          const binary = String.fromCharCode.apply(null, bytes);
          return btoa(binary);
        }

        function convert() {
          hideError();
          const inputValue = input.value.trim();
          if (!inputValue) {
            showError('Please enter some input');
            return;
          }

          let bytes;
          const from = fromFormat.value;
          const to = toFormat.value;

          try {
            // Convert input to bytes
            switch (from) {
              case 'utf8':
                bytes = utf8ToBytes(inputValue);
                break;
              case 'hex':
                if (!validateHex(inputValue)) {
                  showError('Invalid hex format');
                  return;
                }
                bytes = hexToBytes(inputValue);
                break;
              case 'base64':
                if (!validateBase64(inputValue)) {
                  showError('Invalid base64 format');
                  return;
                }
                bytes = base64ToBytes(inputValue);
                break;
              case 'binary':
                if (!validateBinaryArray(inputValue)) {
                  showError('Invalid binary array format');
                  return;
                }
                bytes = JSON.parse(inputValue);
                break;
            }

            // Convert bytes to output format
            let result;
            switch (to) {
              case 'utf8':
                result = bytesToUtf8(bytes);
                break;
              case 'hex':
                result = bytesToHex(bytes);
                break;
              case 'base64':
                result = bytesToBase64(bytes);
                break;
              case 'binary':
                result = '[' + bytes.toString() + ']';
                break;
            }

            showOutput(result);
          } catch (e) {
            showError('Conversion failed: ' + e.message);
          }
        }

        // Auto-detect format of initial input
        if (input.value) {
          detectFormat(input.value);
        }

        // If we have initial input, trigger conversion immediately
        if (input.value) {
          // Set a reasonable default target format based on detected input format
          const detectedFormat = fromFormat.value;
          switch (detectedFormat) {
            case 'utf8':
              toFormat.value = 'hex';
              break;
            case 'hex':
            case 'base64':
              toFormat.value = 'utf8';
              break;
            case 'binary':
              toFormat.value = 'hex';
              break;
          }
          convert();
        }
      </script>
    </body>
  </html>`;
}
