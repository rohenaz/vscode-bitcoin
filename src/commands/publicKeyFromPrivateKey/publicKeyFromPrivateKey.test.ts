import vscode from '@test/setup';
import { describe, expect, test, mock, afterAll } from 'bun:test';
import { publicKeyFromPrivateKey } from './index';
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

describe('publicKeyFromPrivateKey', () => {
  test('generates valid public key from private key', async () => {
    // Create a known private key
    const privKey = PrivateKey.fromRandom();
    const expectedPubKey = privKey.toPublicKey();

    // Mock user input
    vscode.window.showInputBox = async () => privKey.toString();

    const result = await publicKeyFromPrivateKey(mockOutput);
    
    // Check return value format
    expect(result).toBeDefined();
    expect(result).toEqual({
      data: expectedPubKey.toString(),
      type: 'keys',
      name: 'pubkey_from_privkey',
    });
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = async () => "";

    const result = await publicKeyFromPrivateKey(mockOutput);
    expect(result).toBeUndefined();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 