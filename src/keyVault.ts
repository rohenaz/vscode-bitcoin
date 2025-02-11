import * as crypto from 'node:crypto';
import { SymmetricKey, Utils } from '@bsv/sdk';
import vsApi, {
  type SecretStorage,
  type ExtensionContext,
  type EventEmitter,
  type Event,
} from './vsShim';

const { toArray, toHex, toUTF8 } = Utils;

// Constants for vault encryption
const ENCRYPTED_VAULT_BLOB = 'bitcoin.encryptedVaultBlob';
const SALT_KEY = 'bitcoin.vaultSalt';
const PASSWORD_HASH_KEY = 'bitcoin.passwordHash';

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
  metadata?: Record<string, string>;
  isEncryptionKey?: boolean;
}

export class KeyVault {
  private storage: SecretStorage;
  private onKeyListChanged: EventEmitter<void>;

  private ephemeralKey: SymmetricKey | null = null;
  private decryptedKeys: KeyEntry[] | null = null;

  constructor(context: ExtensionContext) {
    this.storage = context.secrets;
    this.onKeyListChanged = new vsApi.EventEmitter<void>();
  }

  public get isUnlocked(): boolean {
    return !!this.ephemeralKey && !!this.decryptedKeys;
  }

  /** Check if there's any existing vault data stored (encrypted or not). */
  public async hasExistingVault(): Promise<boolean> {
    // Force refresh by getting a fresh secrets instance
    const freshStorage = this.storage;
    const cipherHex = await freshStorage.get(ENCRYPTED_VAULT_BLOB);
    console.log('Fresh storage check - cipherHex exists?:', !!cipherHex);
    
    // Additional check for other keys
    const saltExists = await freshStorage.get(SALT_KEY);
    const hashExists = await freshStorage.get(PASSWORD_HASH_KEY);
    console.log('Salt exists:', !!saltExists, saltExists);
    console.log('Password hash exists:', !!hashExists, hashExists);
    
    return !!cipherHex;
  }

  /** Attempt to ensure the vault is unlocked, prompting for password if needed. */
  public async checkUnlock(): Promise<void> {
    if (this.isUnlocked) return;

    const hasVault = await this.hasExistingVault();
    const password = await vsApi.window.showInputBox({
      prompt: hasVault ? 'Enter vault password to unlock' : 'Set a password for your key vault',
      password: true,
      placeHolder: hasVault ? undefined : 'Choose a strong password'
    });
    if (!password) {
      throw new Error('Vault is locked. Must unlock with password first.');
    }

    await this.unlockVault(password);
  }

  /**
   * Main vault unlock logic:
   *  - Derive PBKDF2 key from user password + salt
   *  - If no vault data => create empty
   *  - If no passwordHash => treat as old or plaintext data, try migrating
   *  - Else do normal symmetrical decryption
   */
  public async unlockVault(password: string): Promise<void> {
    const storedVault = await this.storage.get(ENCRYPTED_VAULT_BLOB);
    const storedHash = await this.storage.get(PASSWORD_HASH_KEY);
    const salt = await this.getOrCreateSalt();

    // 1) Derive symmetrical key from password
    const pbkdf2Key = crypto.pbkdf2Sync(password, Buffer.from(salt), 100000, 32, 'sha256');
    this.ephemeralKey = new SymmetricKey(toArray(pbkdf2Key));

    // First time setup - no vault exists yet
    if (!storedVault) {
      this.decryptedKeys = [];
      const hashHex = toHex(toArray(pbkdf2Key));
      await this.storage.store(PASSWORD_HASH_KEY, hashHex);
      await this.saveVault();
      return;
    }

    // 2) If no password hash, handle migration
    if (!storedHash) {
      try {
        // Attempt to parse the data as old plaintext JSON
        const oldKeys = JSON.parse(storedVault) as KeyEntry[];
        this.decryptedKeys = oldKeys;

        // Now store the passwordHash so next time we do real encryption
        const hashHex = toHex(toArray(pbkdf2Key));
        await this.storage.store(PASSWORD_HASH_KEY, hashHex);

        // Re-encrypt that old data for next load
        await this.saveVault();
        return;
      } catch {
        // If parse fails => data is not plaintext JSON => likely old or corrupted
        // Option 1: Discard and re-init
        vsApi.window.showWarningMessage(
          'Existing vault data is unreadable. A new vault will be initialized.'
        );
        this.decryptedKeys = [];
        const hashHex = toHex(toArray(pbkdf2Key));
        await this.storage.store(PASSWORD_HASH_KEY, hashHex);
        await this.saveVault();
        return;

        // Option 2: If you REALLY want to preserve it, you'd have to guess
        // how to decrypt it or prompt the user. Usually not worth it.
      }
    }

    // 4) Normal flow: we have a stored passwordHash => verify & decrypt
    const currentHashHex = toHex(toArray(pbkdf2Key));
    if (storedHash !== currentHashHex) {
      throw new Error('Vault decryption failed. Possibly incorrect password.');
    }

    // Actually decrypt the data using ephemeralKey
    try {
      // storedVault is ciphertext hex
      const plainHex = this.ephemeralKey.decrypt(storedVault, 'hex') as string;
      const json = toUTF8(toArray(plainHex, 'hex'));
      this.decryptedKeys = JSON.parse(json) as KeyEntry[];
    } catch (err) {
      throw new Error('Vault decryption failed. Data may be corrupted.');
    }
  }

  /** Actually do symmetrical encryption of the in-memory vault. */
  private async saveVault(): Promise<void> {
    if (!this.ephemeralKey || !this.decryptedKeys) return;

    const json = JSON.stringify(this.decryptedKeys);
    const plainHex = toHex(toArray(json));
    const cipherHex = this.ephemeralKey.encrypt(plainHex, 'hex') as string;

    await this.storage.store(ENCRYPTED_VAULT_BLOB, cipherHex);
  }

  /** Generate or retrieve the salt from the store. */
  private async getOrCreateSalt(): Promise<Buffer> {
    let saltHex = await this.storage.get(SALT_KEY);
    if (!saltHex) {
      const randomSalt = crypto.randomBytes(16);
      saltHex = randomSalt.toString('hex');
      await this.storage.store(SALT_KEY, saltHex);
    }
    return Buffer.from(saltHex, 'hex');
  }

  /** Lock the vault => forget ephemeral data + key. */
  public lockVault(): void {
    this.ephemeralKey = null;
    this.decryptedKeys = null;
  }

  // ---- standard KeyVault methods below  ----

  public isAutoStoreEnabled(): boolean {
    try {
      const config = vsApi.workspace.getConfiguration('bitcoin');
      return config.get('keyVault.autoStore') ?? true;
    } catch (error) {
      console.warn('Failed to get key vault config:', error);
      return true;
    }
  }

  public get onDidChangeKeys(): Event<void> {
    return this.onKeyListChanged.event;
  }

  public async storeKey(entry: Omit<KeyEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.checkUnlock();
    if (!this.decryptedKeys) {
      throw new Error('Vault is in an invalid state');
    }

    const id = crypto.randomUUID();
    const fullEntry: KeyEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
      metadata:
        entry.metadata && Object.keys(entry.metadata).length > 0
          ? entry.metadata
          : undefined,
    };
    this.decryptedKeys.push(fullEntry);

    await this.saveVault();
    this.onKeyListChanged.fire();
    return id;
  }

  public async getKey(id: string): Promise<KeyEntry | undefined> {
    await this.checkUnlock();
    return this.decryptedKeys?.find((k) => k.id === id);
  }

  public async getAllKeys(): Promise<KeyEntry[]> {
    await this.checkUnlock();
    return this.decryptedKeys ? [...this.decryptedKeys] : [];
  }

  public async deleteKey(id: string): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    this.decryptedKeys = this.decryptedKeys.filter((k) => k.id !== id);
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async clearAllKeys(): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    this.decryptedKeys = [];
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async searchKeys(query: string): Promise<KeyEntry[]> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return [];

    const lower = query.toLowerCase();
    return this.decryptedKeys.filter((k) => {
      if (k.label?.toLowerCase().includes(lower)) return true;
      if (k.type.toLowerCase().includes(lower)) return true;
      if (k.metadata) {
        return Object.values(k.metadata).some((v) =>
          v.toLowerCase().includes(lower),
        );
      }
      return false;
    });
  }

  public async updateKeyLabel(id: string, newLabel: string): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    const idx = this.decryptedKeys.findIndex((k) => k.id === id);
    if (idx === -1) throw new Error('Key not found');

    this.decryptedKeys[idx] = { ...this.decryptedKeys[idx], label: newLabel };
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async getEncryptionKey(): Promise<KeyEntry | undefined> {
    await this.checkUnlock();
    return this.decryptedKeys?.find((k) => k.isEncryptionKey);
  }

  public async setEncryptionKey(id: string): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    const idx = this.decryptedKeys.findIndex((k) => k.id === id);
    if (idx < 0) throw new Error('Key not found');

    this.decryptedKeys = this.decryptedKeys.map((k) => ({
      ...k,
      isEncryptionKey: k.id === id,
    }));
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async clearEncryptionKey(): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    this.decryptedKeys = this.decryptedKeys.map((k) => ({
      ...k,
      isEncryptionKey: false,
    }));
    await this.saveVault();
    this.onKeyListChanged.fire();
  }
}