import { describe, expect, mock, test } from 'bun:test';
import type { OutputManager } from '../../output';
import vscode from '../../test/setup';
import { handleDecodeFileCommand } from './index';

const mockOutput = {
  detectAndConvert: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('decodeFile', () => {
  const originalWindow = vscode.window;

  test('returns undefined when user cancels', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined,
    };

    const result = await handleDecodeFileCommand(mockOutput);
    expect(result).toBeUndefined();
    expect(mockOutput.detectAndConvert).not.toHaveBeenCalled();
  });

  test('validates empty input', async () => {
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

    await handleDecodeFileCommand(mockOutput);

    expect(validateFn).toBeDefined();
    if (validateFn) {
      expect(validateFn('')).toBe('Input cannot be empty');
    }
  });

  test('handles base64 input directly', async () => {
    const testInput = 'SGVsbG8='; // "Hello" in base64
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => testInput,
    };

    const result = await handleDecodeFileCommand(mockOutput);
    expect(result).toBeUndefined();
    expect(mockOutput.detectAndConvert).toHaveBeenCalledWith(testInput);
  });

  test('converts hex input to base64', async () => {
    const hexInput = '48656c6c6f'; // "Hello" in hex
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => hexInput,
    };

    const result = await handleDecodeFileCommand(mockOutput);
    expect(result).toBeUndefined();
    expect(mockOutput.detectAndConvert).toHaveBeenCalledWith('SGVsbG8='); // "Hello" in base64
  });

  test('converts binary array input to base64', async () => {
    const binaryInput = '[72,101,108,108,111]'; // "Hello" as byte array
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => binaryInput,
    };

    const result = await handleDecodeFileCommand(mockOutput);
    expect(result).toBeUndefined();
    expect(mockOutput.detectAndConvert).toHaveBeenCalledWith('SGVsbG8='); // "Hello" in base64
  });

  test('handles invalid input format', async () => {
    const invalidInput = 'not-valid-format';
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => invalidInput,
    };

    await expect(handleDecodeFileCommand(mockOutput)).rejects.toThrow(
      'Unable to detect input format',
    );
  });
});
