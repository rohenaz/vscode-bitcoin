import assert from 'node:assert';
import {
  HD,
  PrivateKey,
  PublicKey,
  Script,
  Transaction,
  Utils,
} from '@bsv/sdk';
import { after, before, describe, it } from 'mocha';
import * as vscode from 'vscode';

describe('Bitcoin Extension Test Suite', () => {
  before(() => {
    vscode.window.showInformationMessage('Start Bitcoin extension tests.');
  });

  after(() => {
    vscode.window.showInformationMessage('All tests completed.');
  });

  it('should generate and derive HD keys', () => {
    const hdPrivKey = HD.fromRandom();
    assert.ok(hdPrivKey, 'HD private key should be generated');

    const hdPubKey = hdPrivKey.toPublic();
    assert.ok(hdPubKey, 'HD public key should be derived');

    const derivedKey = hdPrivKey.derive("m/44'/0'/0'/0/0");
    assert.ok(derivedKey, 'Should derive child key');
  });

  it('should perform private key operations', () => {
    const privKey = PrivateKey.fromRandom();
    assert.ok(privKey, 'Private key should be generated');

    const wif = privKey.toWif();
    assert.ok(wif, 'Should convert to WIF format');

    const fromWif = PrivateKey.fromWif(wif);
    assert.ok(fromWif, 'Should create private key from WIF');
    assert.strictEqual(
      privKey.toString(),
      fromWif.toString(),
      'Keys should match'
    );
  });

  it('should perform public key operations', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    assert.ok(pubKey, 'Public key should be derived');

    const pubKeyString = pubKey.toString();
    assert.ok(pubKeyString, 'Should convert public key to string');

    const fromString = PublicKey.fromString(pubKeyString);
    assert.ok(fromString, 'Should create public key from string');
    assert.strictEqual(
      pubKey.toString(),
      fromString.toString(),
      'Public keys should match'
    );
  });

  it('should perform script operations', () => {
    const scriptHex = '76a914d8b7c5399b45d9e0c067d29e561fe98721eeb44788ac';
    const script = Script.fromHex(scriptHex);
    assert.ok(script, 'Should create script from hex');

    const asm = script.toASM();
    assert.ok(asm, 'Should convert script to ASM');
    assert.ok(asm.includes('OP_DUP'), 'ASM should contain expected opcodes');
  });

  it('should generate addresses', () => {
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();

    // Generate address from public key
    const pubKeyBytes = Utils.toArray(pubKey.toString());
    const address = Utils.toBase58Check(pubKeyBytes);
    assert.ok(address, 'Should generate address from public key');
    assert.ok(
      address.startsWith('1') || address.startsWith('3'),
      'Address should have valid prefix'
    );
  });

  it('should decode transactions', async () => {
    // Test raw transaction hex
    const rawTxHex =
      '0100000001f3f6a909f8521adb57d898d2985834e632374e770fd9e2b98656f1bf1fdfd427010000006b48304502203a776322ebf8eb8b58cc6ced4f2574f4c73aa664edce0b0022690f2f6f47c521022100b82353305988cb0ebd443089a173ceec93fe4dbfe98d74419ecc84a6a698e31d012103c5c1bc61f60ce3d6223a63ceec28c8219a21026d593df333f4579d0aefb5a38dffffffff02a0860100000000001976a914da17fb4c6c0ff33c7d52ee82907f40c6d0ea81c688ac90940d000000000017a91472c44f957fc011d97e3406667dca5b1c930c4026870000000000';

    try {
      const tx = Transaction.fromHex(rawTxHex);
      assert.ok(tx, 'Should decode raw transaction');
      assert.ok(tx.inputs.length > 0, 'Transaction should have inputs');
      assert.ok(tx.outputs.length > 0, 'Transaction should have outputs');
      assert.ok(tx.version > 0, 'Transaction should have a version');

      // Additional assertions to use tx variable
      assert.strictEqual(
        tx.inputs.length,
        1,
        'Transaction should have exactly 1 input'
      );
      assert.strictEqual(
        tx.outputs.length,
        2,
        'Transaction should have exactly 2 outputs'
      );
      assert.strictEqual(tx.version, 1, 'Transaction version should be 1');
      assert.ok(
        tx.toHex(),
        'Should be able to convert transaction back to hex'
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        assert.fail(`Transaction decoding failed: ${error.message}`);
      } else {
        assert.fail('Transaction decoding failed with unknown error');
      }
    }
  });

  it('should register extension commands', async () => {
    const commands = await vscode.commands.getCommands();

    // Check if our commands are registered
    assert.ok(
      commands.includes('bitcoin.generateHDPublicKey'),
      'HD public key command should be registered'
    );
    assert.ok(
      commands.includes('bitcoin.generatePrivateKey'),
      'Private key command should be registered'
    );
    assert.ok(
      commands.includes('bitcoin.generateWIF'),
      'WIF command should be registered'
    );
    assert.ok(
      commands.includes('bitcoin.addressFromPublicKey'),
      'Address from public key command should be registered'
    );
  });
});
