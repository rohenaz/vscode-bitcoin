import { describe, expect, test, mock, afterEach } from 'bun:test';
import vscode from '../../test/setup';
import { handleGetTxCommand } from '.';
import type { OutputManager } from '../../output';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('getTx', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('returns undefined when txid input is cancelled', async () => {
    // Mock user cancelling the input
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined
    };
    
    const result = await handleGetTxCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('returns undefined when format selection is cancelled', async () => {
    // Mock user entering txid but cancelling format selection
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => '1234567890123456789012345678901234567890123456789012345678901234',
      showQuickPick: async () => undefined
    };
    
    const result = await handleGetTxCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('validates txid format', async () => {
    // Mock user entering invalid txid
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: { prompt?: string; value?: string; validateInput?: (text: string) => string | null }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('invalid-txid') || '';
        }
        return undefined;
      }
    };
    
    await handleGetTxCommand(mockOutput);
    expect(validationMessage).toBe('Invalid transaction ID format. Expected: 64 character hex string');
  });

  test('returns formatted result for valid input', async () => {
    // Mock user entering valid txid and selecting format
    const txid = '1234567890123456789012345678901234567890123456789012345678901234';
    const mockFormat = {
      label: 'Hex (Raw Transaction)',
      value: 'hex',
      description: 'Raw transaction hex'
    };
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => txid,
      showQuickPick: async () => mockFormat as unknown as string
    };
    
    const result = await handleGetTxCommand(mockOutput);
    expect(result).toEqual({
      data: `Transaction ${txid} in hex format`,
      type: 'transactions',
      name: txid
    });
  });
});
