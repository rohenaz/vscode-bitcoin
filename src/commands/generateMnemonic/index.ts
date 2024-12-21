import { Mnemonic } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateMnemonic(
  output: OutputManager,
  keyVault: KeyVault,
) {
  try {
    const mnemonic = Mnemonic.fromRandom();
    const value = mnemonic.toString();

    // Store in vault
    await keyVault.storeKey({
      type: 'mnemonic',
      value,
      label: 'Generated Mnemonic',
    });

    return {
      data: value,
      type: 'keys' as const,
      name: 'mnemonic',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating mnemonic: ${error}`);
    throw error;
  }
}
