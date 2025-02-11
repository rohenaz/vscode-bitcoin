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
      // Check if vault is locked before attempting to store
      if (!keyVault.isUnlocked) {
        throw new Error('Vault is locked. Please unlock before storing keys.');
      }

      // Store WIF only
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
