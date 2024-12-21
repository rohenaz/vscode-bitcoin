import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateWIF(output: OutputManager, keyVault: KeyVault) {
  try {
    const privKey = PrivateKey.fromRandom();
    const value = privKey.toWif();

    // Store in vault
    await keyVault.storeKey({
      type: 'wif',
      value,
      label: 'Generated WIF',
    });

    return {
      data: value,
      type: 'keys' as const,
      name: 'wif',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating WIF: ${error}`);
    throw error;
  }
}
