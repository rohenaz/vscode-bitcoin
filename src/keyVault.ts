import * as crypto from 'node:crypto';
import { Hash, PrivateKey, SymmetricKey, Utils } from '@bsv/sdk';
import vsApi, {
  type SecretStorage,
  type ExtensionContext,
  type EventEmitter,
  type Event,
} from './vsShim';

const { toArray } = Utils;

// Constants for vault encryption
const ENCRYPTED_VAULT_BLOB = 'bitcoin.encryptedVaultBlob';
const SALT_KEY = 'bitcoin.vaultSalt';

export type KeyType =
  | 'private'
  | 'public'
  | 'wif'
  | 'hdprivate'
  | 'hdpublic'
  | 'mnemonic'
  | 'encryption';

export interface KeyEntry {
  id: string;
  type: KeyType;
  label?: string;
  value: string;
  timestamp: number;
  /**
   * You can store arbitrary metadata here, e.g. parentId for child keys
   */
  metadata?: Record<string, string>;
  isEncryptionKey?: boolean;
}

export class KeyVault {
  private storage: SecretStorage;
  private keyListKey = 'bitcoin.keyList';
  private encryptionKeyIdKey = 'bitcoin.encryptionKeyId';
  private onKeyListChanged: EventEmitter<void>;

  // New fields for encryption
  private ephemeralKey: SymmetricKey | null = null;
  private decryptedKeys: KeyEntry[] | null = null;

  constructor(context: ExtensionContext) {
    this.storage = context.secrets;
    this.onKeyListChanged = new vsApi.EventEmitter<void>();
  }

  /**
   * Is the vault currently unlocked in memory?
   */
  public get isUnlocked(): boolean {
    return !!this.ephemeralKey && !!this.decryptedKeys;
  }

  /**
   * Load or create a random salt used for PBKDF2
   */
  private async getOrCreateSalt(): Promise<number[]> {
    let saltHex = await this.storage.get(SALT_KEY);
    if (!saltHex) {
      const randomSalt = crypto.randomBytes(16);
      saltHex = randomSalt.toString('hex');
      await this.storage.store(SALT_KEY, saltHex);
    }
    return toArray(saltHex, 'hex');
  }

  /**
   * Unlocks vault using a user-provided master password.
   * - Creates a SymmetricKey from the password
   * - Decrypts the stored ciphertext
   * - Parses JSON => in-memory KeyEntry[]
   * 
   * Throws error on bad password or if data is corrupted.
   */
  public async unlockVault(password: string): Promise<void> {
    if (this.isUnlocked) return; // Already unlocked

    // 1) Get or generate salt from secret storage
    const salt = await this.getOrCreateSalt();

    // 2) Create a 32-byte key using SHA-256
    const key = Hash.sha256(toArray(password).concat(salt));
    // Create symmetric key from the 32-byte hash
    const symKey = new SymmetricKey(key);

    // 3) Load the existing ciphertext from storage
    const cipherHex = await this.storage.get(ENCRYPTED_VAULT_BLOB);
    if (!cipherHex) {
      // No existing vault => treat as empty
      this.ephemeralKey = symKey;
      this.decryptedKeys = [];
      return;
    }

    // 4) Attempt to decrypt
    try {
      const plain = symKey.decrypt(cipherHex, 'utf8') as string;
      const arr = JSON.parse(plain) as KeyEntry[];
      this.ephemeralKey = symKey;
      this.decryptedKeys = arr;
    } catch (err) {
      // Wrong password or data corrupted
      throw new Error('Vault decryption failed. Possibly incorrect password.');
    }
  }

  /**
   * Lock the vault => forget ephemeral in-memory data + key
   */
  public lockVault(): void {
    this.ephemeralKey = null;
    this.decryptedKeys = null;
  }

  /**
   * Overwrite entire vault array with re-encrypted data
   */
  private async saveVault(): Promise<void> {
    if (!this.ephemeralKey || !this.decryptedKeys) return;
    const json = JSON.stringify(this.decryptedKeys);
    const cipherHex = this.ephemeralKey.encrypt(json) as string;
    await this.storage.store(ENCRYPTED_VAULT_BLOB, cipherHex);
  }

  isAutoStoreEnabled(): boolean {
    try {
      const config = vsApi.workspace.getConfiguration('bitcoin');
      return config.get('keyVault.autoStore') ?? true;
    } catch (error) {
      console.warn('Failed to get key vault configuration, using default:', error);
      return true;
    }
  }

  get onDidChangeKeys(): Event<void> {
    return this.onKeyListChanged.event;
  }

  private async getKeyList(): Promise<string[]> {
    const list = await this.storage.get(this.keyListKey);
    return list ? JSON.parse(list) : [];
  }

  private async saveKeyList(list: string[]): Promise<void> {
    await this.storage.store(this.keyListKey, JSON.stringify(list));
    this.onKeyListChanged.fire();
  }

  async storeKey(entry: Omit<KeyEntry, 'id' | 'timestamp'>): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }

    const id = crypto.randomUUID();
    const fullEntry: KeyEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };

    // Add to decrypted array
    if (!this.decryptedKeys) {
      throw new Error('Vault is in an invalid state');
    }
    this.decryptedKeys.push(fullEntry);

    // Re-encrypt and save
    await this.saveVault();
    this.onKeyListChanged.fire();

    return id;
  }

  async getKey(id: string): Promise<KeyEntry | undefined> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }
    return this.decryptedKeys.find(k => k.id === id);
  }

  async getAllKeys(): Promise<KeyEntry[]> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }
    return [...this.decryptedKeys];
  }

  async deleteKey(id: string): Promise<void> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }
    this.decryptedKeys = this.decryptedKeys.filter(k => k.id !== id);
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  async clearAllKeys(): Promise<void> {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }
    this.decryptedKeys = [];
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  async searchKeys(query: string): Promise<KeyEntry[]> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }

    const lowerQuery = query.toLowerCase();
    return this.decryptedKeys.filter(
      (entry) =>
        entry.label?.toLowerCase().includes(lowerQuery) ||
        entry.type.toLowerCase().includes(lowerQuery) ||
        (entry.metadata &&
          Object.values(entry.metadata).some((value) =>
            value.toLowerCase().includes(lowerQuery),
          )),
    );
  }

  async updateKeyLabel(id: string, newLabel: string): Promise<void> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }

    const keyIndex = this.decryptedKeys.findIndex(k => k.id === id);
    if (keyIndex === -1) {
      throw new Error('Key not found');
    }

    this.decryptedKeys[keyIndex] = {
      ...this.decryptedKeys[keyIndex],
      label: newLabel,
    };

    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  async getEncryptionKey(): Promise<KeyEntry | undefined> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }
    return this.decryptedKeys.find(k => k.isEncryptionKey);
  }

  async setEncryptionKey(id: string): Promise<void> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }

    // Find the key
    const keyIndex = this.decryptedKeys.findIndex(k => k.id === id);
    if (keyIndex === -1) {
      throw new Error('Key not found');
    }

    // Clear isEncryptionKey flag from all keys
    this.decryptedKeys = this.decryptedKeys.map(k => ({
      ...k,
      isEncryptionKey: k.id === id
    }));

    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  async clearEncryptionKey(): Promise<void> {
    if (!this.isUnlocked || !this.decryptedKeys) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }

    // Clear isEncryptionKey flag from all keys
    this.decryptedKeys = this.decryptedKeys.map(k => ({
      ...k,
      isEncryptionKey: false
    }));

    await this.saveVault();
    this.onKeyListChanged.fire();
  }
}