import { describe, expect, mock, test } from 'bun:test';
import { HD } from '@bsv/sdk';
import vscode from '@test/setup';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';
import { generateHDPublicKey } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

const mockKeyVault = {
  storeKey: mock(() => Promise.resolve('test-id')),
} as unknown as KeyVault;

// Mock window.showErrorMessage
const originalShowErrorMessage = vscode.window.showErrorMessage;
vscode.window.showErrorMessage = mock(
  async (message: string, ...items: string[]) => items[0] || 'Error',
);

describe('generateHDPublicKey', () => {
  test('generates valid HD public key', async () => {
    const result = await generateHDPublicKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^xpub[1-9A-HJ-NP-Za-km-z]{107}/),
      type: 'keys',
      name: 'hdpubkey',
    });

    // Verify key was stored in vault
    expect(mockKeyVault.storeKey).toHaveBeenCalledWith({
      type: 'hdpublic',
      value: expect.stringMatching(/^xpub[1-9A-HJ-NP-Za-km-z]{107}/),
      label: 'Generated HD Public Key',
    });
  });

  test('handles errors', async () => {
    // Mock HD.fromRandom to throw
    const originalFromRandom = HD.fromRandom;
    HD.fromRandom = () => {
      throw new Error('Test error');
    };

    try {
      await expect(
        generateHDPublicKey(mockOutput, mockKeyVault),
      ).rejects.toThrow('Test error');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error generating HD public key: Test error',
      );
    } finally {
      // Restore original functions
      HD.fromRandom = originalFromRandom;
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });
});
