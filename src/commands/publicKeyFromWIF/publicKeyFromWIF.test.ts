import { describe, expect, mock, test } from 'bun:test';
import { PrivateKey } from '@bsv/sdk';
import vscode from '@test/setup';
import type { OutputManager } from '../../output';
import { publicKeyFromWIF } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

// Mock window.showErrorMessage and showInputBox
const originalShowErrorMessage = vscode.window.showErrorMessage;
const originalShowInputBox = vscode.window.showInputBox;

vscode.window.showErrorMessage = mock(
  async (message: string, ...items: string[]) => items[0] || 'Error',
);

describe('publicKeyFromWIF', () => {
  test('derives public key from WIF', async () => {
    // Generate a valid WIF for testing
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();
    const expectedPubKey = privKey.toPublicKey().toString();

    // Mock input box to return our WIF
    vscode.window.showInputBox = mock(
      async () => wif,
    ) as unknown as typeof vscode.window.showInputBox;

    const result = await publicKeyFromWIF(mockOutput);

    // Check return value format
    expect(result).toEqual({
      data: expectedPubKey,
      type: 'keys',
      name: 'from_wif',
    });
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = mock(
      async () => undefined,
    ) as unknown as typeof vscode.window.showInputBox;

    const result = await publicKeyFromWIF(mockOutput);
    expect(result).toBeUndefined();
  });

  test('handles invalid WIF', async () => {
    // Mock invalid WIF input
    vscode.window.showInputBox = mock(
      async () => 'invalid',
    ) as unknown as typeof vscode.window.showInputBox;

    try {
      await expect(publicKeyFromWIF(mockOutput)).rejects.toThrow();

      // Reset mock to check the last call
      const mockFn = vscode.window.showErrorMessage as unknown as {
        mock: { calls: [message: string][] };
      };
      const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
      expect(lastCall[0]).toMatch(/Error deriving public key from WIF/);
    } finally {
      // Restore original functions
      vscode.window.showErrorMessage = originalShowErrorMessage;
      vscode.window.showInputBox = originalShowInputBox;
    }
  });
});
