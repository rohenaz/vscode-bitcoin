import { describe, expect, test, mock, afterEach } from 'bun:test';
import vscode from '../../test/setup';
import type { OutputManager } from '../../output';
import { handleAddressFromHDPrivateKeyCommand } from '.';
import { HD } from '@bsv/sdk';

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('addressFromHDPrivateKey', () => {
  const originalWindow = vscode.window;

  afterEach(() => {
    vscode.window = originalWindow;
  });

  test('should return undefined when xpriv input is cancelled', async () => {
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => undefined
    };
    
    const result = await handleAddressFromHDPrivateKeyCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('should return undefined when path input is cancelled', async () => {
    let inputCount = 0;
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => {
        inputCount++;
        return inputCount === 1 ? 'xprv...' : undefined;
      }
    };
    
    const result = await handleAddressFromHDPrivateKeyCommand(mockOutput);
    expect(result).toBeUndefined();
  });

  test('should handle invalid HD private key', async () => {
    let validationMessage = '';
    let inputCount = 0;
    vscode.window = {
      ...originalWindow,
      showInputBox: async (options?: { prompt?: string; value?: string; validateInput?: (text: string) => string | null }) => {
        inputCount++;
        if (inputCount === 1 && options?.validateInput) {
          validationMessage = options.validateInput('invalid') || '';
          return undefined;
        }
        return undefined;
      }
    };
    
    await handleAddressFromHDPrivateKeyCommand(mockOutput);
    expect(validationMessage).toBe('Invalid extended private key!');
  });

  test('should generate valid address from HD private key', async () => {
    // Generate a valid xpriv for testing
    const hdPrivKey = HD.fromRandom();
    const xpriv = hdPrivKey.toString();
    const path = 'm/0/0';
    let inputCount = 0;
    
    vscode.window = {
      ...originalWindow,
      showInputBox: async () => {
        inputCount++;
        return inputCount === 1 ? xpriv : path;
      }
    };
    
    const result = await handleAddressFromHDPrivateKeyCommand(mockOutput);
    expect(result).toBeDefined();
    expect(result?.type).toBe('addresses');
    expect(result?.name).toBe('from_hdprivkey_m_0_0');
    expect(result?.data).toBeDefined();
    expect(typeof result?.data).toBe('string');
    expect(result?.data.startsWith('1')).toBe(true);
  });
}); 