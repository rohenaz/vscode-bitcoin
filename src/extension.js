var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = { enumerable: true, get: () => m[k] };
        }
        Object.defineProperty(o, k2, desc);
      }
    : (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? (o, v) => {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : (o, v) => {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (() => {
    var ownKeys = (o) => {
      ownKeys =
        Object.getOwnPropertyNames ||
        ((o) => {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        });
      return ownKeys(o);
    };
    return (mod) => {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.TokenType = void 0;
exports.isHex = isHex;
exports.isBase64 = isBase64;
exports.detectFormat = detectFormat;
exports.convertData = convertData;
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require('node:path'));
const sdk_1 = require('@bsv/sdk');
const bmapjs_1 = require('bmapjs');
const bpu_ts_1 = require('bpu-ts');
const node_fetch_1 = __importDefault(require('node-fetch'));
const vscode = __importStar(require('vscode'));
const bapPanel_1 = require('./bapPanel');
const bapService_1 = require('./bapService');
const encryption_1 = require('./encryption');
const keyPanel_1 = require('./keyPanel');
const keyVault_1 = require('./keyVault');
const output_1 = require('./output');
const workspace_1 = require('./workspace');
const { toArray, toHex, toBase64 } = sdk_1.Utils;
const { fromBase58Check } = sdk_1.Utils;
// Helper functions for data conversion
function isHex(str) {
  return /^[0-9A-Fa-f]*$/.test(str);
}
function isBase64(str) {
  try {
    return btoa(atob(str)) === str;
  } catch (e) {
    return false;
  }
}
function detectFormat(input) {
  // Check if it's a binary array string
  if (input.startsWith('[') && input.endsWith(']')) {
    try {
      const arr = JSON.parse(input);
      if (
        Array.isArray(arr) &&
        arr.every((n) => typeof n === 'number' && n >= 0 && n <= 255)
      ) {
        return 'binary';
      }
    } catch {}
  }
  // Check if it's hex
  if (isHex(input)) {
    return 'hex';
  }
  // Check if it's base64
  if (isBase64(input)) {
    return 'base64';
  }
  return 'unknown';
}
function convertData(input, fromFormat, toFormat) {
  let bytes;
  // First convert input to byte array using toArray
  switch (fromFormat) {
    case 'hex':
      try {
        if (!isHex(input)) {
          throw new Error('Invalid hex string');
        }
        bytes = toArray(Buffer.from(input, 'hex'));
      } catch (e) {
        throw new Error('Invalid hex input');
      }
      break;
    case 'base64':
      try {
        if (!isBase64(input)) {
          throw new Error('Invalid base64 string');
        }
        bytes = toArray(Buffer.from(input, 'base64'));
      } catch (e) {
        throw new Error('Invalid base64 input');
      }
      break;
    case 'binary':
      try {
        const arr = JSON.parse(input);
        if (
          !Array.isArray(arr) ||
          !arr.every((n) => typeof n === 'number' && n >= 0 && n <= 255)
        ) {
          throw new Error('Invalid binary array');
        }
        bytes = arr;
      } catch (e) {
        throw new Error('Invalid binary array input');
      }
      break;
    default:
      throw new Error('Unsupported input format');
  }
  // Then convert byte array to desired output format using Utils functions
  switch (toFormat) {
    case 'hex':
      return toHex(bytes);
    case 'base64':
      return toBase64(bytes);
    case 'binary':
      return JSON.stringify(bytes);
    default:
      throw new Error('Unsupported output format');
  }
}
function registerCommand(context, outputManager, command, handler) {
  const disposable = vscode.commands.registerCommand(command, async () => {
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
      vscode.window.showErrorMessage(
        `Command failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  });
  context.subscriptions.push(disposable);
}
const API_HOST = 'https://ordinals.gorillapool.io/api';
const fetchPayUtxos = async (address, scriptEncoding = 'base64') => {
  const payUrl = `${API_HOST}/txos/address/${address}/unspent?bsv20=false`;
  console.log({ payUrl });
  const payRes = await (0, node_fetch_1.default)(payUrl);
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
  payUtxos = payUtxos.filter((u) => u.satoshis !== 1 && !u.lock);
  // Get pubkey hash from address
  const pubKeyHash = fromBase58Check(address);
  const p2pkhScript = new sdk_1.P2PKH().lock(pubKeyHash.data);
  payUtxos = payUtxos.map((utxo) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    satoshis: utxo.satoshis,
    script:
      scriptEncoding === 'hex' || scriptEncoding === 'base64'
        ? Buffer.from(p2pkhScript.toBinary()).toString(scriptEncoding)
        : p2pkhScript.toASM(),
  }));
  return payUtxos;
};
var TokenType;
((TokenType) => {
  TokenType['BSV20'] = 'bsv20';
  TokenType['BSV21'] = 'bsv21';
})(TokenType || (exports.TokenType = TokenType = {}));
const fetchInscriptionData = async (outpoint) => {
  const url = `${API_HOST}/txos/${outpoint}`;
  console.log({ url });
  const response = await (0, node_fetch_1.default)(url);
  if (!response.ok) {
    throw new Error(
      `Error fetching inscription: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};
const fetchInscriptionContent = async (inscription) => {
  // First check if content is in the inscription data
  if (inscription.data?.insc?.json) {
    return JSON.stringify(inscription.data.insc.json, null, 2);
  }
  // If not, try to fetch from content endpoint
  const url = `${API_HOST}/content/${inscription.outpoint}`;
  console.log({ url });
  const response = await (0, node_fetch_1.default)(url);
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
function activate(context) {
  console.log('Bitcoin extension activating...');
  const outputManager = new output_1.OutputManager();
  const workspaceManager = new workspace_1.WorkspaceManager();
  const keyVault = new keyVault_1.KeyVault(context);
  const encryptionService = new encryption_1.EncryptionService(keyVault);
  // Register show key vault command
  const showKeyVaultCommand = vscode.commands.registerCommand(
    'bitcoin.showKeyVault',
    () => {
      keyPanel_1.KeyPanel.show(keyVault);
    },
  );
  context.subscriptions.push(showKeyVaultCommand);
  // Register test command
  const testCommand = vscode.commands.registerCommand('bitcoin.test', () => {
    console.log('Test command executed');
    vscode.window.showInformationMessage('Test command works!');
  });
  context.subscriptions.push(testCommand);
  // Register convertData command
  context.subscriptions.push(
    vscode.commands.registerCommand('bitcoin.convertData', async () => {
      try {
        const input = await vscode.window.showInputBox({
          placeHolder: 'Enter data to convert (hex, base64, or binary array)',
          validateInput: (text) => {
            return text.length === 0 ? 'Input cannot be empty' : null;
          },
        });
        if (!input) {
          return;
        }
        const inputFormat = detectFormat(input);
        if (inputFormat === 'unknown') {
          vscode.window.showErrorMessage(
            'Unable to detect input format. Please ensure input is valid hex, base64, or binary array.',
          );
          return;
        }
        const formats = ['hex', 'base64', 'binary'];
        const targetFormat = await vscode.window.showQuickPick(
          formats.filter((f) => f !== inputFormat),
          {
            placeHolder: `Convert from ${inputFormat} to:`,
          },
        );
        if (!targetFormat) {
          return;
        }
        const result = convertData(input, inputFormat, targetFormat);
        await vscode.commands.executeCommand(
          'bitcoin.handleOutput',
          `Original (${inputFormat}):\n${input}\n\nConverted (${targetFormat}):\n${result}`,
          'conversions',
          `${inputFormat}_to_${targetFormat}`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Command failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }),
  );
  // Register detect and convert command
  context.subscriptions.push(
    vscode.commands.registerCommand('bitcoin.detectAndConvert', async () => {
      try {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter base64 encoded data to convert',
          placeHolder: 'e.g. /9j/4AAQSkZJRg...',
        });
        if (!input) {
          return;
        }
        const uri = await workspaceManager.detectAndConvertContent(input);
        if (!uri) {
          vscode.window.showErrorMessage(
            'Failed to convert content. Please check the input data.',
          );
          return;
        }
        vscode.window.showInformationMessage(
          `Content saved to ${vscode.workspace.asRelativePath(uri)}`,
        );
        // Open the file if it's an image or text
        const contentType = path.extname(uri.fsPath).toLowerCase();
        if (['.jpeg', '.jpg', '.png', '.gif', '.bmp'].includes(contentType)) {
          vscode.commands.executeCommand('vscode.open', uri);
        } else if (['.json', '.xml', '.txt'].includes(contentType)) {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
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
      const hdPrivKey = sdk_1.HD.fromRandom();
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
      const hdPrivKey = sdk_1.HD.fromRandom();
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
    const xPriv = await vscode.window.showInputBox({
      value: '',
      placeHolder: 'Ex: xprv9s21ZrQH143K...',
      validateInput: (text) => {
        return text.length !== 111 ? 'Invalid private key!' : null;
      },
    });
    if (!xPriv) {
      return undefined;
    }
    const hdPrivKey = sdk_1.HD.fromString(xPriv);
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
      const xPub = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: xpub661MyMwAqRbcGa7...',
        validateInput: (text) => {
          return text.length !== 111 ? 'Invalid extended public key!' : null;
        },
      });
      const path = await vscode.window.showInputBox({
        value: 'm/0/0',
        placeHolder: 'Ex: m/0/0',
        validateInput: (_text) => {
          return null;
        },
      });
      if (!xPub || !path) {
        return undefined;
      }
      const hdPubKey = sdk_1.HD.fromString(xPub);
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
      const xPriv = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: xprv9s21ZrQH143K...',
        validateInput: (text) => {
          return text.length !== 111 ? 'Invalid extended private key!' : null;
        },
      });
      const path = await vscode.window.showInputBox({
        value: 'm/0/0',
        placeHolder: 'Ex: m/0/0',
        validateInput: (_text) => {
          return null;
        },
      });
      if (!xPriv || !path) {
        return undefined;
      }
      const hdPrivKey = sdk_1.HD.fromString(xPriv);
      const derivedKey = hdPrivKey.derive(path);
      const privKey = sdk_1.PrivateKey.fromHex(derivedKey.privKey.toString());
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
      const pubKey = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 02...',
        validateInput: (_text) => {
          return null;
        },
      });
      if (!pubKey) {
        return undefined;
      }
      const publicKey = sdk_1.PublicKey.fromString(pubKey);
      const address = publicKey.toAddress();
      return {
        data: address,
        type: 'addresses',
        name: 'from_pubkey',
      };
    },
  );
  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromPrivateKey',
    async () => {
      const privKey = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: L...',
        validateInput: (_text) => {
          return null;
        },
      });
      if (!privKey) {
        return undefined;
      }
      const privateKey = sdk_1.PrivateKey.fromString(privKey);
      const publicKey = privateKey.toPublicKey();
      const address = publicKey.toAddress();
      return {
        data: address,
        type: 'addresses',
        name: 'from_privkey',
      };
    },
  );
  registerCommand(
    context,
    outputManager,
    'bitcoin.addressFromWIF',
    async () => {
      const wif = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: L...',
        validateInput: (_text) => {
          return null;
        },
      });
      if (!wif) {
        return undefined;
      }
      const privateKey = sdk_1.PrivateKey.fromWif(wif);
      const publicKey = privateKey.toPublicKey();
      const address = publicKey.toAddress();
      return {
        data: address,
        type: 'addresses',
        name: 'from_wif',
      };
    },
  );
  // Register transaction commands
  registerCommand(context, outputManager, 'bitcoin.getTx', async () => {
    const txid = await vscode.window.showInputBox({
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
    const format = await vscode.window.showQuickPick(formats, {
      placeHolder: 'Select output format',
      title: 'Transaction Format',
    });
    // Default to hex if no format selected
    const selectedFormat = format?.value || 'hex';
    try {
      let content;
      let language;
      // First fetch the raw transaction hex
      const hexResponse = await (0, node_fetch_1.default)(
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
          const tx = sdk_1.Transaction.fromHex(rawTxHex);
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
          const bob = await (0, bpu_ts_1.parse)({
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
            const bmap = new bmapjs_1.BMAP();
            console.log('Starting transaction processing...');
            console.log('Raw transaction:', rawTxHex);
            if (!rawTxHex) {
              throw new Error('No transaction data provided');
            }
            console.log('Parsing transaction with bpu-ts...');
            const bob = await (0, bpu_ts_1.parse)({
              tx: { r: rawTxHex },
              split: [
                { token: { op: 106 }, include: 'l' },
                { token: { s: '|' } },
              ],
            });
            if (!bob) {
              throw new Error('Failed to parse transaction with bpu-ts');
            }
            console.log('Parsed BOB:', JSON.stringify(bob, null, 2));
            console.log('Transforming transaction with bmapjs...');
            const tx = await (0, bmapjs_1.TransformTx)(
              bob,
              bmapjs_1.allProtocols.map((p) => p.name),
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
      const doc = await vscode.workspace.openTextDocument({
        content,
        language,
      });
      await vscode.window.showTextDocument(doc, { preview: false });
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
    const rawTxHex = await vscode.window.showInputBox({
      value: '',
      placeHolder: 'paste raw tx hex',
      validateInput: (_text) => {
        return null;
      },
    });
    if (!rawTxHex) {
      return undefined;
    }
    const tx = sdk_1.Transaction.fromHex(rawTxHex);
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
    const rawTxHex = await vscode.window.showInputBox({
      value: '',
      placeHolder: 'paste raw tx hex',
      validateInput: (_text) => {
        return null;
      },
    });
    if (!rawTxHex) {
      return undefined;
    }
    const bob = await (0, bpu_ts_1.parse)({
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
      const address = await vscode.window.showInputBox({
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
    const scriptHex = await vscode.window.showInputBox({
      value: '',
      placeHolder: 'Ex: 006a0c74657374206d657373616765...',
      validateInput: (_text) => {
        return null;
      },
    });
    if (!scriptHex) {
      return undefined;
    }
    const script = sdk_1.Script.fromHex(scriptHex);
    const asmString = script.toASM();
    return {
      data: asmString,
      type: 'scripts',
      name: `asm_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    };
  });
  // Register key generation commands
  registerCommand(
    context,
    outputManager,
    'bitcoin.generatePublicKey',
    async () => {
      const privKey = sdk_1.PrivateKey.fromRandom();
      const publicKey = privKey.toPublicKey();
      return {
        data: publicKey.toString(),
        type: 'keys',
        name: 'pubkey',
      };
    },
  );
  registerCommand(
    context,
    outputManager,
    'bitcoin.generatePrivateKey',
    async () => {
      const privKey = sdk_1.PrivateKey.fromRandom();
      const value = privKey.toString();
      // Store in vault
      await keyVault.storeKey({
        type: 'private',
        value,
        label: 'Generated Private Key',
      });
      return {
        data: value,
        type: 'keys',
        name: 'privkey',
      };
    },
  );
  registerCommand(context, outputManager, 'bitcoin.generateWIF', async () => {
    const privKey = sdk_1.PrivateKey.fromRandom();
    const value = privKey.toWif();
    // Store in vault
    await keyVault.storeKey({
      type: 'wif',
      value,
      label: 'Generated WIF',
    });
    return {
      data: value,
      type: 'keys',
      name: 'wif',
    };
  });
  registerCommand(
    context,
    outputManager,
    'bitcoin.generateMnemonic',
    async () => {
      const mnemonic = sdk_1.Mnemonic.fromRandom();
      const value = mnemonic.toString();
      // Store in vault
      await keyVault.storeKey({
        type: 'mnemonic',
        value,
        label: 'Generated Mnemonic',
      });
      return {
        data: value,
        type: 'keys',
        name: 'mnemonic',
      };
    },
  );
  registerCommand(
    context,
    outputManager,
    'bitcoin.extendedPrivateKeyFromMnemonic',
    async () => {
      const mnemonicStr = await vscode.window.showInputBox({
        value: '',
        placeHolder:
          'Ex: solid drastic bone type leopard law virtual share agree way bacon noise',
        validateInput: (text) => {
          return text.split(' ').length !== 12 ? 'Invalid mnemonic!' : null;
        },
      });
      if (!mnemonicStr) {
        return undefined;
      }
      const mnemonic = sdk_1.Mnemonic.fromString(mnemonicStr);
      const hdPrivKey = sdk_1.HD.fromSeed(mnemonic.toSeed());
      return {
        data: hdPrivKey.toString(),
        type: 'keys',
        name: 'hdprivkey_from_mnemonic',
      };
    },
  );
  registerCommand(
    context,
    outputManager,
    'bitcoin.publicKeyFromPrivateKey',
    async () => {
      const privKeyStr = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: L...',
        validateInput: (_text) => {
          return null;
        },
      });
      if (!privKeyStr) {
        return undefined;
      }
      const privKey = sdk_1.PrivateKey.fromString(privKeyStr);
      const pubKey = privKey.toPublicKey();
      return {
        data: pubKey.toString(),
        type: 'keys',
        name: 'pubkey_from_privkey',
      };
    },
  );
  // Register output handler
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'bitcoin.handleOutput',
      async (output, type, suggestedName) => {
        const config = vscode.workspace.getConfiguration('bitcoin');
        const preference = config.get('outputPreference');
        try {
          switch (preference) {
            case 'workspace': {
              const uri = await workspaceManager.saveFile(
                output,
                type,
                suggestedName,
              );
              vscode.window.showInformationMessage(
                `Output saved to ${vscode.workspace.asRelativePath(uri)}`,
              );
              break;
            }
            case 'file': {
              const fileUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(
                  suggestedName ?? `${type}_${Date.now()}.txt`,
                ),
                filters: { 'Text files': ['txt'] },
              });
              if (fileUri) {
                await vscode.workspace.fs.writeFile(
                  fileUri,
                  Buffer.from(output),
                );
                vscode.window.showInformationMessage(
                  `Output saved to ${vscode.workspace.asRelativePath(fileUri)}`,
                );
              }
              break;
            }
            default: {
              // Handle clipboard (default case)
              await vscode.env.clipboard.writeText(output);
              const changeSettings = 'Change Output Settings';
              const result = await vscode.window.showInformationMessage(
                'Output copied to clipboard!',
                changeSettings,
              );
              if (result === changeSettings) {
                await vscode.commands.executeCommand(
                  'workbench.action.openSettings',
                  'bitcoin.outputPreference',
                );
              }
              break;
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(
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
    vscode.commands.registerCommand('bitcoin.encrypt', async () => {
      try {
        // Get active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No active text editor');
          return;
        }
        // Get selected text or entire document
        const selection = editor.selection;
        const text = selection.isEmpty
          ? editor.document.getText()
          : editor.document.getText(selection);
        if (!text) {
          vscode.window.showErrorMessage('No text to encrypt');
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
        await vscode.window.showInformationMessage(
          'Data encrypted and saved. Keep this key safe:',
          { modal: true },
        );
        await vscode.window.showInformationMessage(wif, { modal: true });
        // Open the encrypted file
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Encryption failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),
    vscode.commands.registerCommand('bitcoin.decrypt', async () => {
      try {
        // Get active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No active text editor');
          return;
        }
        // Get selected text or entire document
        const selection = editor.selection;
        const text = selection.isEmpty
          ? editor.document.getText()
          : editor.document.getText(selection);
        if (!text) {
          vscode.window.showErrorMessage('No text to decrypt');
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
        const doc = await vscode.workspace.openTextDocument({
          content: decrypted.toString(),
          language: 'plaintext',
        });
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Decryption failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('bitcoin.lookupBapProfile', async () => {
      const bapService = new bapService_1.BapService();
      // Prompt for BAP ID
      const idKey = await vscode.window.showInputBox({
        prompt: 'Enter BAP ID',
        placeHolder: 'e.g. Go8vCHAa4S6AhXKTABGpANiz35J',
      });
      if (!idKey) {
        return;
      }
      try {
        // Show progress indicator
        const profile = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Looking up BAP profile...',
            cancellable: false,
          },
          () => bapService.getProfile(idKey),
        );
        // Show profile in webview
        bapPanel_1.BapPanel.show(profile);
      } catch (error) {
        vscode.window.showErrorMessage(
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
      const outpoint = await vscode.window.showInputBox({
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
  console.log('Bitcoin extension activated successfully!');
}
// this method is called when your extension is deactivated
function deactivate() {}
//# sourceMappingURL=extension.js.map
