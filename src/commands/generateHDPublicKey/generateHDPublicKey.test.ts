import { describe, expect, mock, test, beforeEach } from 'bun:test';
import { HD } from '@bsv/sdk';
import vscode from '@test/setup';
import type { KeyVault, KeyEntry } from '../../keyVault';
import type { OutputManager } from '../../output';
import { generateHDPublicKey } from './index';

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

describe('generateHDPublicKey', () => {
  beforeEach(() => {
    storeKeyMock.mockClear();
    isAutoStoreEnabledMock.mockImplementation(() => true);
  });

  test('generates valid HD public key with autoStore enabled', async () => {
    const result = await generateHDPublicKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^xpub[1-9A-HJ-NP-Za-km-z]{107}/),
      type: 'keys',
      name: 'hdpubkey',
    });

    // Verify both private and public keys were stored with correct relationship
    expect(storeKeyMock).toHaveBeenCalledTimes(2);
    
    const calls = storeKeyMock.mock.calls;
    // First call should store HD private key
    expect(calls[0][0]).toEqual({
      type: 'hdprivate',
      label: 'Parent HD Private Key for HDPublicKey',
      metadata: {},
      value: expect.stringMatching(/^xprv[1-9A-HJ-NP-Za-km-z]{107}/),
    });

    // Second call should store HD public key with parentId
    expect(calls[1][0]).toEqual({
      type: 'hdpublic',
      label: 'Generated HD Public Key',
      metadata: { parentId: 'test-id' },
      value: expect.stringMatching(/^xpub[1-9A-HJ-NP-Za-km-z]{107}/),
    });
  });

  test('generates only HD public key with autoStore disabled', async () => {
    isAutoStoreEnabledMock.mockImplementation(() => false);
    const result = await generateHDPublicKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^xpub[1-9A-HJ-NP-Za-km-z]{107}/),
      type: 'keys',
      name: 'hdpubkey',
    });

    // Verify no keys were stored
    expect(storeKeyMock).not.toHaveBeenCalled();
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
