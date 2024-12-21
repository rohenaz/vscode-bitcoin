import { describe, expect, test, mock, afterAll } from 'bun:test';
import vscode from '@test/setup';
import { addressFromPublicKey } from './index';
import type { OutputManager } from '../../output';
import { PrivateKey, PublicKey } from '@bsv/sdk';

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

describe('addressFromPublicKey', () => {
  test('generates valid address from public key', async () => {
    // Create a known public key
    const privKey = PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    const expectedAddress = pubKey.toAddress();

    // Mock user input
    vscode.window.showInputBox = async () => pubKey.toString();

    const result = await addressFromPublicKey(mockOutput);
    
    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expectedAddress,
      type: 'addresses',
      name: 'from_pubkey',
    });

    // Verify it's a valid address format
    expect(result?.data).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = async () => undefined;

    const result = await addressFromPublicKey(mockOutput);
    expect(result).toBeUndefined();
  });

  test('handles invalid public key', async () => {
    // Mock invalid input
    vscode.window.showInputBox = async () => 'invalid';

    await expect(addressFromPublicKey(mockOutput)).rejects.toThrow('Unknown point format');
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 