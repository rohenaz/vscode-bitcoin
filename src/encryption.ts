import * as crypto from 'node:crypto';
import { Hash, PrivateKey, SymmetricKey, Utils } from '@bsv/sdk';
import type { KeyVault } from './keyVault';
import vsApi from './vsShim';

const { toArray, toBase64, toHex, toUTF8 } = Utils;

export class EncryptionService {
  constructor(private keyVault: KeyVault) {}

  /**
   * Check if a private key is the current system key
   * @param key The private key to check
   * @returns true if the key is the current system key
   */
  async isSystemKey(key: PrivateKey): Promise<boolean> {
    const systemKey = await this.keyVault.getEncryptionKey();
    return systemKey ? systemKey.value === key.toWif() : false;
  }

  /**
   * Encrypt data using a private key
   * @param data The data to encrypt
   * @param privateKey Optional private key to use. If not provided, a new one will be generated
   * @param context Additional context about the encryption operation
   * @returns Object containing the encrypted data and the private key used
   * 
   * NOTE: This is your existing ephemeral "private key" encryption approach.
   */
  async encrypt(
    data: string | Buffer,
    privateKey?: PrivateKey,
    context?: { fileName?: string; command?: string },
  ): Promise<{
    encryptedData: string;
    privateKey: PrivateKey;
  }> {
    try {
      // Convert data to buffer if it's a string
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Generate or use provided private key
      const key = privateKey || PrivateKey.fromRandom();

      // If this is a newly generated key, store it in the vault
      if (!privateKey) {
        await this.keyVault.storeKey({
          type: 'encryption',
          value: key.toWif(),
          label: `Encryption Key - ${context?.command || 'Manual Encryption'}${
            context?.fileName ? ` - ${context.fileName}` : ''
          }`,
        });
      }

      // Derive a shared key from the private key's public key
      const publicKey = key.toPublicKey();
      const sharedKey = crypto
        .createHash('sha256')
        .update(publicKey.toString())
        .digest();

      // AES-256-CBC
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', sharedKey, iv);
      const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

      // Combine IV + encrypted payload
      const result = Buffer.concat([iv, encrypted]);

      return {
        encryptedData: result.toString('base64'),
        privateKey: key,
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using a private key
   * @param encryptedData Base64 encoded encrypted data
   * @param privateKey The private key used for encryption
   * @returns The decrypted data
   * 
   * NOTE: This is your existing ephemeral "private key" decryption approach.
   */
  async decrypt(
    encryptedData: string,
    privateKey: PrivateKey,
  ): Promise<Buffer> {
    try {
      // Decode base64
      const data = Buffer.from(encryptedData, 'base64');

      // Split out the IV
      const iv = data.slice(0, 16);
      const encrypted = data.slice(16);

      // Derive shared key from the private key's public key
      const publicKey = privateKey.toPublicKey();
      const sharedKey = crypto
        .createHash('sha256')
        .update(publicKey.toString())
        .digest();

      // AES-256-CBC decrypt
      const decipher = crypto.createDecipheriv('aes-256-cbc', sharedKey, iv);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Prompt user for encryption key
   * @param mode Whether this is for encryption or decryption
   * @returns PrivateKey or undefined if cancelled
   * 
   * NOTE: This is your existing ephemeral "private key" prompt approach.
   */
  async promptForKey(
    mode: 'encrypt' | 'decrypt',
  ): Promise<PrivateKey | undefined> {
    // Check if we have a system key
    const systemKey = await this.keyVault.getEncryptionKey();

    if (mode === 'encrypt') {
      const options = systemKey 
        ? ['Use System Key', 'Generate New Key', 'Use Existing Key (WIF)']
        : ['Generate New Key', 'Use Existing Key (WIF)'];
      const selection = await vsApi.window.showQuickPick(options, {
        placeHolder: 'Select encryption key source',
      });

      if (!selection) {
        return undefined;
      }

      if (selection === 'Use System Key' && systemKey) {
        return PrivateKey.fromWif(systemKey.value);
      }

      if (selection === 'Generate New Key') {
        return PrivateKey.fromRandom();
      }
    } else {
      // For decryption, check if we have a system key
      if (systemKey) {
        const options = ['Use System Key', 'Enter Key'];
        const selection = await vsApi.window.showQuickPick(options, {
          placeHolder: 'Choose decryption key source',
        });

        if (!selection) {
          return undefined;
        }

        if (selection === 'Use System Key') {
          return PrivateKey.fromWif(systemKey.value);
        }
      }
    }

    // For decryption or user-chosen "Existing Key (WIF)" 
    const wif = await vsApi.window.showInputBox({
      prompt:
        mode === 'encrypt'
          ? 'Enter private key in WIF format'
          : 'Enter the decryption key (WIF format)',
      password: true,
      validateInput: (input) => {
        try {
          PrivateKey.fromWif(input);
          return null;
        } catch {
          return 'Invalid WIF format';
        }
      },
    });

    if (!wif) {
      return undefined;
    }

    return PrivateKey.fromWif(wif);
  }

  /* 
   * --------------------------------------------------------------------------
   * ADDITIONAL: Password-based AES example using bsv-sdk's SymmetricKey
   * --------------------------------------------------------------------------
   */

  /**
   * Derive a 256-bit SymmetricKey from a raw password.
   * Currently we do one pass of sha256. In production, you'd do PBKDF2 or Argon2, etc.
   */
  deriveSymmetricKeyFromPassword(password: string): SymmetricKey {
    const hash = Hash.sha256(password);
    return new SymmetricKey(toArray(hash));
  }

  /**
   * AES-GCM encrypt with a SymmetricKey (returns base64)
   */
  encryptWithSymKey(key: SymmetricKey, plaintext: string): string {
    // Convert plaintext to array
    const plaintextArray = toHex(toArray(plaintext));
    // By default, SymmetricKey.encrypt returns IV|ciphertext|authTag in hex
    const hex = key.encrypt(plaintextArray, 'hex');
    // Convert hex to base64 for storage/transmission
    return toBase64(toArray(hex, 'hex'));
  }

  /**
   * AES-GCM decrypt with a SymmetricKey (plaintext returned as UTF-8 string)
   */
  decryptWithSymKey(key: SymmetricKey, ciphertextBase64: string): string {
    // Convert base64 back to hex
    const hex = toHex(toArray(ciphertextBase64, 'base64'));
    // Returns the plaintext as a UTF-8 string
    return toUTF8(toArray(key.decrypt(hex, 'hex') as string, 'hex'));
  }
}