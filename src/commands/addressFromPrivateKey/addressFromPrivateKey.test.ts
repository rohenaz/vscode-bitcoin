import { afterEach, describe, expect, mock, test } from 'bun:test';
import { PrivateKey } from '@bsv/sdk';
import { handleAddressFromPrivateKeyCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('addressFromPrivateKey', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('should return undefined when input is cancelled', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleAddressFromPrivateKeyCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('should handle invalid private key', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => 'invalid',
    };

    await expect(
      handleAddressFromPrivateKeyCommand(mockOutput),
    ).rejects.toThrow();
  });

  test('should generate valid address from private key', async () => {
    // Generate a valid private key for testing
    const privateKey = PrivateKey.fromRandom();
    const privKeyStr = privateKey.toString();

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => privKeyStr,
    };

    const result = await handleAddressFromPrivateKeyCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('addresses');
    expect(result?.name).toBe('from_privkey');
    expect(result?.data).toBeDefined();
    expect(typeof result?.data).toBe('string');
    expect(result?.data.startsWith('1')).toBe(true);
  });
});
