import { afterEach, describe, expect, mock, test } from 'bun:test';
import { handleRawTxToBobCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('rawTxToBob', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('returns undefined when input is cancelled', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleRawTxToBobCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('validates hex format', async () => {
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('not-hex') || '';
        }
        return undefined;
      },
    };

    await handleRawTxToBobCommand(mockOutput);
    expect(validationMessage).toBe('Invalid hex format');
  });

  test('validates empty input', async () => {
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('') || '';
        }
        return undefined;
      },
    };

    await handleRawTxToBobCommand(mockOutput);
    expect(validationMessage).toBe('Transaction hex cannot be empty');
  });

  test('validates short input', async () => {
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('1234') || '';
        }
        return undefined;
      },
    };

    await handleRawTxToBobCommand(mockOutput);
    expect(validationMessage).toBe('Transaction hex too short');
  });

  test('returns tx hash for non-BOB transaction', async () => {
    // Valid raw transaction hex (minimal tx with no inputs/outputs)
    const rawTxHex = '01000000000000000000';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => rawTxHex,
    };

    const result = await handleRawTxToBobCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('transactions');
    const data = JSON.parse(result?.data || '{}');
    expect(data).toHaveProperty('tx.h');
    expect(typeof data.tx.h).toBe('string');
  });

  test('handles invalid transaction hex', async () => {
    // Valid hex but invalid transaction format
    const rawTxHex = '0123456789abcdef';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => rawTxHex,
    };

    await expect(handleRawTxToBobCommand(mockOutput)).rejects.toThrow(
      'Failed to parse transaction',
    );
  });
});
