// src/commands/generatePublicKey/generatePublicKey.test.ts
import { describe, expect, mock, test, beforeEach } from 'bun:test';
import { PublicKey, PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import type { KeyVault, KeyEntry } from '../../keyVault';
import { generatePublicKey } from './index';

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

describe('generatePublicKey', () => {
  beforeEach(() => {
    storeKeyMock.mockClear();
    isAutoStoreEnabledMock.mockImplementation(() => true);
  });

  test('generates valid public key with autoStore enabled', async () => {
    const result = await generatePublicKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.any(String),
      type: 'keys',
      name: 'pubkey',
    });

    // Verify it's a valid public key
    const pubKey = PublicKey.fromString(result.data);
    expect(pubKey.toString()).toBe(result.data);

    // Verify both private and public keys were stored with correct relationship
    expect(storeKeyMock).toHaveBeenCalledTimes(2);
    
    // First call should store private key
    const calls = storeKeyMock.mock.calls;
    expect(calls[0][0]).toEqual({
      type: 'private',
      label: 'Parent of generated public key',
      metadata: {},
      value: expect.any(String),
    });

    // Second call should store public key with parentId
    expect(calls[1][0]).toEqual({
      type: 'public',
      label: 'Generated Public Key',
      metadata: { parentId: 'test-id' },
      value: expect.any(String),
    });
  });

  test('generates only public key with autoStore disabled', async () => {
    isAutoStoreEnabledMock.mockImplementation(() => false);
    const result = await generatePublicKey(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.any(String),
      type: 'keys',
      name: 'pubkey',
    });

    // Verify it's a valid public key
    const pubKey = PublicKey.fromString(result.data);
    expect(pubKey.toString()).toBe(result.data);

    // Verify no keys were stored
    expect(storeKeyMock).not.toHaveBeenCalled();
  });
});
