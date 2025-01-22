/**
 * File: encryptionService.test.ts
 *
 * A Jest test file for the EncryptionService class.
 */

import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { PrivateKey, SymmetricKey } from '@bsv/sdk';
import { EncryptionService } from './encryption';
import type { KeyVault, KeyEntry, KeyType } from './keyVault';
import vsApi from './vsShim';
import type { QuickPickOptions, CancellationToken } from 'vscode';

describe('EncryptionService Tests', () => {
  let encService: EncryptionService;
  let mockKeyVault: KeyVault;
  let originalWindow: typeof vsApi.window;

  beforeEach(() => {
    mockKeyVault = {
      getEncryptionKey: mock(() => Promise.resolve(undefined)),
      storeKey: mock(() => Promise.resolve('test-id')),
    } as unknown as KeyVault;

    encService = new EncryptionService(mockKeyVault);

    // Store original window
    originalWindow = vsApi.window;
  });

  afterEach(() => {
    // Restore original window
    vsApi.window = originalWindow;
  });

  test('encrypts and decrypts data with ephemeral private key', async () => {
    const plaintext = 'Hello, World!';
    const result = await encService.encrypt(plaintext);

    expect(result.encryptedData).toBeDefined();
    expect(result.privateKey).toBeInstanceOf(PrivateKey);

    const decrypted = await encService.decrypt(
      result.encryptedData,
      result.privateKey,
    );
    expect(decrypted.toString()).toBe(plaintext);
  });

  test('encryptWithSymKey and decryptWithSymKey using password-derived SymmetricKey', () => {
    const password = 'test123';
    const plaintext = 'Hello, World!';

    // 1) Create key
    const symKey = encService.deriveSymmetricKeyFromPassword(password);
    expect(symKey).toBeInstanceOf(SymmetricKey);

    // 2) Encrypt - returns base64 string
    const cipherHex = encService.encryptWithSymKey(symKey, plaintext);
    expect(typeof cipherHex).toBe('string');
    expect(cipherHex).toMatch(/^[A-Za-z0-9+/=]+$/); // Should be base64

    // 3) Decrypt
    const decrypted = encService.decryptWithSymKey(symKey, cipherHex);
    expect(decrypted).toBe(plaintext);
  });

  test('promptForKey returns random PrivateKey if user picks Generate New Key', async () => {
    // Mock VS Code API
    vsApi.window = {
      ...originalWindow,
      createWebviewPanel: originalWindow.createWebviewPanel,
      registerWebviewViewProvider: originalWindow.registerWebviewViewProvider,
      showInformationMessage: originalWindow.showInformationMessage,
      showWarningMessage: originalWindow.showWarningMessage,
      showErrorMessage: originalWindow.showErrorMessage,
      showInputBox: originalWindow.showInputBox,
      showQuickPick: mock((_items: readonly string[] | Thenable<readonly string[]>, options?: QuickPickOptions & { canPickMany?: boolean }) => {
        if (options?.canPickMany) {
          return Promise.resolve<string[] | undefined>(['Generate New Key']);
        }
        return Promise.resolve<string | undefined>('Generate New Key');
      }) as unknown as typeof originalWindow.showQuickPick,
      showTextDocument: originalWindow.showTextDocument,
      activeTextEditor: originalWindow.activeTextEditor,
      withProgress: originalWindow.withProgress,
    };

    const result = await encService.promptForKey('encrypt');
    expect(result).toBeInstanceOf(PrivateKey);
  });

  test('promptForKey uses systemKey if chosen', async () => {
    // Mock that we have a system key
    const mockSystemKey: KeyEntry = {
      type: 'encryption' as KeyType,
      value: "KwXvYFk7pBd2DMZzLjP1UGciqhh6iDU52yP7yjaesbwfen7eP2Eh",  // Valid WIF
      label: 'System Key', 
      id: 'test-id',
      timestamp: Date.now(),
    };

    mockKeyVault.getEncryptionKey = mock(() =>
      Promise.resolve(mockSystemKey),
    );

    // Mock VS Code API
    vsApi.window = {
      ...originalWindow,
      createWebviewPanel: originalWindow.createWebviewPanel,
      registerWebviewViewProvider: originalWindow.registerWebviewViewProvider,
      showInformationMessage: originalWindow.showInformationMessage,
      showWarningMessage: originalWindow.showWarningMessage,
      showErrorMessage: originalWindow.showErrorMessage,
      showInputBox: originalWindow.showInputBox,
      showQuickPick: mock((_items: readonly string[] | Thenable<readonly string[]>, options?: QuickPickOptions & { canPickMany?: boolean }) => {
        if (options?.canPickMany) {
          return Promise.resolve<string[] | undefined>(['Use System Key']);
        }
        return Promise.resolve<string | undefined>('Use System Key');
      }) as unknown as typeof originalWindow.showQuickPick,
      showTextDocument: originalWindow.showTextDocument,
      activeTextEditor: originalWindow.activeTextEditor,
      withProgress: originalWindow.withProgress,
    };

    const pk = await encService.promptForKey('encrypt');
    expect(pk).toBeInstanceOf(PrivateKey);
  });
});