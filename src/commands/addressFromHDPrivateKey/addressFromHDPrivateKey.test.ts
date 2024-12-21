import { describe, expect, test, mock, afterAll } from 'bun:test';
import vscode from '@test/setup';
import { addressFromHDPrivateKey } from './index';
import type { OutputManager } from '../../output';
import { HD, PrivateKey } from '@bsv/sdk';

interface VSCodeOptions {
  placeHolder?: string;
  prompt?: string;
  value?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validateInput?: (value: string) => string | null;
}

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

// Mock window.showInputBox
const originalShowInputBox = vscode.window.showInputBox;

describe('addressFromHDPrivateKey', () => {
  test('generates valid address from HD private key', async () => {
    // Create a known HD private key
    const hdPrivKey = HD.fromRandom();
    const path = 'm/0/0';
    const derivedKey = hdPrivKey.derive(path);
    const privKey = PrivateKey.fromHex(derivedKey.privKey.toString());
    const pubKey = privKey.toPublicKey();
    const expectedAddress = pubKey.toAddress();

    // Mock user inputs
    let inputCount = 0;
    vscode.window.showInputBox = async () => {
      inputCount++;
      return inputCount === 1 ? hdPrivKey.toString() : path;
    };

    const result = await addressFromHDPrivateKey(mockOutput);
    
    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expectedAddress,
      type: 'addresses',
      name: 'from_hdprivkey_m_0_0',
    });

    // Verify it's a valid address format
    expect(result?.data).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
  });

  test('returns undefined when xpriv input is cancelled', async () => {
    // Mock cancelled first input
    vscode.window.showInputBox = async () => undefined;

    const result = await addressFromHDPrivateKey(mockOutput);
    expect(result).toBeUndefined();
  });

  test('returns undefined when path input is cancelled', async () => {
    // Mock cancelled second input
    let inputCount = 0;
    vscode.window.showInputBox = async () => {
      inputCount++;
      return inputCount === 1 ? 'xprv...' : undefined;
    };

    const result = await addressFromHDPrivateKey(mockOutput);
    expect(result).toBeUndefined();
  });

  test('handles invalid HD private key', async () => {
    // Mock invalid input
    vscode.window.showInputBox = async () => 'invalid';

    await expect(addressFromHDPrivateKey(mockOutput)).rejects.toThrow();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 