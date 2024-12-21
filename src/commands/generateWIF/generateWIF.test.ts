import { describe, expect, mock, test } from 'bun:test';
import vscode from '@test/setup';
import { PrivateKey } from '@bsv/sdk';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';
import { generateWIF } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

const mockKeyVault = {
  storeKey: mock(() => Promise.resolve('test-id')),
} as unknown as KeyVault;

// Mock window.showErrorMessage
const originalShowErrorMessage = vscode.window.showErrorMessage;
vscode.window.showErrorMessage = mock(async (message: string, ...items: string[]) => items[0] || 'Error');

describe('generateWIF', () => {
  test('generates valid WIF', async () => {
    const result = await generateWIF(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      type: 'keys',
      name: 'wif',
    });

    // Verify key was stored in vault
    expect(mockKeyVault.storeKey).toHaveBeenCalledWith({
      type: 'wif',
      value: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      label: 'Generated WIF',
    });
  });

  test('handles errors', async () => {
    // Mock PrivateKey.fromRandom to throw
    const originalFromRandom = PrivateKey.fromRandom;
    PrivateKey.fromRandom = () => {
      throw new Error('Test error');
    };

    try {
      await expect(generateWIF(mockOutput, mockKeyVault)).rejects.toThrow(
        'Test error',
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error generating WIF: Error: Test error',
      );
    } finally {
      // Restore original functions
      PrivateKey.fromRandom = originalFromRandom;
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });
});
