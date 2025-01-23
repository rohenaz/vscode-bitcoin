import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { KeyVault } from './keyVault';
import type { ExtensionContext } from './vsShim';
import { SymmetricKey, Utils } from '@bsv/sdk';
import * as crypto from 'node:crypto';

const { toArray, toHex } = Utils;

// Constants from keyVault.ts
const ENCRYPTED_VAULT_BLOB = 'bitcoin.encryptedVaultBlob';
const SALT_KEY = 'bitcoin.vaultSalt';

// Test the actual encryption/decryption first
describe('encryption', () => {
  test('SymmetricKey can encrypt and decrypt correctly', () => {
    // Create a known key
    const keyBytes = new Uint8Array(32).fill(1);
    const key = new SymmetricKey(Array.from(keyBytes));
    
    // Create test data
    const testData = JSON.stringify({ test: 'data' });
    console.log('Original:', testData);
    
    // Convert to hex and encrypt
    const dataHex = toHex(toArray(testData));
    console.log('As hex:', dataHex);
    const encrypted = key.encrypt(dataHex, 'hex') as string;
    console.log('Encrypted:', encrypted);
    
    // Decrypt back
    const decryptedHex = key.decrypt(encrypted, 'hex') as string;
    console.log('Decrypted hex:', decryptedHex);
    expect(decryptedHex).toBe(dataHex);
    
    // Convert back to string
    const decrypted = Buffer.from(decryptedHex, 'hex').toString();
    console.log('Final:', decrypted);
    expect(decrypted).toBe(testData);
  });

  test('full vault encryption flow with real data', () => {
    // 1. Create a key from PBKDF2 output (simulating vault)
    const password = 'test123';
    const salt = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    const pbkdf2Key = crypto.pbkdf2Sync(
      password,
      salt,
      100000,
      32,
      'sha256'
    );
    console.log('PBKDF2 Key:', toHex(toArray(pbkdf2Key)));
    
    const key = new SymmetricKey(toArray(pbkdf2Key));
    
    // 2. Create test vault data
    const vaultData = [{
      id: 'test-id',
      type: 'wif' as const,
      value: 'test-value',
      label: 'test-label',
      timestamp: Date.now()
    }];
    const json = JSON.stringify(vaultData);
    console.log('Original vault:', json);
    
    // 3. Encrypt exactly as vault does
    const jsonHex = toHex(toArray(json));
    console.log('Vault as hex:', jsonHex);
    const encrypted = key.encrypt(jsonHex, 'hex') as string;
    console.log('Encrypted vault:', encrypted);
    
    // 4. Decrypt exactly as vault does
    const decryptedHex = key.decrypt(encrypted, 'hex') as string;
    console.log('Decrypted hex:', decryptedHex);
    expect(decryptedHex).toBe(jsonHex);
    
    const decrypted = Buffer.from(decryptedHex, 'hex').toString();
    console.log('Final vault:', decrypted);
    expect(decrypted).toBe(json);
    
    // 5. Try with wrong password
    const wrongKey = new SymmetricKey(toArray(crypto.pbkdf2Sync(
      'wrong',
      salt,
      100000,
      32,
      'sha256'
    )));
    
    expect(() => {
      wrongKey.decrypt(encrypted, 'hex');
    }).toThrow();
  });
});

describe('pure crypto test', () => {
  test('raw encryption and decryption', () => {
    // 1. Create a real key from a password using PBKDF2
    const password = 'test123';
    const salt = crypto.randomBytes(16); // Real random salt
    console.log('Salt:', salt.toString('hex'));
    
    const key = crypto.pbkdf2Sync(
      password,
      salt,
      100000,
      32,
      'sha256'
    );
    console.log('Derived key:', key.toString('hex'));

    // 2. Create a SymmetricKey from the derived key
    const symKey = new SymmetricKey(toArray(key));

    // 3. Test data to encrypt
    const testData = {
      id: 'test-id',
      type: 'wif',
      value: 'test-value',
      label: 'test-label'
    };
    const plaintext = JSON.stringify(testData);
    console.log('\nOriginal data:', plaintext);

    // 4. Convert to hex and encrypt
    const plaintextHex = toHex(toArray(plaintext));
    console.log('As hex:', plaintextHex);
    
    const ciphertext = symKey.encrypt(plaintextHex, 'hex');
    console.log('Encrypted:', ciphertext);

    // 5. Decrypt with same key
    const decryptedHex = symKey.decrypt(ciphertext, 'hex');
    console.log('Decrypted hex:', decryptedHex);
    expect(decryptedHex).toBe(plaintextHex);

    const decrypted = Buffer.from(decryptedHex as string, 'hex').toString();
    console.log('Final decrypted:', decrypted);
    expect(decrypted).toBe(plaintext);
    expect(JSON.parse(decrypted)).toEqual(testData);

    // 6. Verify wrong password fails
    const wrongKey = crypto.pbkdf2Sync(
      'wrongpass',
      salt,
      100000,
      32,
      'sha256'
    );
    const wrongSymKey = new SymmetricKey(toArray(wrongKey));
    
    expect(() => {
      wrongSymKey.decrypt(ciphertext, 'hex');
    }).toThrow();
  });
});

describe('KeyVault', () => {
  let vault: KeyVault;
  let mockSecrets: Map<string, string>;
  let mockContext: ExtensionContext;

  beforeEach(() => {
    mockSecrets = new Map();

    // Mock SecretStorage to match VS Code's behavior
    mockContext = {
      secrets: {
        get: mock(async (key: string) => {
          console.log('SecretStorage.get', { key, value: mockSecrets.get(key) });
          return mockSecrets.get(key);
        }),
        store: mock(async (key: string, value: string) => {
          console.log('SecretStorage.store', { key, value });
          mockSecrets.set(key, value);
        }),
        delete: mock(async (key: string) => {
          console.log('SecretStorage.delete', { key });
          mockSecrets.delete(key);
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

    // Verify the stored data is JSON
    const storedVault = await mockContext.secrets.get('bitcoin.encryptedVaultBlob');
    expect(storedVault).toBeDefined();
    expect(storedVault).toBe('[]');
  });

  test('can store and retrieve keys when unlocked', async () => {
    await vault.unlockVault('test123');

    const id = await vault.storeKey({
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
    });

    // Verify we can retrieve the key
    const key = await vault.getKey(id);
    expect(key).toBeDefined();
    expect(key?.type).toBe('wif');
    expect(key?.value).toBe('L1abc123...');
    expect(key?.label).toBe('Test Key');

    // Verify the stored data is JSON
    const storedVault = await mockContext.secrets.get('bitcoin.encryptedVaultBlob');
    expect(storedVault).toBeDefined();
    if (!storedVault) {
      throw new Error('Expected stored vault to be defined');
    }
    const parsed = JSON.parse(storedVault);
    expect(parsed).toEqual([{
      id,
      type: 'wif',
      value: 'L1abc123...',
      label: 'Test Key',
      timestamp: expect.any(Number)
    }]);
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

describe('real extension flows', () => {
  test('show key vault first time works', async () => {
    const getMock = mock((key: string) => {
      console.log('SecretStorage.get', { key, value: undefined });
      return Promise.resolve(undefined);
    });

    const storeMock = mock((key: string, value: string) => {
      console.log('SecretStorage.store', { key, value });
      return Promise.resolve();
    });

    const mockContext = {
      secrets: {
        get: getMock,
        store: storeMock,
        delete: mock(() => Promise.resolve())
      }
    } as unknown as ExtensionContext;

    const vault = new KeyVault(mockContext);

    // This simulates what happens when running show key vault command
    const password = 'test123';
    await vault.unlockVault(password);

    // Verify the vault is unlocked
    expect(vault.isUnlocked).toBe(true);

    // Should be able to get empty key list
    const keys = await vault.getAllKeys();
    expect(keys).toEqual([]);

    // Verify the correct calls were made
    expect(getMock).toHaveBeenCalledWith(SALT_KEY);
    expect(getMock).toHaveBeenCalledWith(ENCRYPTED_VAULT_BLOB);
    expect(storeMock).toHaveBeenCalledTimes(3); // salt, empty blob, password hash
  });
}); 