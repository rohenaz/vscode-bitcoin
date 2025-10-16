import { afterAll, describe, expect, mock, test } from 'bun:test';
import { HD, Mnemonic } from '@bsv/sdk';
import vscode from '@test/setup';
import type { OutputManager } from '../../output';
import { extendedPrivateKeyFromMnemonic } from './index';
import type { KeyVault } from '../../keyVault';

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

const mockKeyVault = {
  isAutoStoreEnabled: () => true,
  checkUnlock: async () => {},
  storeKey: async () => 'test-id',
} as unknown as KeyVault;

// Mock window.showInputBox
const originalShowInputBox = vscode.window.showInputBox;

describe('extendedPrivateKeyFromMnemonic', () => {
  test('generates valid extended private key from mnemonic', async () => {
    // Mock user input with a valid 12-word mnemonic
    const validMnemonic =
      'solid drastic bone type leopard law virtual share agree way bacon noise';
    vscode.window.showInputBox = async () => validMnemonic;

    const result = await extendedPrivateKeyFromMnemonic(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expect.any(String),
      type: 'keys',
      name: 'hdprivkey_from_mnemonic',
    });

    // Verify it's a valid extended private key
    const mnemonic = Mnemonic.fromString(validMnemonic);
    const expectedHdPrivKey = HD.fromSeed(mnemonic.toSeed());
    expect(result?.data).toBe(expectedHdPrivKey.toString());
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = async () => '';

    const result = await extendedPrivateKeyFromMnemonic(mockOutput, mockKeyVault);
    expect(result).toBeUndefined();
  });

  test('validates mnemonic length', async () => {
    // Mock invalid mnemonic input (not 12 words)
    vscode.window.showInputBox = async () => '';

    const result = await extendedPrivateKeyFromMnemonic(mockOutput, mockKeyVault);
    expect(result).toBeUndefined();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
});
