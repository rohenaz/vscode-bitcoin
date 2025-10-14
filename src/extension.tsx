import { ECIES, HD, P2PKH, PrivateKey, PublicKey, Utils } from '@bsv/sdk';
import vsApi from 'vscode';
import { BitcoinHoverProvider } from './hoverProvider';
import { TemplateManager } from './scriptTemplates';
import * as path from 'node:path';

import fetch from 'node-fetch';
import { handleAddressFromHDPrivateKeyCommand, handleAddressFromHDPrivateKeyTestnetCommand } from './commands/addressFromHDPrivateKey';
import { handleAddressFromHDPublicKeyCommand, handleAddressFromHDPublicKeyTestnetCommand } from './commands/addressFromHDPublicKey';
import { handleAddressFromPrivateKeyCommand, handleAddressFromPrivateKeyTestnetCommand } from './commands/addressFromPrivateKey';
import { addressFromPublicKey, addressFromPublicKeyTestnet } from './commands/addressFromPublicKey';
import { addressFromWIF } from './commands/addressFromWIF';
import { generateWIF, generateTestnetWIF, generateWIFVanity, generateTestnetWIFVanity } from './commands/generateWIF';
import { asmFromScript } from './commands/asmFromScript';
import { openConversionTool } from './commands/convertData/index';
import { BitcoinToolsViewProvider } from './views/bitcoinTools';
import { handleDecodeFileCommand } from './commands/decodeFile';
import { handleDecodeRawTxCommand } from './commands/decodeRawTx';
import { extendedPrivateKeyFromMnemonic } from './commands/extendedPrivateKeyFromMnemonic';
import { generateMnemonic } from './commands/generateMnemonic';
import { generatePrivateKey } from './commands/generatePrivateKey';
import { generatePublicKey } from './commands/generatePublicKey';
import { handleGetTxCommand } from './commands/getTx';
import { handleGetUtxosForAddressCommand } from './commands/getUtxosForAddress';
import { handleLookupBapProfileCommand } from './commands/lookupBapProfile';
import { publicKeyFromPrivateKey } from './commands/publicKeyFromPrivateKey';
import { publicKeyFromWIF } from './commands/publicKeyFromWIF';
import { handleRawTxToBobCommand } from './commands/rawTxToBob';
import { handleXPubFromXPrivCommand } from './commands/xPubFromxPriv';
import { API_HOST } from './constants';
import { EncryptionService } from './encryption';
import { KeyPanel } from './views/keyVault/index';
import { TransactionDecoderPanel } from './views/transactionDecoder/index';
import { ScriptDebuggerPanel } from './views/scriptDebugger/index';
import { KeyVault } from './keyVault';
import { OutputManager } from './output';
import { DataFormat, convertData, detectFormat } from './utils';
import {
  type ExtensionContext,
  WebviewPanel,
  WebviewView,
  WebviewViewProvider,
} from 'vscode';
import { WelcomePanel } from './welcomePanel';
import { WorkspaceManager } from './workspace';
import { encrypt, decrypt } from './commands/encryption';
import { BitcoinSemanticTokensProvider } from './semanticTokens';
import { generateHDPublicKey } from './commands/generateHDPublicKey';
import { generateHDPrivateKey } from './commands/generateHDPrivateKey';
import { resetExtension } from './commands/resetExtension';
import { signOpReturnData } from './commands/signOpReturnData';
import { sendTransaction } from './commands/sendTransaction';

const { fromBase58Check, toBase64, toArray } = Utils;

function registerCommand<T>(
  context: ExtensionContext,
  outputManager: OutputManager,
  command: string,
  handler: (params?: T) => Promise<
    { data: string; type: string; name?: string } | undefined
  >,
): void {
  context.subscriptions.push(
    vsApi.commands.registerCommand(command, async (params?: T) => {
      try {
        const result = await handler(params);
        if (result) {
          await outputManager.handleOutput(
            result.data,
            command,
            result.type,
            result.name,
          );
        }
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Command failed: ${error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      }
    }),
  );
}

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
  return response.json() as Promise<Inscription>;
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

  // Initialize template manager
  const workspaceRoot = vsApi.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const templatesDir = path.join(workspaceRoot, '.bitcoin', 'templates');
    const templateManager = new TemplateManager(templatesDir);

    templateManager.loadTemplates();

    // Register hover provider with template manager
    context.subscriptions.push(
      vsApi.languages.registerHoverProvider(
        [
          { scheme: 'file', language: 'typescript' },
          { scheme: 'file', language: 'javascript' },
          { scheme: 'file', language: 'typescriptreact' },
          { scheme: 'file', language: 'javascriptreact' },
          { scheme: 'file', language: 'python' },
          { scheme: 'file', language: 'go' },
          { scheme: 'file', language: 'rust' },
          { scheme: 'file', language: 'java' },
          { scheme: 'file', language: 'csharp' },
          { scheme: 'file', language: 'cpp' },
          { scheme: 'file', language: 'c' },
          { scheme: 'file', language: 'ruby' },
          { scheme: 'file', language: 'php' },
          { scheme: 'file', language: 'swift' },
          { scheme: 'file', language: 'plaintext' },
          { scheme: 'file', language: 'markdown' },
          { scheme: 'file', language: 'json' },
          { scheme: 'file', language: 'yaml' },
          { scheme: 'file', language: 'toml' }
        ],
        new BitcoinHoverProvider(templateManager)
      )
    );
  }

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
        `Selected text: "${selectedText}"\nMatches txid pattern: ${isTxid}\nLength: ${selectedText.length}`,
      );
    }),
  );

  // Show welcome screen on first activation
  if (!context.globalState.get('bitcoin.hasShownWelcome')) {
    WelcomePanel.show(context.extensionUri);
    await context.globalState.update('bitcoin.hasShownWelcome', true);
  }

  // Construct managers
  const keyVault = new KeyVault(context);
  const encryptionService = new EncryptionService(keyVault);
  const outputManager = new OutputManager();

  // Lazy workspace manager getter
  let _workspaceManager: WorkspaceManager | undefined;
  const getWorkspaceManager = () => {
    if (!_workspaceManager && (vsApi.workspace.workspaceFolders?.length ?? 0) > 0) {
      _workspaceManager = new WorkspaceManager();
    }
    return _workspaceManager;
  };

  // Register Bitcoin Tools view provider (with tabs for Quick Actions, Data Conversion, Help)
  const bitcoinToolsViewProvider = new BitcoinToolsViewProvider(context.extensionUri, keyVault, context);
  context.subscriptions.push(
    vsApi.window.registerWebviewViewProvider(
      BitcoinToolsViewProvider.viewType,
      bitcoinToolsViewProvider,
    ),
  );

  // Register openConversionTool command - just opens the tool with selected text
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.openConversionTool', async () => {
      // Get selected text if any
      const editor = vsApi.window.activeTextEditor;
      const selectedText =
        editor?.selection && !editor.selection.isEmpty
          ? editor.document.getText(editor.selection)
          : undefined;

      await openConversionTool(selectedText);
    }),
  );

  // Register the convert data command - prompts for input and format before opening tool
  registerCommand(context, outputManager, 'bitcoin.convertData', async () => {
    // Prompt for input
    const userInput = await vsApi.window.showInputBox({
      prompt: 'Enter data to convert',
      placeHolder: 'Enter hex, base64, binary array, or text',
    });

    // If they cancelled, do nothing
    if (userInput === undefined) {
      return undefined;
    }

    // Open conversion tool with the input
    await openConversionTool(userInput);
  });

  // Register show key vault command
  const showKeyVaultCommand = vsApi.commands.registerCommand(
    'bitcoin.showKeyVault',
    async (scrollTo?: string) => {
      await KeyPanel.show(keyVault, context.extensionUri, { scrollTo });
    },
  );
  context.subscriptions.push(showKeyVaultCommand);

  // Register show key vault and add key command
  const showKeyVaultAndAddKeyCommand = vsApi.commands.registerCommand(
    'bitcoin.showKeyVaultAndAddKey',
    async () => {
      await KeyPanel.show(keyVault, context.extensionUri, { openAddKeyDialog: true });
    },
  );
  context.subscriptions.push(showKeyVaultAndAddKeyCommand);

  // Register show key vault and import command
  const showKeyVaultAndImportCommand = vsApi.commands.registerCommand(
    'bitcoin.showKeyVaultAndImport',
    async () => {
      await KeyPanel.show(keyVault, context.extensionUri, { openImportDialog: true });
    },
  );
  context.subscriptions.push(showKeyVaultAndImportCommand);

  // Initialize transaction decoder history service
  TransactionDecoderPanel.initialize(context);
  ScriptDebuggerPanel.initialize(context); // TxCache is singleton, no init needed

  // Register transaction decoder panel command
  const openTransactionDecoderCommand = vsApi.commands.registerCommand(
    'bitcoin.openTransactionDecoder',
    async (rawTxHex?: string) => {
      TransactionDecoderPanel.show(context.extensionUri, rawTxHex);
    },
  );
  context.subscriptions.push(openTransactionDecoderCommand);

  // Register script executor panel command
  const openScriptDebuggerCommand = vsApi.commands.registerCommand(
    'bitcoin.openScriptDebugger',
    async (spendParams?: any) => {
      console.log('[Extension] openScriptDebugger command called with spendParams:', !!spendParams);
      ScriptDebuggerPanel.show(context.extensionUri, spendParams);
      console.log('[Extension] ScriptDebuggerPanel.show() called');
    },
  );
  context.subscriptions.push(openScriptDebuggerCommand);

  // Register detect and convert command
  registerCommand(context, outputManager, 'bitcoin.decodeFile', async () =>
    handleDecodeFileCommand(outputManager),
  );

  // Register key generation commands with keyVault for parent-child relationships
  registerCommand(context, outputManager, 'bitcoin.generatePublicKey', () =>
    generatePublicKey(outputManager, keyVault)
  );

  registerCommand(context, outputManager, 'bitcoin.generateHDPublicKey', () =>
    generateHDPublicKey(outputManager, keyVault)
  );

  registerCommand(context, outputManager, 'bitcoin.generateHDPrivateKey', () =>
    generateHDPrivateKey(outputManager, keyVault)
  );

  registerCommand(context, outputManager, 'bitcoin.generatePrivateKey', () =>
    generatePrivateKey(outputManager, keyVault)
  );

  registerCommand(context, outputManager, 'bitcoin.generateWIF', () =>
    generateWIF(outputManager, keyVault)
  );
  registerCommand(context, outputManager, 'bitcoin.generateTestnetWIF', () =>
    generateTestnetWIF(outputManager, keyVault)
  );
  registerCommand(context, outputManager, 'bitcoin.generateWIFVanity', () =>
    generateWIFVanity(outputManager, keyVault)
  );
  registerCommand(context, outputManager, 'bitcoin.generateTestnetWIFVanity', () =>
    generateTestnetWIFVanity(outputManager, keyVault)
  );

  registerCommand(context, outputManager, 'bitcoin.generateMnemonic', () =>
    generateMnemonic(outputManager, keyVault)
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
    'bitcoin.addressFromHDPublicKeyTestnet',
    async () => {
      return handleAddressFromHDPublicKeyTestnetCommand(outputManager);
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
    'bitcoin.addressFromHDPrivateKeyTestnet',
    async () => {
      return handleAddressFromHDPrivateKeyTestnetCommand(outputManager);
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
    'bitcoin.addressFromPublicKeyTestnet',
    async () => {
      return addressFromPublicKeyTestnet(outputManager);
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
    'bitcoin.addressFromPrivateKeyTestnet',
    async () => {
      return handleAddressFromPrivateKeyTestnetCommand(outputManager);
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

  registerCommand(
    context,
    outputManager,
    'bitcoin.extendedPrivateKeyFromMnemonic',
    async () => {
      return extendedPrivateKeyFromMnemonic(outputManager, keyVault);
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

  // Register signOpReturnData command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.encryptToFriend', async (params: { message: string, targetBapId: string, themPubKey: string }) => {
      try {
        const { message, targetBapId, themPubKey } = params;

        const friendKey = await friendPrivateKeyFromMemberIdKey(targetBapId);
        return encryptToFriend(friendKey, message, targetBapId, PublicKey.fromString(themPubKey));
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Failed to encrypt message: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    })
  );

  const friendPrivateKeyFromMemberIdKey = async (
    targetBapId: string
  ) => {
    const identityKey = await keyVault.getIdentityKey();
    if (!identityKey) {
      throw new Error('Identity key not found');
    }
    const idKey = PrivateKey.fromWif(identityKey.value);
    return idKey.deriveChild(idKey.toPublicKey(), targetBapId);
  };

  const encryptToFriend = async (privateKey: PrivateKey, message: string, targetBapId: string, friendPubKey: PublicKey) => {
    const seedStr = friendPubKey ? targetBapId : "notes";
    const idPrivateKey = await friendPrivateKeyFromMemberIdKey(seedStr);

    let encrypted: number[];
    const messageBytes = new TextEncoder().encode(message);
    const messageArray = Array.from(messageBytes);
    if (!friendPubKey) {
      encrypted = ECIES.electrumEncrypt(
        messageArray,
        idPrivateKey.toPublicKey()
      );
    } else {
      encrypted = ECIES.electrumEncrypt(
        messageArray,
        friendPubKey,
        idPrivateKey
      );
    }
    return encrypted;
  };

  // Register signOpReturnData command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.signOpReturnData', async (params?: { data: number[][] }) => {
      try {
        return signOpReturnData(keyVault, params);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Failed to sign message: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    })
  );

  // Register sendTransaction command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.sendTransaction', async (params?: { outputs: { satoshis: number; script: string }[]; scriptEncoding?: 'hex' | 'base64' | 'asm' }) => {
      try {
        return sendTransaction(keyVault, params?.outputs || [], params?.scriptEncoding);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    })
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
              const uri = await getWorkspaceManager()?.saveFile(
                output,
                type,
                suggestedName,
              );
              if (uri) {
                vsApi.window.showInformationMessage(
                  `Output saved to ${vsApi.workspace.asRelativePath(uri.fsPath)}`,
                );
              }
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
            `Error handling output: ${error instanceof Error ? error.message : String(error)
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

        await encrypt(encryptionService, getWorkspaceManager() ?? new WorkspaceManager(), text);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Encryption failed: ${error instanceof Error ? error.message : String(error)
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

        await decrypt(encryptionService, text);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Decryption failed: ${error instanceof Error ? error.message : String(error)
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

  // Register settings command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.openBitcoinSettings', () => {
      vsApi.commands.executeCommand('workbench.action.openSettings', '@ext:Satchmo.bitcoin');
    })
  );

  // Register reset extension command
  registerCommand(context, outputManager, 'bitcoin.resetExtension', () =>
    resetExtension(outputManager, context)
  );

  // Register conversion tool commands
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.convertToHex', async () => {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text) return;

      const detected = detectFormat(text);
      await openConversionTool(text, detected, 'hex');
    }),

    vsApi.commands.registerCommand('bitcoin.convertToBase64', async () => {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text) return;

      const detected = detectFormat(text);
      await openConversionTool(text, detected, 'base64');
    }),

    vsApi.commands.registerCommand('bitcoin.convertToBinary', async () => {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text) return;

      const detected = detectFormat(text);
      await openConversionTool(text, detected, 'binary');
    }),

    vsApi.commands.registerCommand('bitcoin.decodeHex', async () => {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text) return;

      await openConversionTool(text, 'hex', 'utf8');
    }),

    vsApi.commands.registerCommand('bitcoin.decodeBase64', async () => {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text) return;

      await openConversionTool(text, 'base64', 'utf8');
    }),
  );

  // Register explore address command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.exploreAddress', async () => {
      const editor = vsApi.window.activeTextEditor;
      let address = '';

      if (editor && !editor.selection.isEmpty) {
        const selection = editor.selection;
        address = editor.document.getText(selection);
      }

      if (!address) {
        address = await vsApi.window.showInputBox({
          prompt: 'Enter Bitcoin address to explore',
          placeHolder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        }) || '';
      }

      if (!address) return;

      const url = `https://whatsonchain.com/address/${address}`;
      await vsApi.env.openExternal(vsApi.Uri.parse(url));
    }),
  );

  // Register semantic tokens provider for multiple languages
  console.log('Creating semantic tokens provider...');
  const semanticTokensProvider = new BitcoinSemanticTokensProvider();
  const selector = [
    { scheme: 'file', language: 'typescript' },
    { scheme: 'file', language: 'typescriptreact' },
    { scheme: 'file', language: 'javascript' },
    { scheme: 'file', language: 'javascriptreact' },
    { scheme: 'file', language: 'plaintext' },
    { scheme: 'file', language: 'json' },
    { scheme: 'file', language: 'jsonc' },
    { scheme: 'file', language: 'markdown' },
    { scheme: 'file', language: 'go' },
    { scheme: 'file', language: 'rust' },
    { scheme: 'file', language: 'zig' },
    { scheme: 'file', language: 'html' }
  ];

  console.log('Registering semantic tokens provider for languages:', selector);
  console.log('Token types:', semanticTokensProvider.legend.tokenTypes);
  console.log('Token modifiers:', semanticTokensProvider.legend.tokenModifiers);

  try {
    const registration = vsApi.languages.registerDocumentSemanticTokensProvider(
      selector,
      semanticTokensProvider,
      semanticTokensProvider.legend
    );
    console.log('Semantic tokens provider registration:', registration);
    context.subscriptions.push(registration);
    console.log('Semantic tokens provider registered successfully');
  } catch (error) {
    console.error('Failed to register semantic tokens provider:', error);
  }

  console.log('Bitcoin extension activated successfully!');
}

// this method is called when your extension is deactivated
export function deactivate() { }