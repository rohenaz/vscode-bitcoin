import { describe, expect, mock, test, beforeEach } from 'bun:test';
import { PrivateKey } from '@bsv/sdk';
import vscode from '@test/setup';
import type { KeyVault, KeyEntry } from '../../keyVault';
import type { OutputManager } from '../../output';
import { generateWIF } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

type KeyEntryInput = Omit<KeyEntry, 'id' | 'timestamp'>;
const storeKeyMock = mock<(entry: KeyEntryInput) => Promise<string>>(() => Promise.resolve('test-id'));
const isAutoStoreEnabledMock = mock<() => boolean>(() => true);
const checkUnlockMock = mock<() => Promise<void>>(() => Promise.resolve());

const mockKeyVault = {
  storeKey: storeKeyMock,
  isAutoStoreEnabled: isAutoStoreEnabledMock,
  isUnlocked: true,
  checkUnlock: checkUnlockMock,
} as unknown as KeyVault;

// Mock window.showErrorMessage
const originalShowErrorMessage = vscode.window.showErrorMessage;
vscode.window.showErrorMessage = mock((_message: string, ..._items: string[]) => Promise.resolve(undefined));

describe('generateWIF', () => {
  beforeEach(() => {
    storeKeyMock.mockClear();
    isAutoStoreEnabledMock.mockImplementation(() => true);
  });

  test('generates valid WIF with autoStore enabled', async () => {
    const result = await generateWIF(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      type: 'keys',
      name: 'wif',
    });

    // Verify only WIF is stored, no public key
    expect(storeKeyMock).toHaveBeenCalledTimes(1);
    const calls = storeKeyMock.mock.calls;
    
    // Only call should store WIF
    expect(calls[0][0]).toEqual({
      type: 'wif',
      value: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      label: 'Generated WIF',
      metadata: {},
    });
  });

  test('generates WIF without storing when autoStore disabled', async () => {
    isAutoStoreEnabledMock.mockImplementation(() => false);
    const result = await generateWIF(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      type: 'keys',
      name: 'wif',
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
