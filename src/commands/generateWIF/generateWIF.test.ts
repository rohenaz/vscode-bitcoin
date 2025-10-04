import { describe, expect, mock, test, beforeEach } from 'bun:test';
import { PrivateKey } from '@bsv/sdk';
import vscode from '@test/setup';
import type { KeyVault, KeyEntry } from '../../keyVault';
import type { OutputManager } from '../../output';
import {
  generateWIF,
  generateTestnetWIF,
  generateWIFVanity,
  generateTestnetWIFVanity,
} from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

type KeyEntryInput = Omit<KeyEntry, 'id' | 'timestamp'>;
const storeKeyMock = mock<(entry: KeyEntryInput) => Promise<string>>(() => Promise.resolve('test-id'));
const isAutoStoreEnabledMock = mock<() => boolean>(() => true);
const checkUnlockMock = mock<() => Promise<void>>(() => Promise.resolve());

const mockKeyVault = {
  storeKey: storeKeyMock,
  isAutoStoreEnabled: isAutoStoreEnabledMock,
  isUnlocked: true,
  checkUnlock: checkUnlockMock,
} as unknown as KeyVault;

// Mock window.showErrorMessage
const originalShowErrorMessage = vscode.window.showErrorMessage;
vscode.window.showErrorMessage = mock((_message: string, ..._items: string[]) => Promise.resolve(undefined));

describe('generateWIF', () => {
  beforeEach(() => {
    storeKeyMock.mockClear();
    isAutoStoreEnabledMock.mockImplementation(() => true);
  });

  test('generates valid WIF with autoStore enabled', async () => {
    const result = await generateWIF(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      type: 'keys',
      name: 'wif',
    });

    // Verify only WIF is stored, no public key
    expect(storeKeyMock).toHaveBeenCalledTimes(1);
    const calls = storeKeyMock.mock.calls;
    
    // Only call should store WIF
    expect(calls[0][0]).toEqual({
      type: 'wif',
      value: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      label: 'Generated WIF',
      metadata: {},
    });
  });

  test('generates WIF without storing when autoStore disabled', async () => {
    isAutoStoreEnabledMock.mockImplementation(() => false);
    const result = await generateWIF(mockOutput, mockKeyVault);

    // Check return value format
    expect(result).toEqual({
      data: expect.stringMatching(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/),
      type: 'keys',
      name: 'wif',
    });

    // Verify no keys were stored
    expect(storeKeyMock).not.toHaveBeenCalled();
  });

  test('handles errors', async () => {
    // Mock PrivateKey.fromRandom to throw
    const originalFromRandom = PrivateKey.fromRandom;
    PrivateKey.fromRandom = () => {
      throw new Error('Test error');
    };

    try {
      await expect(generateWIF(mockOutput, mockKeyVault)).rejects.toThrow(
        'Test error',
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error generating WIF: Error: Test error',
      );
    } finally {
      // Restore original functions
      PrivateKey.fromRandom = originalFromRandom;
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('generates testnet WIF with autoStore enabled', async () => {
    const result = await generateTestnetWIF(mockOutput, mockKeyVault);

    expect(result).toEqual({
      data: expect.stringMatching(/^c[1-9A-HJ-NP-Za-km-z]{51}$/),
      type: 'keys',
      name: 'wif_testnet',
    });

    expect(storeKeyMock).toHaveBeenCalledTimes(1);
    const calls = storeKeyMock.mock.calls;
    expect(calls[0][0]).toEqual({
      type: 'wif',
      value: expect.stringMatching(/^c[1-9A-HJ-NP-Za-km-z]{51}$/),
      label: 'Generated Testnet WIF',
      metadata: {},
    });
  });

  test('handles errors when generating testnet WIF', async () => {
    const originalFromRandom = PrivateKey.fromRandom;
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    const showErrorMock = mock(() => Promise.resolve(undefined));
    vscode.window.showErrorMessage = showErrorMock;

    PrivateKey.fromRandom = () => {
      throw new Error('Test error');
    };

    try {
      await expect(generateTestnetWIF(mockOutput, mockKeyVault)).rejects.toThrow(
        'Test error',
      );
      expect(showErrorMock).toHaveBeenCalledWith(
        'Error generating testnet WIF: Error: Test error',
      );
    } finally {
      PrivateKey.fromRandom = originalFromRandom;
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('cancels vanity generation when prefix input is dismissed', async () => {
    const originalShowInput = vscode.window.showInputBox;
    vscode.window.showInputBox = async () => undefined;

    try {
      await expect(generateWIFVanity(mockOutput, mockKeyVault)).resolves.toBeUndefined();
      expect(storeKeyMock).not.toHaveBeenCalled();
    } finally {
      vscode.window.showInputBox = originalShowInput;
    }
  });

  test('generates vanity WIF and stores matching address', async () => {
    const originalShowInput = vscode.window.showInputBox;
    const originalFromRandom = PrivateKey.fromRandom;

    const desiredPrefix = '1ab';
    vscode.window.showInputBox = async () => desiredPrefix;

    const privSequence = [
      PrivateKey.fromHex('1'.repeat(64)),
      PrivateKey.fromHex('2'.repeat(64)),
    ];
    let idx = 0;
    PrivateKey.fromRandom = () => {
      const key = privSequence[idx];
      idx = Math.min(idx + 1, privSequence.length - 1);
      return key;
    };

    const result = await generateWIFVanity(mockOutput, mockKeyVault);
    expect(result?.data).toMatch(/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/);
    expect(storeKeyMock).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();

    PrivateKey.fromRandom = originalFromRandom;
    vscode.window.showInputBox = originalShowInput;
  });

  test('generates testnet vanity WIF', async () => {
    const originalShowInput = vscode.window.showInputBox;
    const originalFromRandom = PrivateKey.fromRandom;

    const desiredPrefix = 'mq';
    vscode.window.showInputBox = async () => desiredPrefix;

    const privSequence = [
      PrivateKey.fromHex('3'.repeat(64)),
      PrivateKey.fromHex('4'.repeat(64)),
    ];
    let idx = 0;
    PrivateKey.fromRandom = () => {
      const key = privSequence[idx];
      idx = Math.min(idx + 1, privSequence.length - 1);
      return key;
    };

    const result = await generateTestnetWIFVanity(mockOutput, mockKeyVault);
    expect(result?.data).toMatch(/^c[1-9A-HJ-NP-Za-km-z]{51}$/);
    expect(storeKeyMock).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();

    PrivateKey.fromRandom = originalFromRandom;
    vscode.window.showInputBox = originalShowInput;
  });

  test('throws when vanity generation exceeds attempt limit', async () => {
    const originalShowInput = vscode.window.showInputBox;
    const originalFromRandom = PrivateKey.fromRandom;

    vscode.window.showInputBox = async () => 'zzzzz';
    PrivateKey.fromRandom = () => {
      throw new Error('No match');
    };

    await expect(generateWIFVanity(mockOutput, mockKeyVault)).rejects.toThrow(
      'Failed to generate vanity address within attempt limit. Try a shorter prefix.',
    );

    PrivateKey.fromRandom = originalFromRandom;
    vscode.window.showInputBox = originalShowInput;
  });
});
