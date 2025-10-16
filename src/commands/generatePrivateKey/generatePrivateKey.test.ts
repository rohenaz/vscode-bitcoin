import { describe, expect, mock, test, beforeEach } from 'bun:test';

import { PrivateKey } from '@bsv/sdk';
import type { KeyVault, KeyEntry } from '../../keyVault';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';
import { generatePrivateKey } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

type KeyEntryInput = Omit<KeyEntry, 'id' | 'timestamp'>;
const storeKeyMock = mock<(entry: KeyEntryInput) => Promise<string>>(() => Promise.resolve('test-id'));
const isAutoStoreEnabledMock = mock<() => boolean>(() => true);

const mockKeyVault = {
  storeKey: storeKeyMock,
  isAutoStoreEnabled: isAutoStoreEnabledMock,
} as unknown as KeyVault;

// Mock window.showErrorMessage
const originalShowErrorMessage = vscode.window.showErrorMessage;
vscode.window.showErrorMessage = mock((_message: string, ..._items: string[]) => Promise.resolve(undefined));

describe('generatePrivateKey', () => {
  beforeEach(() => {
    storeKeyMock.mockClear();
    isAutoStoreEnabledMock.mockImplementation(() => true);
  });

  test('generates valid private key with autoStore enabled', async () => {
    const result = await generatePrivateKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[0-9a-f]{64}$/),
      type: 'keys',
      name: 'privkey',
    });

    // Verify both private and public keys were stored with correct relationship
    expect(storeKeyMock).toHaveBeenCalledTimes(2);
    const calls = storeKeyMock.mock.calls;
    
    // First call should store private key
    expect(calls[0][0]).toEqual({
      type: 'private',
      value: expect.stringMatching(/^[0-9a-f]{64}$/),
      label: 'Generated Private Key',
      metadata: {},
    });

    // Second call should store public key with parentId
    expect(calls[1][0]).toEqual({
      type: 'public',
      value: expect.any(String),
      label: 'Generated Public Key',
      metadata: { parentId: 'test-id' },
    });
  });

  test('generates private key without storing when autoStore disabled', async () => {
    isAutoStoreEnabledMock.mockImplementation(() => false);
    const result = await generatePrivateKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[0-9a-f]{64}$/),
      type: 'keys',
      name: 'privkey',
    });

    // Verify no keys were stored
    expect(storeKeyMock).not.toHaveBeenCalled();
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
