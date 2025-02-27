import { afterEach, describe, expect, mock, test } from 'bun:test';
import { handleDecodeRawTxCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';
import { Transaction } from '@bsv/sdk';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('decodeRawTx', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('returns undefined when input is cancelled', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleDecodeRawTxCommand(mockOutput);
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

    await handleDecodeRawTxCommand(mockOutput);
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

    await handleDecodeRawTxCommand(mockOutput);
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

    await handleDecodeRawTxCommand(mockOutput);
    expect(validationMessage).toBe('Transaction hex too short');
  });

  test('returns decoded transaction for valid input', async () => {
    // Create a valid transaction with known values
    const tx = new Transaction();
    tx.version = 1;
    const rawTxHex = tx.toHex();

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => rawTxHex,
      // @ts-expect-error mock return type
      showQuickPick: async () => ({
        label: 'JSON (Parsed)',
        value: 'json',
        description: 'Parsed transaction data'
      })
    };

    const result = await handleDecodeRawTxCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('transactions');
    
    const data = JSON.parse(result?.data || '{}');
    expect(data).toEqual({
      version: 1,
      inputs: [],
      outputs: [],
      lockTime: 0
    });
  });

  test('returns undefined when format selection is cancelled', async () => {
    const tx = new Transaction();
    const rawTxHex = tx.toHex();

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => rawTxHex,
      showQuickPick: async () => undefined
    };

    const result = await handleDecodeRawTxCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('handles invalid transaction hex', async () => {
    // Valid hex but invalid transaction format
    const rawTxHex = '0123456789abcdef';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => rawTxHex,
      // @ts-expect-error mock return type
      showQuickPick: async () => ({
        label: 'JSON (Parsed)',
        value: 'json',
        description: 'Parsed transaction data'
      })
    };

    await expect(handleDecodeRawTxCommand(mockOutput)).rejects.toThrow(
      'Failed to decode transaction',
    );
  });
});
