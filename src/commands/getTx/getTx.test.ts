import { afterEach, describe, expect, mock, test } from 'bun:test';
import { handleGetTxCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

// Mock fetch globally
const originalFetch = globalThis.fetch;

describe('getTx', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
    globalThis.fetch = originalFetch;
  });

  test('returns undefined when txid input is cancelled', async () => {
    // Mock user cancelling the input
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleGetTxCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('returns undefined when format selection is cancelled', async () => {
    // Mock user entering txid but cancelling format selection
    vscode.window = {
      ...originalWindow,
      showInputBox: async () =>
        '1234567890123456789012345678901234567890123456789012345678901234',
      showQuickPick: async () => undefined,
    };

    const result = await handleGetTxCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('validates txid format', async () => {
    // Mock user entering invalid txid
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('invalid-txid') || '';
        }
        return undefined;
      },
    };

    await handleGetTxCommand(mockOutput);
    expect(validationMessage).toBe(
      'Invalid transaction ID format. Expected: 64 character hex string',
    );
  });

  test('returns formatted result for valid input', async () => {
    // Mock user entering valid txid and selecting format
    const txid =
      '1234567890123456789012345678901234567890123456789012345678901234';
    const mockFormat = {
      label: 'Hex (Raw Transaction)',
      value: 'hex',
      description: 'Raw transaction hex',
    };
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => txid,
      showQuickPick: async () => mockFormat as unknown as string,
    };

    // Mock fetch response with a valid P2PKH transaction
    globalThis.fetch = mock(async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        json: async () => ({
          transaction: Buffer.from(
            '01000000017967a5185e907a25225574544c31f7b059c1a191d65b53dcc1554d339c4f9ecd010000006a47304402206a2eb16b7b92051d0fa38c133e67684ed064effada1d7f925c842da401d4f22702201f196b10e6e4b4a9fff948e5c5d71ec5da53e90529c8dbd122bff2b1d21dc8a90121039b7bcd0824b9a9164f7ba098408e63e5b7e3cf90835cceb19868f54f8961a825ffffffff01202cb206000000001976a914d0c59903c5bac2868760e90fd521a4665aa7652088ac00000000',
            'hex',
          ).toString('base64'),
        }),
        text: async () => '',
        blob: async () => new Blob(),
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        clone: () => mockResponse as Response,
        body: null,
        bodyUsed: false,
      };
      return mockResponse as Response;
    });

    const result = await handleGetTxCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('transactions');
    expect(result?.name).toContain(txid);
  });
});
