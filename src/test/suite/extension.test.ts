import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import type {
  ExtensionContext,
  GlobalEnvironmentVariableCollection,
  Memento,
  Uri,
} from 'vscode';
// Import setup to ensure VS Code mock is loaded first
import vscode, { executedCommands } from '../setup';
import { activate, convertData, detectFormat } from '../../extension';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  HD,
  Mnemonic,
  PrivateKey,
  PublicKey,
  Script,
  Transaction,
  Utils,
} from '@bsv/sdk';
import { TransformTx, allProtocols } from 'bmapjs';
import type { BobTx } from 'bmapjs';
import { parse } from 'bpu-ts';
import { WelcomePanel } from '../../welcomePanel';

const TEST_WORKSPACE_DIR = '.test-bitcoin-workspace';

// Helper function to recursively delete a directory
function deleteFolderRecursive(path: string) {
  if (existsSync(path)) {
    for (const file of readdirSync(path)) {
      const curPath = join(path, file);
      if (statSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        unlinkSync(curPath);
      }
    }
    rmdirSync(path);
  }
}

// Helper function to clean up test workspace
function cleanupTestWorkspace() {
  try {
    deleteFolderRecursive(TEST_WORKSPACE_DIR);
  } catch (error) {
    console.error('Error cleaning up test workspace:', error);
  }
}

// Mock ExtensionContext with test workspace path
const mockContext: Partial<ExtensionContext> = {
  subscriptions: [],
  extensionPath: '',
  globalState: {
    get: (_key: string): unknown => undefined,
    update: (_key: string, _value: unknown): Thenable<void> =>
      Promise.resolve(),
    keys: (): readonly string[] => [],
    setKeysForSync: (_keys: readonly string[]): void => {},
  } as Memento & { setKeysForSync(keys: readonly string[]): void },
  workspaceState: {
    get: (_key: string): unknown => undefined,
    update: (_key: string, _value: unknown): Thenable<void> =>
      Promise.resolve(),
    keys: (): readonly string[] => [],
    setKeysForSync: (_keys: readonly string[]): void => {},
  } as Memento & { setKeysForSync(keys: readonly string[]): void },
  environmentVariableCollection: {} as GlobalEnvironmentVariableCollection,
  extensionUri: {} as Uri,
  storageUri: undefined,
  globalStorageUri: {} as Uri,
  logUri: {} as Uri,
  extensionMode: 1,
  extension: {
    id: 'test',
    extensionKind: 1,
    extensionUri: {} as Uri,
    extensionPath: '',
    isActive: true,
    packageJSON: {},
    exports: undefined,
    activate: () => Promise.resolve(),
  },
  asAbsolutePath: (relativePath: string) => relativePath,
  storagePath: undefined,
  globalStoragePath: '',
  logPath: '',
};

describe('Bitcoin Extension Tests', () => {
  beforeEach(() => {
    // Create test workspace directory
    if (!existsSync(TEST_WORKSPACE_DIR)) {
      mkdirSync(TEST_WORKSPACE_DIR);
    }

    // Update workspace path in VS Code mock
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: TEST_WORKSPACE_DIR },
        name: 'test',
        index: 0,
      },
    ];
  });

  afterEach(() => {
    cleanupTestWorkspace();
  });

  // Extension activation test
  test('Extension activation', async () => {
    await activate(mockContext as ExtensionContext);
    expect(mockContext.subscriptions).toHaveLength(29); // One for each command
  });

  // Basic functionality tests
  test('HD key generation and derivation', () => {
    // Test HD key generation
    const hdKey = HD.fromRandom();
    expect(hdKey).toBeDefined();
    expect(hdKey.toString()).toMatch(/^xprv/);

    // Test derivation
    const child = hdKey.derive("m/44'/0'/0'/0/0");
    expect(child).toBeDefined();
    expect(child.toString()).toMatch(/^xprv/);

    // Test public derivation
    const hdPub = hdKey.toPublic();
    expect(hdPub).toBeDefined();
    expect(hdPub.toString()).toMatch(/^xpub/);
  });

  test('Script operations', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();

    // Test P2PKH script creation
    const script = Script.fromASM(
      `OP_DUP OP_HASH160 ${Utils.toHex(
        Utils.toArray(pubKey.toHash()),
      )} OP_EQUALVERIFY OP_CHECKSIG`,
    );
    expect(script).toBeDefined();
    expect(script.toASM()).toContain('OP_DUP OP_HASH160');

    // Test script to ASM conversion
    const asm = script.toASM();
    const fromAsm = Script.fromASM(asm);
    expect(fromAsm.toHex()).toBe(script.toHex());
  });

  test('Address generation and validation', () => {
    // Test P2PKH address from private key
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    const script = Script.fromASM(
      `OP_DUP OP_HASH160 ${Utils.toHex(
        Utils.toArray(pubKey.toHash()),
      )} OP_EQUALVERIFY OP_CHECKSIG`,
    );
    const address = Utils.toBase58Check(Utils.toArray(script.toHex()));
    expect(address).toBeDefined();
    expect(address).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}/);

    // Test address from WIF
    const wif = privKey.toWif();
    const fromWif = PrivateKey.fromWif(wif);
    const addressFromWif = Utils.toBase58Check(
      Utils.toArray(
        Script.fromASM(
          `OP_DUP OP_HASH160 ${Utils.toHex(
            Utils.toArray(fromWif.toPublicKey().toHash()),
          )} OP_EQUALVERIFY OP_CHECKSIG`,
        ).toHex(),
      ),
    );
    expect(addressFromWif).toBe(address);

    // Test address from HD key
    const hdKey = HD.fromRandom();
    const child = hdKey.derive("m/44'/0'/0'/0/0");
    const childPrivKey = PrivateKey.fromHex(child.privKey.toString());
    const childPubKey = childPrivKey.toPublicKey();
    const addressFromHD = Utils.toBase58Check(
      Utils.toArray(
        Script.fromASM(
          `OP_DUP OP_HASH160 ${Utils.toHex(
            Utils.toArray(childPubKey.toHash()),
          )} OP_EQUALVERIFY OP_CHECKSIG`,
        ).toHex(),
      ),
    );
    expect(addressFromHD).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}/);
  });

  test('Transaction operations', () => {
    // Test transaction creation
    const tx = new Transaction();
    expect(tx).toBeDefined();
    expect(tx.inputs).toHaveLength(0);
    expect(tx.outputs).toHaveLength(0);

    // Test input/output addition
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();

    const sourceTx = new Transaction();
    sourceTx.addOutput({
      lockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${Utils.toHex(
          Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 2000,
    });

    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${Utils.toHex(
          Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
    });
    tx.addOutput({
      lockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${Utils.toHex(
          Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 1000,
    });

    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
  });

  // Command registration tests
  test('Command registration', async () => {
    const registeredCommands = await vscode.commands.getCommands();
    const expectedCommands = [
      'bitcoin.asmFromScript',
      'bitcoin.addressFromWIF',
      'bitcoin.addressFromPublicKey',
      'bitcoin.addressFromPrivateKey',
      'bitcoin.addressFromHDPublicKey',
      'bitcoin.addressFromHDPrivateKey',
      'bitcoin.generatePublicKey',
      'bitcoin.generatePrivateKey',
      'bitcoin.generateHDPublicKey',
      'bitcoin.getUtxosForAddress',
      'bitcoin.xPubFromxPriv',
      'bitcoin.extendedPrivateKeyFromMnemonic',
      'bitcoin.generateHDPrivateKey',
      'bitcoin.generateMnemonic',
      'bitcoin.generateWIF',
      'bitcoin.getTx',
      'bitcoin.publicKeyFromPrivateKey',
      'bitcoin.publicKeyFromWIF',
      'bitcoin.decodeRawTx',
      'bitcoin.rawTxToBob',
      'bitcoin.convertData',
      'bitcoin.showKeyVault',
      'bitcoin.test',
      'bitcoin.detectAndConvert',
      'bitcoin.handleOutput',
      'bitcoin.encrypt',
      'bitcoin.decrypt',
      'bitcoin.lookupBapProfile',
      'bitcoin.fetchOrdinalsInscription',
    ];

    for (const cmd of expectedCommands) {
      expect(registeredCommands).toContain(cmd);
    }
    expect(registeredCommands).toHaveLength(29);
  });

  // Error handling tests
  test('Invalid private key handling', () => {
    expect(() => PrivateKey.fromString('invalid')).toThrow(
      'Invalid character in invalid',
    );
  });

  test('Invalid public key handling', () => {
    expect(() => PublicKey.fromString('invalid')).toThrow(
      'Unknown point format',
    );
  });

  test('Invalid WIF handling', () => {
    expect(() => PrivateKey.fromWif('invalid')).toThrow(
      'Invalid base58 character',
    );
  });

  test('Invalid transaction hex handling', () => {
    const tx = Transaction.fromHex('invalid');
    // SDK returns an empty transaction for invalid hex
    expect(tx.inputs).toHaveLength(0);
    expect(tx.outputs).toHaveLength(0);
    expect(tx.toHex()).toBe('00000a00000000000000'); // Version 10 (0x0a), no inputs, no outputs
  });

  test('Invalid mnemonic handling', () => {
    const mnemonic = Mnemonic.fromString('invalid mnemonic phrase');
    // SDK returns an invalid mnemonic object
    expect(mnemonic.isValid()).toBe(false);
    expect(() => mnemonic.toSeed()).toThrow('Mnemonic does not pass the check');
  });

  // Transaction format conversion tests
  test('Transaction format conversion', async () => {
    // Create a valid transaction for testing
    const tx = new Transaction();
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();

    // Create a source transaction with funding
    const sourceTx = new Transaction();
    sourceTx.addOutput({
      lockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${Utils.toHex(
          Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 2000,
    });

    // Create a spending transaction
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${Utils.toHex(
          Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
    });
    tx.addOutput({
      lockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${Utils.toHex(
          Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 1000,
    });

    // Test hex format
    const txHex = tx.toHex();
    expect(txHex).toBeDefined();
    expect(txHex.length).toBeGreaterThan(0);

    // Test BEEF format (requires source transactions)
    const beefTx = tx.toBEEF();
    expect(beefTx).toBeDefined();
    expect(beefTx.length).toBeGreaterThan(0);

    // Test EF format
    const efTx = tx.toEF();
    expect(efTx).toBeDefined();
    expect(efTx.length).toBeGreaterThan(0);

    // Test BOB format
    const bob = await parse({
      tx: { r: txHex },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });
    expect(bob).toBeDefined();
    expect(bob.tx).toBeDefined();
    expect(bob.in).toHaveLength(1);
    expect(bob.out).toHaveLength(1);

    console.log('Parsed BOB:', JSON.stringify(bob, null, 2));

    // Test BMAP format
    console.log('Transforming transaction with bmapjs...');
    const bmapResult = await TransformTx(
      bob as unknown as BobTx,
      allProtocols.map((p) => p.name),
    );
    expect(bmapResult).toBeDefined();
    expect(bmapResult.tx).toBeDefined();
  });

  // Data conversion tests
  describe('Data Conversion', () => {
    test('Format detection', () => {
      // Test hex detection
      expect(detectFormat('48656c6c6f')).toBe('hex');
      expect(detectFormat('not-hex-123')).toBe('unknown');

      // Test base64 detection
      expect(detectFormat('SGVsbG8=')).toBe('base64');
      expect(detectFormat('not-base64!')).toBe('unknown');

      // Test binary array detection
      expect(detectFormat('[72,101,108,108,111]')).toBe('binary');
      expect(detectFormat('[1,2,invalid]')).toBe('unknown');
    });

    test('Hex conversions', () => {
      const hex = '48656c6c6f'; // "Hello" in hex

      // Hex to base64
      expect(convertData(hex, 'hex', 'base64')).toBe('SGVsbG8=');

      // Hex to binary
      expect(convertData(hex, 'hex', 'binary')).toBe('[72,101,108,108,111]');
    });

    test('Base64 conversions', () => {
      const base64 = 'SGVsbG8='; // "Hello" in base64

      // Base64 to hex
      expect(convertData(base64, 'base64', 'hex')).toBe('48656c6c6f');

      // Base64 to binary
      expect(convertData(base64, 'base64', 'binary')).toBe(
        '[72,101,108,108,111]',
      );
    });

    test('Binary array conversions', () => {
      const binary = '[72,101,108,108,111]'; // "Hello" as byte array

      // Binary to hex
      expect(convertData(binary, 'binary', 'hex')).toBe('48656c6c6f');

      // Binary to base64
      expect(convertData(binary, 'binary', 'base64')).toBe('SGVsbG8=');
    });

    test('Error handling', () => {
      // Invalid hex
      expect(() => convertData('not-hex', 'hex', 'base64')).toThrow();

      // Invalid base64
      expect(() => convertData('not-base64!', 'base64', 'hex')).toThrow();

      // Invalid binary array
      expect(() => convertData('[1,2,invalid]', 'binary', 'hex')).toThrow();

      // Invalid format types
      expect(() => convertData('48656c6c6f', 'hex', 'invalid-format')).toThrow(
        'Unsupported output format',
      );
      expect(() => convertData('48656c6c6f', 'invalid-format', 'hex')).toThrow(
        'Unsupported input format',
      );
    });

    test('Round trip conversions', () => {
      const originalHex = '48656c6c6f';

      // Hex -> Base64 -> Hex
      expect(
        convertData(convertData(originalHex, 'hex', 'base64'), 'base64', 'hex'),
      ).toBe(originalHex);

      // Hex -> Binary -> Hex
      expect(
        convertData(convertData(originalHex, 'hex', 'binary'), 'binary', 'hex'),
      ).toBe(originalHex);

      // Base64 -> Binary -> Base64
      const originalBase64 = 'SGVsbG8=';
      expect(
        convertData(
          convertData(originalBase64, 'base64', 'binary'),
          'binary',
          'base64',
        ),
      ).toBe(originalBase64);
    });
  });
});
