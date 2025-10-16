import { describe, expect, mock, test } from 'bun:test';
import { HD } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';
import { handleXPubFromXPrivCommand } from './index';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('xPubFromxPriv', () => {
  const originalWindow = vscode.window;

  test('returns undefined when user cancels', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleXPubFromXPrivCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('validates input length', async () => {
    let validateFn: ((text: string) => string | null) | undefined;
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        validateFn = options?.validateInput;
        return undefined;
      },
    };

    await handleXPubFromXPrivCommand(mockOutput);

    expect(validateFn).toBeDefined();
    if (validateFn) {
      expect(validateFn('short_key')).toBe('Invalid private key!');
    }
  });

  test('converts xpriv to xpub', async () => {
    const testXPriv =
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => testXPriv,
    };

    const result = await handleXPubFromXPrivCommand(mockOutput);
    expect(result).toEqual({
      data: HD.fromString(testXPriv).toPublic().toString(),
      type: 'keys',
      name: 'derived_hdpubkey',
    });
  });

  test('handles invalid xpriv', async () => {
    const invalidXPriv = 'invalid_xpriv';
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => invalidXPriv,
    };

    await expect(handleXPubFromXPrivCommand(mockOutput)).rejects.toThrow();
  });
});
