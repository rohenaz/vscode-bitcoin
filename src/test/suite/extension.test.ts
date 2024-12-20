import type { ExtensionContext, LanguageModelChat } from 'vscode';
// Import setup to ensure VS Code mock is loaded first
import vscode from '../../../setup';

import { beforeAll, describe, expect, test } from 'bun:test';
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

describe('Bitcoin Extension Tests', () => {
  test('HD key generation', () => {
    const hdKey = HD.fromRandom();
    expect(hdKey).toBeDefined();
    expect(hdKey.toString()).toMatch(/^xprv/);
  });

  test('Private key operations', () => {
    const privKey = PrivateKey.fromRandom();
    expect(privKey).toBeDefined();
    expect(privKey.toWif()).toMatch(/^[KL][1-9A-HJ-NP-Za-km-z]{51}/);
  });

  test('Public key operations', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    expect(pubKey).toBeDefined();
    expect(pubKey.toString()).toMatch(/^0[2-3][0-9A-Fa-f]{64}/);
  });

  test('Script operations', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
    expect(script).toBeDefined();
    expect(script.toASM()).toContain('OP_DUP OP_HASH160');
  });

  test('Address generation', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(pubKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
    const address = Utils.toBase58Check(Utils.toArray(script.toHex()));
    expect(address).toBeDefined();
    expect(address).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}/);
  });

  test('Transaction decoding', () => {
    const tx = new Transaction();
    expect(tx).toBeDefined();
    expect(tx.inputs).toHaveLength(0);
    expect(tx.outputs).toHaveLength(0);
  });

  test('Mnemonic operations', () => {
    const mnemonic = Mnemonic.fromRandom();
    expect(mnemonic).toBeDefined();
    expect(mnemonic.toString().split(' ').length).toBe(12);
  });

  test('Command registration', async () => {
    const commands = await vscode.commands.getCommands();
    const bitcoinCommands = commands.filter((cmd: string) =>
      cmd.startsWith('bitcoin.')
    );
    expect(bitcoinCommands).toHaveLength(19);
  });

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

  test('Transaction format conversion', () => {
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
      sourceTransaction: sourceTx, // Pass the actual Transaction object
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
  });
});
