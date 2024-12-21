import { describe, expect, mock, test } from 'bun:test';
import { Mnemonic } from '@bsv/sdk';
import vscode from '../../../setup';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';
import { generateMnemonic } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

const mockKeyVault = {
  storeKey: mock(() => Promise.resolve('test-id')),
} as unknown as KeyVault;

// Mock window.showErrorMessage
const originalShowErrorMessage = vscode.window.showErrorMessage;
vscode.window.showErrorMessage = mock(() => Promise.resolve());

describe('generateMnemonic', () => {
  test('generates valid mnemonic', async () => {
    const result = await generateMnemonic(mockOutput, mockKeyVault);

    // Check return value format - should be 12 words
    expect(result.data.split(' ')).toHaveLength(12);
    expect(result).toEqual({
      data: expect.any(String),
      type: 'keys',
      name: 'mnemonic',
    });

    // Verify key was stored in vault
    expect(mockKeyVault.storeKey).toHaveBeenCalledWith({
      type: 'mnemonic',
      value: expect.any(String),
      label: 'Generated Mnemonic',
    });

    // Verify the mnemonic is valid
    const mnemonic = Mnemonic.fromString(result.data);
    expect(mnemonic.isValid()).toBe(true);
  });

  test('handles errors', async () => {
    // Mock Mnemonic.fromRandom to throw
    const originalFromRandom = Mnemonic.fromRandom;
    Mnemonic.fromRandom = () => {
      throw new Error('Test error');
    };

    try {
      await expect(generateMnemonic(mockOutput, mockKeyVault)).rejects.toThrow(
        'Test error',
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error generating mnemonic: Error: Test error',
      );
    } finally {
      // Restore original functions
      Mnemonic.fromRandom = originalFromRandom;
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });
});
