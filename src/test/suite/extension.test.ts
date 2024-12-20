// Import setup to ensure VS Code mock is loaded first
import * as vscode from '../../../setup';
import { activate } from '../../extension';
import type { ExtensionContext, Uri, EnvironmentVariableCollection, EnvironmentVariableMutator, GlobalEnvironmentVariableCollection } from 'vscode';

import { describe, expect, test } from 'bun:test';
import {
  HD,
  Mnemonic,
  PrivateKey,
  PublicKey,
  Script,
  Transaction,
  Utils,
} from '@bsv/sdk';
import { parse } from 'bpu-ts';
import { allProtocols, TransformTx } from 'bmapjs';

// Helper function to create a mock Uri
const createMockUri = (): Uri => {
  const uri = {
    scheme: '',
    authority: '',
    path: '',
    query: '',
    fragment: '',
    fsPath: '',
    with: (change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri => createMockUri(),
    toString: () => '',
    toJSON: () => ({ scheme: '', authority: '', path: '', query: '', fragment: '' }),
  };
  return uri;
};

// Helper function to create a mock EnvironmentVariableCollection
const createMockEnvVarCollection = (): GlobalEnvironmentVariableCollection => ({
  persistent: false,
  replace: () => {},
  append: () => {},
  prepend: () => {},
  get: (variable: string): EnvironmentVariableMutator | undefined => undefined,
  forEach: (callback: (variable: string, mutator: EnvironmentVariableMutator, collection: EnvironmentVariableCollection) => void) => {},
  delete: (variable: string) => {},
  clear: () => {},
  description: undefined,
  [Symbol.iterator]: function* () {},
  getScoped: () => createMockEnvVarCollection(),
});

describe('Bitcoin Extension Tests', () => {
  // Extension activation test
  test('Extension activation', async () => {
    const context: Partial<ExtensionContext> = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
      },
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        setKeysForSync: () => {},
        keys: () => [],
      },
      extensionPath: '',
      storagePath: '',
      globalStoragePath: '',
      logPath: '',
      asAbsolutePath: (relativePath: string) => relativePath,
      extensionUri: createMockUri(),
      environmentVariableCollection: createMockEnvVarCollection(),
      storageUri: createMockUri(),
      globalStorageUri: createMockUri(),
      logUri: createMockUri(),
      extensionMode: 1,
      extension: {
        id: '',
        extensionUri: createMockUri(),
        extensionPath: '',
        isActive: false,
        packageJSON: {},
        extensionKind: 1,
        exports: undefined,
        activate: () => Promise.resolve(undefined),
      },
      secrets: {
        get: () => Promise.resolve(undefined),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        onDidChange: () => ({ dispose: () => {} }),
      },
    };

    await activate(context as ExtensionContext);
    expect(context.subscriptions).toHaveLength(18); // One for each command
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

  test('Private key operations', () => {
    // Test random generation
    const privKey = PrivateKey.fromRandom();
    expect(privKey).toBeDefined();
    expect(privKey.toWif()).toMatch(/^[KL][1-9A-HJ-NP-Za-km-z]{51}/);

    // Test WIF conversion
    const wif = privKey.toWif();
    const fromWif = PrivateKey.fromWif(wif);
    expect(fromWif.toString()).toBe(privKey.toString());

    // Test hex conversion
    const hex = privKey.toString();
    const fromHex = PrivateKey.fromString(hex);
    expect(fromHex.toString()).toBe(hex);
  });

  test('Public key operations', () => {
    // Test public key derivation
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    expect(pubKey).toBeDefined();
    expect(pubKey.toString()).toMatch(/^0[2-3][0-9A-Fa-f]{64}/);

    // Test public key from string
    const pubKeyStr = pubKey.toString();
    const fromStr = PublicKey.fromString(pubKeyStr);
    expect(fromStr.toString()).toBe(pubKeyStr);
  });

  test('Script operations', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();

    // Test P2PKH script creation
    const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
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
    const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
    const address = Utils.toBase58Check(Utils.toArray(script.toHex()));
    expect(address).toBeDefined();
    expect(address).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}/);

    // Test address from WIF
    const wif = privKey.toWif();
    const fromWif = PrivateKey.fromWif(wif);
    const addressFromWif = Utils.toBase58Check(Utils.toArray(Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(fromWif.toPublicKey().toHash()))} OP_EQUALVERIFY OP_CHECKSIG`).toHex()));
    expect(addressFromWif).toBe(address);

    // Test address from HD key
    const hdKey = HD.fromRandom();
    const child = hdKey.derive("m/44'/0'/0'/0/0");
    const childPrivKey = PrivateKey.fromHex(child.privKey.toString());
    const childPubKey = childPrivKey.toPublicKey();
    const addressFromHD = Utils.toBase58Check(Utils.toArray(Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(childPubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`).toHex()));
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
      lockingScript: Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`),
      satoshis: 2000
    });
    
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`)
    });
    tx.addOutput({
      lockingScript: Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`),
      satoshis: 1000
    });

    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
  });

  test('Mnemonic operations', () => {
    // Test mnemonic generation
    const mnemonic = Mnemonic.fromRandom();
    expect(mnemonic).toBeDefined();
    expect(mnemonic.toString().split(' ').length).toBe(12);

    // Test seed generation
    const seed = mnemonic.toSeed();
    expect(seed).toBeDefined();

    // Test HD key from mnemonic
    const hdKey = HD.fromSeed(seed);
    expect(hdKey).toBeDefined();
    expect(hdKey.toString()).toMatch(/^xprv/);
  });

  // Command registration tests
  test('Command registration', async () => {
    const commands = await vscode.commands.getCommands();
    const bitcoinCommands = commands.filter((cmd: string) =>
      cmd.startsWith('bitcoin.')
    );
    
    // Test all expected commands are registered
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
      'bitcoin.decodeRawTx',
      'bitcoin.rawTxToTxo',
      'bitcoin.rawTxToBob'
    ];

    for (const cmd of expectedCommands) {
      expect(bitcoinCommands).toContain(cmd);
    }
    expect(bitcoinCommands).toHaveLength(expectedCommands.length);
  });

  // Error handling tests
  test('Invalid private key handling', () => {
    expect(() => PrivateKey.fromString('invalid')).toThrow('Invalid character in invalid');
  });

  test('Invalid public key handling', () => {
    expect(() => PublicKey.fromString('invalid')).toThrow('Unknown point format');
  });

  test('Invalid WIF handling', () => {
    expect(() => PrivateKey.fromWif('invalid')).toThrow('Invalid base58 character');
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
      lockingScript: Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`),
      satoshis: 2000
    });
    
    // Create a spending transaction
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`)
    });
    tx.addOutput({
      lockingScript: Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`),
      satoshis: 1000
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

    // Test BMAP transformation
    const bmap = await TransformTx(bob, allProtocols.map(p => p.name));
    expect(bmap).toBeDefined();
  });
});
