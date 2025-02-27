import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateWIF(output: OutputManager, keyVault: KeyVault) {
  try {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();

    // Only store in vault if auto-store is enabled
    if (keyVault.isAutoStoreEnabled()) {
      await keyVault.checkUnlock();
      await keyVault.storeKey({
        type: 'wif',
        value: wif,
        label: 'Generated WIF',
        metadata: {},
      });
    }

    return {
      data: wif,
      type: 'keys' as const,
      name: 'wif',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating WIF: ${error}`);
    throw error;
  }
}
