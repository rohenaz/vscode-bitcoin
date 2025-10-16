import { describe, it, expect } from 'bun:test';
import { PrivateKey } from '@bsv/sdk';

describe('insertKey command', () => {
  it('should convert WIF to hex format', () => {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();
    const hex = privKey.toHex();

    const recoveredPrivKey = PrivateKey.fromWif(wif);
    expect(recoveredPrivKey.toHex()).toBe(hex);
  });

  it('should convert WIF to decimal format', () => {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();
    const decimal = privKey.toString();

    const recoveredPrivKey = PrivateKey.fromWif(wif);
    expect(recoveredPrivKey.toString()).toBe(decimal);
  });

  it('should preserve WIF format when converting WIF to WIF', () => {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();

    const recoveredPrivKey = PrivateKey.fromWif(wif);
    expect(recoveredPrivKey.toWif()).toBe(wif);
  });

  it('should convert hex private key to WIF', () => {
    const privKey = PrivateKey.fromRandom();
    const hex = privKey.toHex();

    const recoveredPrivKey = PrivateKey.fromString(hex, 'hex');
    expect(recoveredPrivKey.toWif()).toBe(privKey.toWif());
  });
});


