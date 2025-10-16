import { afterEach, describe, expect, mock, test } from 'bun:test';
import { HD } from '@bsv/sdk';
import { handleAddressFromHDPublicKeyCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('addressFromHDPublicKey', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('should return undefined when xpub input is cancelled', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleAddressFromHDPublicKeyCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('should return undefined when path input is cancelled', async () => {
    let inputCount = 0;
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => {
        inputCount++;
        return inputCount === 1 ? 'xpub...' : undefined;
      },
    };

    const result = await handleAddressFromHDPublicKeyCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('should handle invalid HD public key', async () => {
    let validationMessage = '';
    let inputCount = 0;
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        inputCount++;
        if (inputCount === 1 && options?.validateInput) {
          validationMessage = options.validateInput('invalid') || '';
          return undefined;
        }
        return undefined;
      },
    };

    await handleAddressFromHDPublicKeyCommand(mockOutput);
    expect(validationMessage).toBe('Invalid extended public key!');
  });

  test('should generate valid address from HD public key', async () => {
    // Generate a valid xpub for testing
    const hdPrivKey = HD.fromRandom();
    const hdPubKey = hdPrivKey.toPublic();
    const xpub = hdPubKey.toString();
    const path = 'm/0/0';
    let inputCount = 0;

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => {
        inputCount++;
        return inputCount === 1 ? xpub : path;
      },
    };

    const result = await handleAddressFromHDPublicKeyCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('addresses');
    expect(result?.name).toBe('from_hdpubkey_m_0_0');
    expect(result?.data).toBeDefined();
    expect(typeof result?.data).toBe('string');
    expect(result?.data.startsWith('1')).toBe(true);
  });
});
