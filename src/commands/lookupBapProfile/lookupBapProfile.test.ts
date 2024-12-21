import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { CancellationToken, Progress } from 'vscode';
import { handleLookupBapProfileCommand } from '.';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('lookupBapProfile', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('should return undefined when user cancels input', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleLookupBapProfileCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('should validate empty BAP ID with error message', async () => {
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

    await handleLookupBapProfileCommand(mockOutput);
    expect(validationMessage).toBe('BAP ID cannot be empty');
  });

  test('should validate invalid BAP ID format with error message', async () => {
    let validationMessage = '';
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: {
        prompt?: string;
        value?: string;
        validateInput?: (text: string) => string | null;
      }) => {
        if (options?.validateInput) {
          validationMessage = options.validateInput('invalid!@#') || '';
        }
        return undefined;
      },
    };

    await handleLookupBapProfileCommand(mockOutput);
    expect(validationMessage).toBe('Invalid BAP ID format');
  });

  test('should handle API error with appropriate error message', async () => {
    const bapId = 'Go8vCHAa4S6AhXKTABGpANiz35J';

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => bapId,
      withProgress: async <T>(
        options: { location: number; title?: string; cancellable?: boolean },
        task: (
          progress: Progress<{ message?: string; increment?: number }>,
          token: CancellationToken,
        ) => Promise<T>,
      ): Promise<T> => {
        throw new Error('API error');
      },
    };

    await expect(handleLookupBapProfileCommand(mockOutput)).rejects.toThrow(
      'Failed to lookup BAP profile',
    );
  });

  test('should return correctly formatted profile data for valid BAP ID', async () => {
    const bapId = 'Go8vCHAa4S6AhXKTABGpANiz35J';
    const mockProfile = {
      id: bapId,
      idKey: bapId,
      currentAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      rootAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      identity: {
        alternateName: 'Test User',
        description: 'Test profile',
      },
      addresses: [
        {
          address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          txId: 'fbbb60a4887725d8b5005b73b996387ba26993ed8ffec44933333b8f4ecfac74',
          block: 0,
        },
      ],
    };

    vscode.window = {
      ...originalWindow,
      showInputBox: async () => bapId,
      withProgress: async <T>(
        options: { location: number; title?: string; cancellable?: boolean },
        task: (
          progress: Progress<{ message?: string; increment?: number }>,
          token: CancellationToken,
        ) => Promise<T>,
      ): Promise<T> => {
        return mockProfile as T;
      },
    };

    const result = await handleLookupBapProfileCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('bap');
    const data = JSON.parse(result?.data || '{}');
    expect(data).toEqual(mockProfile);
    expect(result?.name).toBe(`profile_${bapId}`);
  });
});
