import { describe, expect, test, mock, afterAll } from 'bun:test';
import vscode from '@test/setup';
import { addressFromPrivateKey } from './index';
import type { OutputManager } from '../../output';
import { PrivateKey } from '@bsv/sdk';

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

describe('addressFromPrivateKey', () => {
  test('generates valid address from private key', async () => {
    // Create a known private key
    const privKey = PrivateKey.fromRandom();
    const expectedAddress = privKey.toAddress();

    // Mock user input
    vscode.window.showInputBox = async () => privKey.toString();

    const result = await addressFromPrivateKey(mockOutput);
    
    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expectedAddress,
      type: 'addresses',
      name: 'from_privkey',
    });

    // Verify it's a valid address format
    expect(result?.data).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = async () => undefined;

    const result = await addressFromPrivateKey(mockOutput);
    expect(result).toBeUndefined();
  });

  test('handles invalid private key', async () => {
    // Mock invalid input
    vscode.window.showInputBox = async () => 'invalid';

    await expect(addressFromPrivateKey(mockOutput)).rejects.toThrow();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 