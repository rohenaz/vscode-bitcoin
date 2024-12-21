import { afterAll, describe, expect, mock, test } from 'bun:test';
import { PrivateKey } from '@bsv/sdk';
import vscode from '@test/setup';
import type { OutputManager } from '../../output';
import { addressFromWIF } from './index';

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

describe('addressFromWIF', () => {
  test('generates valid address from WIF', async () => {
    // Create a known private key and get its WIF
    const privKey = PrivateKey.fromRandom();
    const expectedAddress = privKey.toAddress();

    // Mock user input
    vscode.window.showInputBox = async () => privKey.toWif();

    const result = await addressFromWIF(mockOutput);

    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expectedAddress,
      type: 'addresses',
      name: 'from_wif',
    });

    // Verify it's a valid address format
    expect(result?.data).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = async () => '';

    const result = await addressFromWIF(mockOutput);
    expect(result).toBeUndefined();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
});
