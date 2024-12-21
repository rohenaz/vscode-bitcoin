var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = { enumerable: true, get: () => m[k] };
        }
        Object.defineProperty(o, k2, desc);
      }
    : (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? (o, v) => {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : (o, v) => {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (() => {
    var ownKeys = (o) => {
      ownKeys =
        Object.getOwnPropertyNames ||
        ((o) => {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        });
      return ownKeys(o);
    };
    return (mod) => {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.EncryptionService = void 0;
const crypto = __importStar(require('node:crypto'));
const sdk_1 = require('@bsv/sdk');
const vscode = __importStar(require('vscode'));
class EncryptionService {
  constructor(keyVault) {
    this.keyVault = keyVault;
  }
  /**
   * Encrypt data using a private key
   * @param data The data to encrypt
   * @param privateKey Optional private key to use. If not provided, a new one will be generated
   * @param context Additional context about the encryption operation
   * @returns Object containing the encrypted data and the private key used
   */
  async encrypt(data, privateKey, context) {
    try {
      // Convert data to buffer if it's a string
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      // Generate or use provided private key
      const key = privateKey || sdk_1.PrivateKey.fromRandom();
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
      // Encrypt the data
      // We'll use the private key to derive a shared secret
      const publicKey = key.toPublicKey();
      const sharedKey = crypto
        .createHash('sha256')
        .update(publicKey.toString())
        .digest();
      // Use AES encryption with the shared key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', sharedKey, iv);
      const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
      // Combine IV and encrypted data
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
   */
  async decrypt(encryptedData, privateKey) {
    try {
      // Decode base64 data
      const data = Buffer.from(encryptedData, 'base64');
      // Extract IV and encrypted data
      const iv = data.slice(0, 16);
      const encrypted = data.slice(16);
      // Derive shared key
      const publicKey = privateKey.toPublicKey();
      const sharedKey = crypto
        .createHash('sha256')
        .update(publicKey.toString())
        .digest();
      // Decrypt the data
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
   */
  async promptForKey(mode) {
    if (mode === 'encrypt') {
      const options = ['Generate New Key', 'Use Existing Key (WIF)'];
      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select encryption key source',
      });
      if (!selection) {
        return undefined;
      }
      if (selection === options[0]) {
        return sdk_1.PrivateKey.fromRandom();
      }
    }
    // For decryption, or if user chose to use existing key for encryption
    const wif = await vscode.window.showInputBox({
      prompt:
        mode === 'encrypt'
          ? 'Enter private key in WIF format'
          : 'Enter the decryption key (WIF format)',
      password: true,
      validateInput: (input) => {
        try {
          sdk_1.PrivateKey.fromWif(input);
          return null;
        } catch {
          return 'Invalid WIF format';
        }
      },
    });
    if (!wif) {
      return undefined;
    }
    return sdk_1.PrivateKey.fromWif(wif);
  }
}
exports.EncryptionService = EncryptionService;
//# sourceMappingURL=encryption.js.map
