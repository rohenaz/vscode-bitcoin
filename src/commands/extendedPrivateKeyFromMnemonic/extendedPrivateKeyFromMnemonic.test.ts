import vscode from '@test/setup';
import { describe, expect, test, mock, afterAll } from 'bun:test';
import { extendedPrivateKeyFromMnemonic } from './index';
import type { OutputManager } from '../../output';
import { HD, Mnemonic } from '@bsv/sdk';

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

describe('extendedPrivateKeyFromMnemonic', () => {
  test('generates valid extended private key from mnemonic', async () => {
    // Mock user input with a valid 12-word mnemonic
    const validMnemonic = 'solid drastic bone type leopard law virtual share agree way bacon noise';
    vscode.window.showInputBox = async () => validMnemonic;

    const result = await extendedPrivateKeyFromMnemonic(mockOutput);
    
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
    vscode.window.showInputBox = async () => "";

    const result = await extendedPrivateKeyFromMnemonic(mockOutput);
    expect(result).toBeUndefined();
  });

  test('validates mnemonic length', async () => {
    // Mock invalid mnemonic input (not 12 words)
    vscode.window.showInputBox = async () => "";

    const result = await extendedPrivateKeyFromMnemonic(mockOutput);
    expect(result).toBeUndefined();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 