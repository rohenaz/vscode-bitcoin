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
import vsApi, { 
  ExtensionContext,
  WebviewPanel,
  WebviewView,
  WebviewViewProvider
} from './vsShim';
import { BapPanel } from './bapPanel';
import { BapService } from './bapService';
import { generateMnemonic } from './commands/generateMnemonic';
import { generatePrivateKey } from './commands/generatePrivateKey';
import { generatePublicKey } from './commands/generatePublicKey';
import { generateWIF } from './commands/generateWIF';
import { EncryptionService } from './encryption';
import { KeyPanel } from './keyPanel';
import { KeyVault } from './keyVault';
import { OutputManager } from './output';
import { WelcomePanel } from './welcomePanel';
import { WorkspaceManager } from './workspace';
import { asmFromScript } from './commands/asmFromScript';
import { extendedPrivateKeyFromMnemonic } from './commands/extendedPrivateKeyFromMnemonic';
import { publicKeyFromPrivateKey } from './commands/publicKeyFromPrivateKey';
import { addressFromWIF } from './commands/addressFromWIF';
import { addressFromPublicKey } from './commands/addressFromPublicKey';
import { publicKeyFromWIF } from './commands/publicKeyFromWIF';
import { convertData, detectFormat, type DataFormat } from './utils';

const { fromBase58Check } = Utils;

function registerCommand(
  context: vsApi.ExtensionContext,
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

export async function activate(context: vsApi.ExtensionContext) {
  console.log('Bitcoin extension activating...');

  // Show welcome screen on first activation, but skip in tests
  if (!context.globalState.get('bitcoin.hasShownWelcome') && !process.env.TEST_ENV) {
    WelcomePanel.show(context.extensionUri);
    context.globalState.update('bitcoin.hasShownWelcome', true);
  }

  const outputManager = new OutputManager();
  const workspaceManager = new WorkspaceManager();
  const keyVault = new KeyVault(context);
  const encryptionService = new EncryptionService(keyVault);

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

  // Register convertData command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.convertData', async () => {
      try {
        const input = await vsApi.window.showInputBox({
          placeHolder: 'Enter data to convert (hex, base64, or binary array)',
          validateInput: (text) => {
            return text.length === 0 ? 'Input cannot be empty' : null;
          },
        });

        if (!input) {
          return;
        }

        const inputFormat = detectFormat(input);
        if (!inputFormat) {
          vsApi.window.showErrorMessage(
            'Unable to detect input format. Please ensure input is valid hex, base64, or binary array.',
          );
          return;
        }

        const formats = ['hex', 'base64', 'binary'];
        const targetFormat = await vsApi.window.showQuickPick(
          formats.filter((f) => f !== inputFormat),
          {
            placeHolder: `Convert from ${inputFormat} to:`,
          },
        ) as DataFormat;

        if (!targetFormat) {
          return;
        }

        const result = convertData(input, inputFormat, targetFormat);
        await vsApi.commands.executeCommand(
          'bitcoin.handleOutput',
          `Original (${inputFormat}):\n${input}\n\nConverted (${targetFormat}):\n${result}`,
          'conversions',
          `${inputFormat}_to_${targetFormat}`,
        );
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Command failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }),
  );

  // Register detect and convert command
  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.detectAndConvert', async () => {
      try {
        const input = await vsApi.window.showInputBox({
          prompt: 'Enter base64 encoded data to convert',
          placeHolder: 'e.g. /9j/4AAQSkZJRg...',
        });

        if (!input) {
          return;
        }

        const uri = await workspaceManager.detectAndConvertContent(input);
        if (!uri) {
          vsApi.window.showErrorMessage(
            'Failed to convert content. Please check the input data.',
          );
          return;
        }

        vsApi.window.showInformationMessage(
          `Content saved to ${vsApi.workspace.asRelativePath(uri)}`,
        );

        // Open the file if it's an image or text
        const contentType = path.extname(uri.fsPath).toLowerCase();
        if (['.jpeg', '.jpg', '.png', '.gif', '.bmp'].includes(contentType)) {
          vsApi.commands.executeCommand('vscode.open', uri);
        } else if (['.json', '.xml', '.txt'].includes(contentType)) {
          const doc = await vsApi.workspace.openTextDocument(uri);
          await vsApi.window.showTextDocument(doc);
        }
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Error converting content: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),
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
    const xPriv = await vsApi.window.showInputBox({
      value: '',
      placeHolder: 'Ex: xprv9s21ZrQH143K...',
      validateInput: (text) => {
        return text.length !== 111 ? 'Invalid private key!' : null;
      },
    });

    if (!xPriv) {
      return undefined;
    }

    const hdPrivKey = HD.fromString(xPriv);
    const hdPubKey = hdPrivKey.toPublic();
    return {
      data: hdPubKey.toString(),
      type: 'keys',
      name: 'derived_hdpubkey',
    };
  });

  // Register address generation commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromHDPublicKey',
    async () => {
      const xPub = await vsApi.window.showInputBox({
        value: '',
        placeHolder: 'Ex: xpub661MyMwAqRbcGa7...',
        validateInput: (text) => {
          return text.length !== 111 ? 'Invalid extended public key!' : null;
        },
      });

      const path = await vsApi.window.showInputBox({
        value: 'm/0/0',
        placeHolder: 'Ex: m/0/0',
        validateInput: (_text) => {
          return null;
        },
      });

      if (!xPub || !path) {
        return undefined;
      }

      const hdPubKey = HD.fromString(xPub);
      const derivedPubKey = hdPubKey.derive(path);
      const address = derivedPubKey.pubKey.toAddress();

      return {
        data: address,
        type: 'addresses',
        name: `from_hdpubkey_${path.replace('/', '_')}`,
      };
    },
  );

  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromHDPrivateKey',
    async () => {
      const xPriv = await vsApi.window.showInputBox({
        value: '',
        placeHolder: 'Ex: xprv9s21ZrQH143K...',
        validateInput: (text) => {
          return text.length !== 111 ? 'Invalid extended private key!' : null;
        },
      });

      const path = await vsApi.window.showInputBox({
        value: 'm/0/0',
        placeHolder: 'Ex: m/0/0',
        validateInput: (_text) => {
          return null;
        },
      });

      if (!xPriv || !path) {
        return undefined;
      }

      const hdPrivKey = HD.fromString(xPriv);
      const derivedKey = hdPrivKey.derive(path);
      const privKey = PrivateKey.fromHex(derivedKey.privKey.toString());
      const pubKey = privKey.toPublicKey();
      const address = pubKey.toAddress();

      return {
        data: address,
        type: 'addresses',
        name: `from_hdprivkey_${path.replace('/', '_')}`,
      };
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
      const privKey = await vsApi.window.showInputBox({
        value: '',
        placeHolder: 'Ex: L...',
        validateInput: (_text) => {
          return null;
        },
      });

      if (!privKey) {
        return undefined;
      }

      const privateKey = PrivateKey.fromString(privKey);
      const publicKey = privateKey.toPublicKey();
      const address = publicKey.toAddress();

      return {
        data: address,
        type: 'addresses',
        name: 'from_privkey',
      };
    },
  );

  registerCommand(context, outputManager, 'bitcoin.addressFromWIF', async () => {
    return addressFromWIF(outputManager);
  });

  // Register transaction commands
  registerCommand(context, outputManager, 'bitcoin.getTx', async () => {
    const txid = await vsApi.window.showInputBox({
      value: '',
      placeHolder: 'Ex: 4d03ff9062ac2e6...',
      validateInput: (text) => {
        return text.match(/^[a-fA-F0-9]{64}$/)
          ? null
          : 'Invalid transaction ID format. Expected: 64 character hex string';
      },
    });

    if (!txid) {
      return undefined;
    }

    const formats = [
      {
        label: 'Hex (Raw Transaction)',
        value: 'hex',
        description: 'Raw transaction hex',
      },
      {
        label: 'Base64',
        value: 'base64',
        description: 'Raw transaction base64 encoded',
      },
      {
        label: 'JSON (Parsed)',
        value: 'json',
        description: 'Parsed transaction data',
      },
      {
        label: 'BOB (Parsed)',
        value: 'bob',
        description: 'Bitcoin OP_RETURN Bytecode format',
      },
      {
        label: 'BMAP (Parsed)',
        value: 'bmap',
        description: 'Bitcoin Message Action Protocol format',
      },
    ];

    const format = await vsApi.window.showQuickPick(formats, {
      placeHolder: 'Select output format',
      title: 'Transaction Format',
    });

    // Default to hex if no format selected
    const selectedFormat = format?.value || 'hex';

    try {
      let content: string;
      let language: string;

      // First fetch the raw transaction hex
      const hexResponse = await fetch(
        `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`,
      );
      if (!hexResponse.ok) {
        throw new Error(`${hexResponse.status} ${hexResponse.statusText}`);
      }
      const rawTxHex = await hexResponse.text();

      switch (selectedFormat) {
        case 'base64': {
          content = Buffer.from(rawTxHex, 'hex').toString('base64');
          language = 'plaintext';
          break;
        }
        case 'json': {
          // Parse using our SDK for consistent formatting
          const tx = Transaction.fromHex(rawTxHex);
          const txObj = {
            txid,
            version: tx.version,
            inputs: tx.inputs.map((input) => ({
              prevTxId: input.sourceTXID?.toString() || '',
              outputIndex: input.sourceOutputIndex,
              script: input.unlockingScript
                ? input.unlockingScript.toString()
                : '',
              sequence: input.sequence,
            })),
            outputs: tx.outputs.map((output) => ({
              satoshis: output.satoshis,
              script: output.lockingScript.toString(),
            })),
            lockTime: tx.lockTime,
          };
          content = JSON.stringify(txObj, null, 2);
          language = 'json';
          break;
        }
        case 'bob': {
          const bob = await parse({
            tx: { r: rawTxHex },
            split: [
              { token: { op: 106 }, include: 'l' },
              { token: { s: '|' } },
            ],
          });
          content = JSON.stringify(bob, null, 2);
          language = 'json';
          break;
        }
        case 'bmap': {
          try {
            const bmap = new BMAP();
            console.log('Starting transaction processing...');
            console.log('Raw transaction:', rawTxHex);

            if (!rawTxHex) {
              throw new Error('No transaction data provided');
            }

            console.log('Parsing transaction with bpu-ts...');
            const bob = (await parse({
              tx: { r: rawTxHex },
              split: [
                { token: { op: 106 }, include: 'l' },
                { token: { s: '|' } },
              ],
            })) as BobTx;

            if (!bob) {
              throw new Error('Failed to parse transaction with bpu-ts');
            }

            console.log('Parsed BOB:', JSON.stringify(bob, null, 2));

            console.log('Transforming transaction with bmapjs...');
            const tx = await TransformTx(
              bob,
              allProtocols.map((p) => p.name),
            );
            content = JSON.stringify(tx, null, 2);
          } catch (error) {
            // If BMAP parsing fails, just return tx hash
            content = JSON.stringify({ tx: { h: txid } }, null, 2);
          }
          language = 'json';
          break;
        }
        default: {
          // Hex format (default)
          content = rawTxHex;
          language = 'plaintext';
        }
      }

      // Always open in new editor first
      const doc = await vsApi.workspace.openTextDocument({
        content,
        language,
      });
      await vsApi.window.showTextDocument(doc, { preview: false });

      // Then handle according to output preference
      return {
        data: content,
        type: 'transactions',
        name: `${txid}_${selectedFormat}`,
      };
    } catch (error) {
      console.error('Transaction fetch error:', error);
      throw new Error(
        `Failed to fetch transaction: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  registerCommand(context, outputManager, 'bitcoin.decodeRawTx', async () => {
    const rawTxHex = await vsApi.window.showInputBox({
      value: '',
      placeHolder: 'paste raw tx hex',
      validateInput: (_text) => {
        return null;
      },
    });

    if (!rawTxHex) {
      return undefined;
    }

    const tx = Transaction.fromHex(rawTxHex);
    const txObj = {
      version: tx.version,
      inputs: tx.inputs.map((input) => ({
        prevTxId: input.sourceTXID?.toString() || '',
        outputIndex: input.sourceOutputIndex,
        script: input.unlockingScript ? input.unlockingScript.toString() : '',
        sequence: input.sequence,
      })),
      outputs: tx.outputs.map((output) => ({
        satoshis: output.satoshis,
        script: output.lockingScript.toString(),
      })),
      lockTime: tx.lockTime,
    };

    return {
      data: JSON.stringify(txObj, null, 2),
      type: 'transactions',
      name: `decoded_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    };
  });

  registerCommand(context, outputManager, 'bitcoin.rawTxToBob', async () => {
    const rawTxHex = await vsApi.window.showInputBox({
      value: '',
      placeHolder: 'paste raw tx hex',
      validateInput: (_text) => {
        return null;
      },
    });

    if (!rawTxHex) {
      return undefined;
    }

    const bob = await parse({
      tx: { r: rawTxHex },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });

    return {
      data: JSON.stringify(bob, null, 2),
      type: 'transactions',
      name: `bob_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    };
  });

  // Register UTXO commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.getUtxosForAddress',
    async () => {
      const address = await vsApi.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        validateInput: (_text) => {
          return null;
        },
      });

      if (!address) {
        return undefined;
      }

      try {
        const utxos = await fetchPayUtxos(address, 'hex');

        // Handle empty response
        if (!utxos || !Array.isArray(utxos)) {
          return {
            data: JSON.stringify(
              {
                address,
                utxoCount: 0,
                totalSatoshis: 0,
                utxos: [],
              },
              null,
              2,
            ),
            type: 'utxos',
            name: `utxos_${address}`,
          };
        }

        const result = {
          address,
          utxoCount: utxos.length,
          totalSatoshis: utxos.reduce(
            (sum, utxo) => sum + (utxo.satoshis || 0),
            0,
          ),
          utxos: utxos.map((utxo) => ({
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.satoshis,
            scriptPubKey: utxo.script,
          })),
        };

        return {
          data: JSON.stringify(result, null, 2),
          type: 'utxos',
          name: `utxos_${address}`,
        };
      } catch (error) {
        console.error('UTXO fetch error:', error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch UTXOs from ${API_HOST}/txos/address/${address}/unspent?bsv20=false\nError: ${errorMessage}`,
        );
      }
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

  context.subscriptions.push(
    vsApi.commands.registerCommand('bitcoin.lookupBapProfile', async () => {
      const bapService = new BapService();

      // Prompt for BAP ID
      const idKey = await vsApi.window.showInputBox({
        prompt: 'Enter BAP ID',
        placeHolder: 'e.g. Go8vCHAa4S6AhXKTABGpANiz35J',
      });

      if (!idKey) {
        return;
      }

      try {
        // Show progress indicator
        const profile = await vsApi.window.withProgress(
          {
            location: vsApi.ProgressLocation.Notification,
            title: 'Looking up BAP profile...',
            cancellable: false,
          },
          () => bapService.getProfile(idKey),
        );

        // Show profile in webview
        BapPanel.show(profile);
      } catch (error) {
        vsApi.window.showErrorMessage(
          `Failed to lookup BAP profile: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),
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
