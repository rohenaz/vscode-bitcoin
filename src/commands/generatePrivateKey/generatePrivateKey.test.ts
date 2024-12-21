import { describe, expect, mock, test } from 'bun:test';

import { PrivateKey } from '@bsv/sdk';
import vscode from '../../test/setup';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';
import { generatePrivateKey } from './index';

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

describe('generatePrivateKey', () => {
  test('generates valid private key', async () => {
    const result = await generatePrivateKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[0-9a-f]{64}$/),
      type: 'keys',
      name: 'privkey',
    });

    // Verify output was handled
    expect(mockOutput.handleOutput).toHaveBeenCalledTimes(1);
    expect(mockOutput.handleOutput).toHaveBeenCalledWith(
      expect.stringContaining('Private Key (hex):'),
      'bitcoin.generatePrivateKey',
      'keys',
      'privkey',
    );

    // Verify key was stored in vault
    expect(mockKeyVault.storeKey).toHaveBeenCalledWith({
      type: 'private',
      value: expect.stringMatching(/^[0-9a-f]{64}$/),
      label: 'Generated Private Key',
    });
  });

  test('handles errors', async () => {
    // Mock PrivateKey.fromRandom to throw
    const originalFromRandom = PrivateKey.fromRandom;
    PrivateKey.fromRandom = () => {
      throw new Error('Test error');
    };

    try {
      await expect(
        generatePrivateKey(mockOutput, mockKeyVault),
      ).rejects.toThrow('Test error');
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error generating private key: Error: Test error',
      );
    } finally {
      // Restore original functions
      PrivateKey.fromRandom = originalFromRandom;
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });
});
