import { HD, P2PKH, Utils } from '@bsv/sdk';
import vsApi from './vsShim';

import fetch from 'node-fetch';
import { handleAddressFromHDPrivateKeyCommand } from './commands/addressFromHDPrivateKey';
import { handleAddressFromHDPublicKeyCommand } from './commands/addressFromHDPublicKey';
import { handleAddressFromPrivateKeyCommand } from './commands/addressFromPrivateKey';
import { addressFromPublicKey } from './commands/addressFromPublicKey';
import { addressFromWIF } from './commands/addressFromWIF';
import { asmFromScript } from './commands/asmFromScript';
import { openConversionTool } from './commands/convertData/index';
import { handleDecodeFileCommand } from './commands/decodeFile';
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
import { DataFormat, convertData, detectFormat } from './utils';
import {
  ExtensionContext,
  WebviewPanel,
  WebviewView,
  WebviewViewProvider,
} from './vsShim';
import { WelcomePanel } from './welcomePanel';
import { WorkspaceManager } from './workspace';
import { API_HOST } from './constants';

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

  // Add diagnostic command for selection
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.debugSelection', async () => {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) {
        vsApi.window.showInformationMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const isTxid = /^[a-fA-F0-9]{64}$/.test(selectedText);
      
      vsApi.window.showInformationMessage(
        `Selected text: "${selectedText}"\nMatches txid pattern: ${isTxid}\nLength: ${selectedText.length}`
      );
    })
  );

  // We can skip the welcome screen if in test env
  const isTestMode = process.env.TEST_ENV === 'true';

  // Construct managers
  const workspaceManager = new WorkspaceManager();
  const keyVault = new KeyVault(context);
  const encryptionService = new EncryptionService(keyVault);
  const outputManager = new OutputManager();

  // Register openConversionTool command - just opens the tool with selected text
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.openConversionTool', async () => {
      try {
        // Get selected text if any
        const editor = vsApi.window.activeTextEditor;
        const selectedText =
          editor?.selection && !editor.selection.isEmpty
            ? editor.document.getText(editor.selection)
            : undefined;

        // Open the conversion tool with selected text
        await openConversionTool(selectedText);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Failed to open conversion tool: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }),
  );

  // Register the convert data command - prompts for input and format before opening tool
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.convertData', async () => {
      try {
        // Prompt for input
        const userInput = await vsApi.window.showInputBox({
          prompt: 'Enter data to convert',
          placeHolder: 'Enter hex, base64, binary array, or text',
        });

        // If they cancelled, do nothing
        if (userInput === undefined) {
          return;
        }

        // Open the conversion tool with the input
        await openConversionTool(userInput);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Failed to convert data: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }),
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
  registerCommand(context, outputManager, 'bitcoin.decodeFile', async () =>
    handleDecodeFileCommand(outputManager),
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
