import { createRequire } from 'module';
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

// Set test environment flag before any imports
process.env.TEST_ENV = 'true';

// Import setup to ensure VS Code mock is loaded first
import '../setup';
import mockVSCode, { executedCommands } from '../setup';

// Only modify `require` if it exists under Bun
if (typeof globalThis.require === 'function') {
  const originalRequire = globalThis.require as NodeRequire;
  const patchedRequire = ((id: string) => {
    if (id === 'vscode') {
      return mockVSCode;
    }
    return originalRequire(id);
  }) as NodeRequire;

  patchedRequire.resolve = originalRequire.resolve;
  patchedRequire.cache = originalRequire.cache;
  patchedRequire.extensions = originalRequire.extensions;
  patchedRequire.main = originalRequire.main;

  globalThis.require = patchedRequire;
}

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
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
import { activate } from '../../extension';
import vsApi from '../../vsShim';
import { KeyVault, KeyType } from '../../keyVault';

const TEST_WORKSPACE_DIR = '.test-bitcoin-workspace';

// Mock file system operations
const mockFs = {
  existsSync: mock((path: string) => true),
  mkdirSync: mock((path: string, options?: { recursive?: boolean }) => {}),
  readdirSync: mock((path: string) => []),
  rmdirSync: mock((path: string) => {}),
  statSync: mock((path: string) => ({
    isDirectory: () => true,
    size: 0,
    mtime: new Date(),
    ctime: new Date(),
  })),
  unlinkSync: mock((path: string) => {}),
};

// Helper function to recursively delete a directory
function deleteFolderRecursive(path: string) {
  if (mockFs.existsSync(path)) {
    for (const file of mockFs.readdirSync(path)) {
      const curPath = join(path, file);
      if (mockFs.statSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        mockFs.unlinkSync(curPath);
      }
    }
    mockFs.rmdirSync(path);
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
  secrets: new mockVSCode.SecretStorage(),
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
  let registeredCommands: string[] = [];

  beforeEach(() => {
    // Create test workspace directory
    if (!mockFs.existsSync(TEST_WORKSPACE_DIR)) {
      mockFs.mkdirSync(TEST_WORKSPACE_DIR);
    }

    // Update workspace path in VS Code mock
    mockVSCode.workspace.workspaceFolders = [
      {
        uri: { fsPath: TEST_WORKSPACE_DIR },
        name: 'test',
        index: 0,
      },
    ];

    // Ensure test environment flag is set
    process.env.TEST_ENV = 'true';

    registeredCommands = [];
    // Override registerCommand to track registered commands
    mockVSCode.commands.registerCommand = (
      command: string,
      _callback: (...args: unknown[]) => unknown,
    ) => {
      registeredCommands.push(command);
      return { dispose: () => {} };
    };
  });

  afterEach(() => {
    cleanupTestWorkspace();
  });

  // Extension activation test
  test('Extension activation', async () => {
    // Ensure test environment flag is set
    process.env.TEST_ENV = 'true';

    await activate(mockContext as ExtensionContext);
    expect(mockContext.subscriptions?.length ?? 0).toBeGreaterThan(0);
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
      `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
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
      `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
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
          `OP_DUP OP_HASH160 ${fromWif
            .toPublicKey()
            .toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
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
          `OP_DUP OP_HASH160 ${childPubKey.toHash(
            'hex',
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
        `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 2000,
    });

    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
    });
    tx.addOutput({
      lockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 1000,
    });

    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
  });

  // Command registration tests
  test('Command registration', async () => {
    await activate(mockContext as ExtensionContext);
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
      'bitcoin.openConversionTool',
      'bitcoin.showKeyVault',
      'bitcoin.test',
      'bitcoin.handleOutput',
      'bitcoin.encrypt',
      'bitcoin.decrypt',
      'bitcoin.lookupBapProfile',
      'bitcoin.fetchOrdinalsInscription',
      'bitcoin.decodeFile',
      'bitcoin.resetWelcomeScreen',
      'bitcoin.debugSelection',
      'bitcoin.convertToHex',
      'bitcoin.convertToBase64',
      'bitcoin.convertToBinary',
      'bitcoin.decodeHex',
      'bitcoin.decodeBase64',
      'bitcoin.exploreAddress'
    ];

    for (const cmd of expectedCommands) {
      expect(registeredCommands).toContain(cmd);
    }
    expect(registeredCommands).toHaveLength(expectedCommands.length);
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

  // Key Vault tests
  describe('Key Vault', () => {
    let vault: KeyVault;

    beforeEach(() => {
      vault = new KeyVault(mockContext as ExtensionContext);
    });

    afterEach(async () => {
      await vault.clearAllKeys();
    });

    test('stores and retrieves a key', async () => {
      const keyEntry = {
        type: 'private' as KeyType,
        label: 'Test Key',
        value: 'test-value'
      };

      const id = await vault.storeKey(keyEntry);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      const retrieved = await vault.getKey(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe(keyEntry.type);
      expect(retrieved?.label).toBe(keyEntry.label);
      expect(retrieved?.value).toBe(keyEntry.value);
    });

    test('lists all stored keys', async () => {
      const keys = [
        { type: 'private' as KeyType, label: 'Key 1', value: 'value1' },
        { type: 'public' as KeyType, label: 'Key 2', value: 'value2' }
      ];

      // Store keys sequentially to avoid race condition
      const id1 = await vault.storeKey(keys[0]);
      const id2 = await vault.storeKey(keys[1]);
      const ids = [id1, id2];

      console.log('Stored key IDs:', ids);

      const allKeys = await vault.getAllKeys();
      console.log('Retrieved keys:', allKeys);

      expect(allKeys).toHaveLength(2);
      expect(allKeys.map(k => k.id).sort()).toEqual(ids.sort());
    });

    test('deletes a key', async () => {
      const id = await vault.storeKey({
        type: 'private' as KeyType,
        label: 'To Delete',
        value: 'delete-me'
      });

      await vault.deleteKey(id);
      const retrieved = await vault.getKey(id);
      expect(retrieved).toBeUndefined();
    });

    test('updates key label', async () => {
      const id = await vault.storeKey({
        type: 'private' as KeyType,
        label: 'Old Label',
        value: 'test-value'
      });

      await vault.updateKeyLabel(id, 'New Label');
      const updated = await vault.getKey(id);
      expect(updated?.label).toBe('New Label');
    });

    test('manages encryption key', async () => {
      const id = await vault.storeKey({
        type: 'encryption' as KeyType,
        label: 'Encryption Key',
        value: 'secret'
      });

      await vault.setEncryptionKey(id);
      const encKey = await vault.getEncryptionKey();
      expect(encKey?.id).toBe(id);
      expect(encKey?.isEncryptionKey).toBe(true);

      await vault.clearEncryptionKey();
      const cleared = await vault.getEncryptionKey();
      expect(cleared).toBeUndefined();
    });

    test('searches keys', async () => {
      await vault.storeKey({
        type: 'private' as KeyType,
        label: 'Test Key',
        value: 'value1'
      });
      await vault.storeKey({
        type: 'public' as KeyType,
        label: 'Another Key',
        value: 'value2'
      });

      const results = await vault.searchKeys('test');
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('Test Key');
    });
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
        `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 2000,
    });

    // Create a spending transaction
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
    });
    tx.addOutput({
      lockingScript: Script.fromASM(
        `OP_DUP OP_HASH160 ${pubKey.toHash('hex')} OP_EQUALVERIFY OP_CHECKSIG`,
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
});
