import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateWIF(output: OutputManager, keyVault: KeyVault) {
  try {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();
    const pubKey = privKey.toPublicKey();

    // Only store in vault if auto-store is enabled
    if (keyVault.isAutoStoreEnabled()) {
      // Store WIF first
      const parentId = await keyVault.storeKey({
        type: 'wif',
        value: wif,
        label: 'Generated WIF',
        metadata: {},
      });

      // Store public key with parentId reference
      await keyVault.storeKey({
        type: 'public',
        value: pubKey.toString(),
        label: 'Generated Public Key',
        metadata: { parentId },
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
