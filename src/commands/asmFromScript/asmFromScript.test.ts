import vscode from '../../../setup';
import { describe, expect, test, mock, afterAll } from 'bun:test';
import { asmFromScript } from './index';
import type { OutputManager } from '../../output';

interface VSCodeOptions {
  placeHolder?: string;
  prompt?: string;
  value?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
}

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

// Mock window.showInputBox
const originalShowInputBox = vscode.window.showInputBox;

describe('asmFromScript', () => {
  test('converts script hex to ASM', async () => {
    // Mock user input
    vscode.window.showInputBox = async () => '006a0c74657374206d657373616765';

    const result = await asmFromScript(mockOutput);
    
    // Check return value format
    expect(result).toEqual({
      data: 'OP_0 OP_RETURN 74657374206d657373616765',
      type: 'scripts',
      name: expect.stringMatching(/^asm_.*$/),
    });
  });

  test('returns undefined when input is cancelled', async () => {
    // Mock cancelled input
    vscode.window.showInputBox = async () => undefined;

    const result = await asmFromScript(mockOutput);
    expect(result).toBeUndefined();
  });

  afterAll(() => {
    // Restore original function
    vscode.window.showInputBox = originalShowInputBox;
  });
}); 