import vscode from '@test/setup';
import { describe, expect, test, mock, afterAll } from 'bun:test';
import { addressFromHDPublicKey } from './index';
import type { OutputManager } from '../../output';
import { HD } from '@bsv/sdk';

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

describe('addressFromHDPublicKey', () => {
  test('generates valid address from HD public key', async () => {
    // Create a known HD public key
    const hdPrivKey = HD.fromRandom();
    const hdPubKey = hdPrivKey.toPublic();
    const path = 'm/0/0';
    const derivedPubKey = hdPubKey.derive(path);
    const expectedAddress = derivedPubKey.pubKey.toAddress();

    // Mock user inputs
    let inputCount = 0;
    vscode.window.showInputBox = mock(async () => {
      inputCount++;
      return inputCount === 1 ? hdPubKey.toString() : path;
    }) as unknown as typeof vscode.window.showInputBox;

    const result = await addressFromHDPublicKey(mockOutput);
    
    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expectedAddress,
      type: 'addresses',
      name: 'from_hdpubkey_m_0_0',
    });

    // Verify it's a valid address format
    expect(result?.data).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
  });

  test('returns undefined when xpub input is cancelled', async () => {
    // Mock cancelled first input
    vscode.window.showInputBox = mock(async () => undefined) as unknown as typeof vscode.window.showInputBox;

    const result = await addressFromHDPublicKey(mockOutput);
    expect(result).toBeUndefined();
  });

  test('returns undefined when path input is cancelled', async () => {
    // Mock cancelled second input
    let inputCount = 0;
    vscode.window.showInputBox = mock(async () => {
      inputCount++;
      return inputCount === 1 ? 'xpub...' : undefined;
    }) as unknown as typeof vscode.window.showInputBox;

    const result = await addressFromHDPublicKey(mockOutput);
    expect(result).toBeUndefined();
  });

  test('handles invalid HD public key', async () => {
    // Mock invalid input
    vscode.window.showInputBox = mock(async () => 'invalid') as unknown as typeof vscode.window.showInputBox;

    await expect(addressFromHDPublicKey(mockOutput)).rejects.toThrow();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 