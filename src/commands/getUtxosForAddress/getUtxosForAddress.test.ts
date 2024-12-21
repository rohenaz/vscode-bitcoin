import { afterEach, describe, expect, mock, test } from 'bun:test';
import { handleGetUtxosForAddressCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('getUtxosForAddress', () => {
  const originalWindow = vscode.window;
  const originalFetch = global.fetch;

  afterEach(() => {
    vscode.window = originalWindow;
    global.fetch = originalFetch;
  });

  test('returns undefined when input is cancelled', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleGetUtxosForAddressCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('validates empty address', async () => {
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

    await handleGetUtxosForAddressCommand(mockOutput);
    expect(validationMessage).toBe('Address cannot be empty');
  });

  test('validates invalid address format', async () => {
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('invalid-address') || '';
        }
        return undefined;
      },
    };

    await handleGetUtxosForAddressCommand(mockOutput);
    expect(validationMessage).toBe('Invalid address format');
  });

  test('handles no UTXOs found', async () => {
    const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => address,
    };

    // Mock fetch to return 404
    global.fetch = async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response;
    };

    const result = await handleGetUtxosForAddressCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('utxos');
    const data = JSON.parse(result?.data || '{}');
    expect(data).toEqual({
      address,
      utxoCount: 0,
      totalSatoshis: 0,
      utxos: [],
    });
  });

  test('handles API error', async () => {
    const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => address,
    };

    // Mock fetch to return error
    global.fetch = async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      } as Response;
    };

    await expect(handleGetUtxosForAddressCommand(mockOutput)).rejects.toThrow(
      'Failed to fetch UTXOs',
    );
  });

  test('handles BAP ID error', async () => {
    const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => address,
    };

    // Mock fetch to return checksum error
    global.fetch = async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Checksum mismatch' }),
      } as Response;
    };

    await expect(handleGetUtxosForAddressCommand(mockOutput)).rejects.toThrow(
      'Invalid address format. If this is a BAP ID',
    );
  });

  test('returns formatted UTXOs', async () => {
    const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const mockUtxos = [
      {
        txid: '1234567890abcdef',
        vout: 0,
        satoshis: 1000,
        script: 'script1',
      },
      {
        txid: 'abcdef1234567890',
        vout: 1,
        satoshis: 2000,
        script: 'script2',
      },
    ];

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => address,
    };

    // Mock fetch to return UTXOs
    global.fetch = async () => {
      return {
        ok: true,
        json: async () => mockUtxos,
      } as Response;
    };

    const result = await handleGetUtxosForAddressCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('utxos');
    const data = JSON.parse(result?.data || '{}');
    expect(data.address).toBe(address);
    expect(data.utxoCount).toBe(2);
    expect(data.totalSatoshis).toBe(3000);
    expect(data.utxos).toHaveLength(2);
    expect(data.utxos[0]).toHaveProperty('txid', mockUtxos[0].txid);
    expect(data.utxos[1]).toHaveProperty('value', mockUtxos[1].satoshis);
  });
});
