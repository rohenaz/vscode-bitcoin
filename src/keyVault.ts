import * as crypto from 'node:crypto';
import { SymmetricKey, Utils, PrivateKey } from '@bsv/sdk';
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
  | 'wif-testnet'
  | 'vanity'
  | 'vanity-testnet'
  | 'hdprivate'
  | 'hdpublic'
  | 'mnemonic'
  | 'encryption'
  | 'identity'
  | 'funding'
  | 'keyshare';

export interface KeyEntry {
  id: string;
  type: KeyType;
  label?: string;
  value: string;
  timestamp: number;
  metadata?: Record<string, string>;
  isEncryptionKey?: boolean;
  isIdentityKey?: boolean;
  isFundingKey?: boolean;
  isOrdinalsKey?: boolean;
  keyShares?: string[];
  keyShareThreshold?: number;
  parentKeyId?: string;
}

export class KeyVault {
  private storage: SecretStorage;
  private onKeyListChanged: EventEmitter<void>;
  private onVaultUnlocked: EventEmitter<void>;

  private ephemeralKey: SymmetricKey | null = null;
  private decryptedKeys: KeyEntry[] | null = null;

  constructor(context: ExtensionContext) {
    this.storage = context.secrets;
    this.onKeyListChanged = new vsApi.EventEmitter<void>();
    this.onVaultUnlocked = new vsApi.EventEmitter<void>();
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
      this.onVaultUnlocked.fire();
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
        this.onVaultUnlocked.fire();
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
        this.onVaultUnlocked.fire();
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
      this.onVaultUnlocked.fire();
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

  public get onDidUnlock(): Event<void> {
    return this.onVaultUnlocked.event;
  }

  /**
   * Export vault backup data (for use with bitcoin-backup library)
   * Returns only the encrypted vault blob - NO password hash exposure
   * The encrypted vault already contains [salt][IV][ciphertext]
   */
  public async exportVaultBackup(): Promise<{
    encryptedVault: string;
    keyCount: number;
  } | null> {
    try {
      const encryptedVault = await this.storage.get(ENCRYPTED_VAULT_BLOB);

      if (!encryptedVault) {
        return null;
      }

      return {
        encryptedVault,
        keyCount: this.decryptedKeys?.length ?? 0,
      };
    } catch (error) {
      console.error('Error exporting vault backup:', error);
      return null;
    }
  }

  /**
   * Import encrypted vault backup
   * Restores only the encrypted vault blob
   * Password is verified during unlock attempt (no hash needed)
   */
  public async importVaultBackup(encryptedVault: string): Promise<void> {
    try {
      await this.storage.store(ENCRYPTED_VAULT_BLOB, encryptedVault);

      // Clear in-memory state to force re-unlock
      this.ephemeralKey = null;
      this.decryptedKeys = null;
    } catch (error) {
      console.error('Error importing vault backup:', error);
      throw new Error('Failed to import vault backup');
    }
  }

  /**
   * Verify if a password can unlock the vault (for import preview)
   */
  public async verifyPassword(password: string): Promise<boolean> {
    try {
      const passwordHash = await this.storage.get(PASSWORD_HASH_KEY);
      const salt = await this.storage.get(SALT_KEY);

      if (!passwordHash || !salt) {
        return false;
      }

      // Hash the provided password with the stored salt
      const pbkdf2Key = crypto.pbkdf2Sync(password, Buffer.from(salt), 100000, 32, 'sha256');
      const { toHex, toArray } = await import('@bsv/sdk').then(m => m.Utils);
      const hashHex = toHex(toArray(pbkdf2Key));

      return hashHex === passwordHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get vault statistics
   */
  public getVaultStats(): {
    totalKeys: number;
    keyTypes: Record<string, number>;
    hasEncryptionKey: boolean;
    hasFundingKey: boolean;
    hasOrdinalsKey: boolean;
    hasIdentityKey: boolean;
  } | null {
    if (!this.isUnlocked || !this.decryptedKeys) {
      return null;
    }

    const stats = {
      totalKeys: this.decryptedKeys.length,
      keyTypes: {} as Record<string, number>,
      hasEncryptionKey: false,
      hasFundingKey: false,
      hasOrdinalsKey: false,
      hasIdentityKey: false
    };

    for (const key of this.decryptedKeys) {
      // Count by type
      stats.keyTypes[key.type] = (stats.keyTypes[key.type] || 0) + 1;

      // Check for special keys
      if (key.isEncryptionKey) stats.hasEncryptionKey = true;
      if (key.isFundingKey) stats.hasFundingKey = true;
      if (key.isOrdinalsKey) stats.hasOrdinalsKey = true;
      if (key.isIdentityKey) stats.hasIdentityKey = true;
    }

    return stats;
  }

  public async storeKey(entry: Omit<KeyEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.checkUnlock();
    if (!this.decryptedKeys) {
      throw new Error('Vault is in an invalid state');
    }

    // Check for duplicate key value to prevent collisions
    const existingKey = this.decryptedKeys.find(k => k.value === entry.value && k.type === entry.type);
    if (existingKey) {
      // Key already exists - update metadata if new info provided, but keep existing label
      console.log(`Key already exists with ID ${existingKey.id}, merging metadata`);

      // Merge metadata from new entry into existing key
      if (entry.metadata) {
        existingKey.metadata = {
          ...existingKey.metadata,
          ...entry.metadata,
        };
      }

      // Update label only if the existing one is generic and new one is more specific
      if (entry.label && (!existingKey.label || existingKey.label.includes('Imported'))) {
        existingKey.label = entry.label;
      }

      await this.saveVault();
      this.onKeyListChanged.fire();
      return existingKey.id;
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

  public async updateKeyMetadata(id: string, metadata: Record<string, string>): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    const idx = this.decryptedKeys.findIndex((k) => k.id === id);
    if (idx < 0) throw new Error('Key not found');

    this.decryptedKeys[idx] = {
      ...this.decryptedKeys[idx],
      metadata: {
        ...this.decryptedKeys[idx].metadata,
        ...metadata
      }
    };

    await this.saveVault();
    this.onKeyListChanged.fire();
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

    const lowerQuery = query.toLowerCase();
    return this.decryptedKeys.filter((k) => {
      if (k.label?.toLowerCase().includes(lowerQuery)) return true;
      if (k.type.toLowerCase().includes(lowerQuery)) return true;

      // Check if the key is a WIF and if the query matches its address
      if (k.type === 'wif') {
        try {
          const privateKey = PrivateKey.fromWif(k.value);
          const address = privateKey.toAddress().toString();
          if (address.toLowerCase().includes(lowerQuery)) {
            return true;
          }
        } catch (e) {
          // Ignore errors during address derivation (e.g., invalid WIF)
          // console.warn(`Error deriving address for key ${k.id}:`, e);
        }
      }

      if (k.metadata) {
        return Object.values(k.metadata).some((v) =>
          v.toLowerCase().includes(lowerQuery),
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

    // Clear encryption flag from all keys
    for (const key of this.decryptedKeys) {
      key.isEncryptionKey = false;
    }

    // Set encryption flag on the target key
    this.decryptedKeys[idx].isEncryptionKey = true;

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

  public async getIdentityKey(): Promise<KeyEntry | undefined> {
    await this.checkUnlock();
    return this.decryptedKeys?.find((k) => k.isIdentityKey);
  }

  public async setIdentityKey(id: string): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    const idx = this.decryptedKeys.findIndex((k) => k.id === id);
    if (idx < 0) throw new Error('Key not found');

    // Clear identity flag from all keys
    for (const key of this.decryptedKeys) {
      key.isIdentityKey = false;
    }

    // Set identity flag on the target key
    this.decryptedKeys[idx].isIdentityKey = true;

    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async clearIdentityKey(): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    this.decryptedKeys = this.decryptedKeys.map((k) => ({
      ...k,
      isIdentityKey: false,
    }));
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async getFundingKey(): Promise<KeyEntry | undefined> {
    await this.checkUnlock();
    return this.decryptedKeys?.find((k) => k.isFundingKey);
  }

  public async setFundingKey(id: string): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    const idx = this.decryptedKeys.findIndex((k) => k.id === id);
    if (idx < 0) throw new Error('Key not found');

    // Clear funding flag from all keys
    for (const key of this.decryptedKeys) {
      key.isFundingKey = false;
    }

    // Set funding flag on the target key
    this.decryptedKeys[idx].isFundingKey = true;

    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async clearFundingKey(): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    this.decryptedKeys = this.decryptedKeys.map((k) => ({
      ...k,
      isFundingKey: false,
    }));
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async getOrdinalsKey(): Promise<KeyEntry | undefined> {
    await this.checkUnlock();
    return this.decryptedKeys?.find((k) => k.isOrdinalsKey);
  }

  public async setOrdinalsKey(id: string): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    const idx = this.decryptedKeys.findIndex((k) => k.id === id);
    if (idx < 0) throw new Error('Key not found');

    // Clear ordinals flag from all keys
    for (const key of this.decryptedKeys) {
      key.isOrdinalsKey = false;
    }

    // Set ordinals flag on the target key
    this.decryptedKeys[idx].isOrdinalsKey = true;

    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  public async clearOrdinalsKey(): Promise<void> {
    await this.checkUnlock();
    if (!this.decryptedKeys) return;

    this.decryptedKeys = this.decryptedKeys.map((k) => ({
      ...k,
      isOrdinalsKey: false,
    }));
    await this.saveVault();
    this.onKeyListChanged.fire();
  }

  /**
   * Generate key shares for a WIF key
   * Creates individual top-level keyshare entries for each share
   * @param keyId The ID of the key to generate shares for
   * @param threshold The minimum number of shares required to reconstruct the key
   * @param totalShares The total number of shares to generate
   * @returns Array of share strings
   */
  public async generateKeyShares(
    keyId: string,
    threshold: number,
    totalShares: number
  ): Promise<string[]> {
    await this.checkUnlock();
    if (!this.decryptedKeys) {
      throw new Error('Vault is in an invalid state');
    }

    const keyEntry = this.decryptedKeys.find((k) => k.id === keyId);
    if (!keyEntry) {
      throw new Error('Key not found');
    }

    if (keyEntry.type !== 'wif') {
      throw new Error('Key shares can only be generated for WIF keys');
    }

    try {
      // Import the PrivateKey class from @bsv/sdk
      const { PrivateKey } = await import('@bsv/sdk');

      // Create a PrivateKey instance from the WIF
      const privKey = PrivateKey.fromWif(keyEntry.value);

      // Generate backup shares
      const shares = privKey.toBackupShares(threshold, totalShares);

      const generatedAt = new Date().toISOString();

      // Delete any existing share entries for this parent key
      const existingShares = this.decryptedKeys.filter(
        k => k.type === 'keyshare' && k.metadata?.parentId === keyId
      );
      for (const share of existingShares) {
        await this.deleteKey(share.id);
      }

      // Create individual top-level KeyEntry for each share
      for (let i = 0; i < shares.length; i++) {
        await this.storeKey({
          type: 'keyshare',
          value: shares[i],
          label: `Share ${i + 1} of ${totalShares}`,
          metadata: {
            parentId: keyId,
            parentLabel: keyEntry.label || keyEntry.type,
            shareIndex: String(i + 1),
            shareTotal: String(totalShares),
            shareThreshold: String(threshold),
            generatedAt,
          }
        });
      }

      // Update parent key metadata to track share generation
      await this.updateKeyMetadata(keyId, {
        sharesGenerated: generatedAt,
        sharesCount: String(totalShares),
        sharesThreshold: String(threshold),
      });

      return shares;
    } catch (error) {
      throw new Error(`Failed to generate key shares: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reconstruct a private key from key shares
   * @param shares The key shares to reconstruct from
   * @returns The reconstructed WIF private key
   */
  public async reconstructFromKeyShares(shares: string[]): Promise<string> {
    if (!shares || shares.length < 2) {
      throw new Error('At least 2 shares are required to reconstruct the private key');
    }

    try {
      // Import the PrivateKey class from @bsv/sdk
      const { PrivateKey } = await import('@bsv/sdk');
      
      // Reconstruct the private key from the shares
      const privKey = PrivateKey.fromBackupShares(shares);
      
      // Return the WIF
      return privKey.toWif();
    } catch (error) {
      throw new Error(`Failed to reconstruct key from shares: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}