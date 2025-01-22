import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { KeyVault } from './keyVault';
import type { ExtensionContext } from './vsShim';

describe('KeyVault', () => {
  let vault: KeyVault;
  let mockSecrets: Map<string, string>;
  let mockContext: ExtensionContext;

  beforeEach(() => {
    mockSecrets = new Map();
    mockContext = {
      secrets: {
        get: mock((key: string) => Promise.resolve(mockSecrets.get(key))),
        store: mock((key: string, value: string) => {
          mockSecrets.set(key, value);
          return Promise.resolve();
        }),
        delete: mock((key: string) => {
          mockSecrets.delete(key);
          return Promise.resolve();
        }),
      },
    } as unknown as ExtensionContext;

    vault = new KeyVault(mockContext);
  });

  test('vault starts locked', () => {
    expect(vault.isUnlocked).toBe(false);
  });

  test('unlock with password creates empty vault if none exists', async () => {
    await vault.unlockVault('test123');
    expect(vault.isUnlocked).toBe(true);

    const keys = await vault.getAllKeys();
    expect(keys).toEqual([]);
  });

  test('can store and retrieve keys when unlocked', async () => {
    await vault.unlockVault('test123');

    const id = await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
    });

    const key = await vault.getKey(id);
    expect(key).toBeDefined();
    expect(key?.type).toBe('wif');
    expect(key?.value).toBe('L1abc123...');
    expect(key?.label).toBe('Test Key');
  });

  test('cannot access keys when locked', async () => {
    await vault.unlockVault('test123');
    await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
    });

    vault.lockVault();
    expect(vault.isUnlocked).toBe(false);

    await expect(vault.getAllKeys()).rejects.toThrow('Vault is locked');
  });

  test('can unlock with same password and access keys', async () => {
    // First session
    await vault.unlockVault('test123');
    const id = await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
    });
    vault.lockVault();

    // Second session
    await vault.unlockVault('test123');
    const key = await vault.getKey(id);
    expect(key).toBeDefined();
    expect(key?.value).toBe('L1abc123...');
  });

  test('wrong password fails to unlock', async () => {
    // Store with correct password
    await vault.unlockVault('test123');
    await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
    });
    vault.lockVault();

    // Try to unlock with wrong password
    await expect(vault.unlockVault('wrong')).rejects.toThrow('Vault decryption failed');
  });

  test('can update key label', async () => {
    await vault.unlockVault('test123');
    const id = await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
    });

    await vault.updateKeyLabel(id, 'Updated Label');
    const key = await vault.getKey(id);
    expect(key?.label).toBe('Updated Label');
  });

  test('can search keys', async () => {
    await vault.unlockVault('test123');
    await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key 1',
    });
    await vault.storeKey({
      type: 'wif',
      value: 'L2def456...',
      label: 'Test Key 2',
    });

    const results = await vault.searchKeys('Key 1');
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Test Key 1');
  });

  test('can set and get encryption key', async () => {
    await vault.unlockVault('test123');
    const id = await vault.storeKey({
      type: 'encryption',
      value: 'L1abc123...',
      label: 'Encryption Key',
    });

    await vault.setEncryptionKey(id);
    const encKey = await vault.getEncryptionKey();
    expect(encKey).toBeDefined();
    expect(encKey?.id).toBe(id);
  });

  test('can clear encryption key', async () => {
    await vault.unlockVault('test123');
    const id = await vault.storeKey({
      type: 'encryption',
      value: 'L1abc123...',
      label: 'Encryption Key',
    });

    await vault.setEncryptionKey(id);
    await vault.clearEncryptionKey();
    const encKey = await vault.getEncryptionKey();
    expect(encKey).toBeUndefined();
  });
}); 