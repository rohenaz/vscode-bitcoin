import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generatePrivateKey(
  output: OutputManager,
  keyVault: KeyVault,
) {
  try {
    const privateKey = PrivateKey.fromRandom();
    const hex = privateKey.toString();
    const wif = privateKey.toWif();
    const pubKey = privateKey.toPublicKey();

    // Output both formats
    await output.handleOutput(
      `Private Key (hex): ${hex}\nPrivate Key (WIF): ${wif}`,
      'bitcoin.generatePrivateKey',
      'keys',
      'privkey',
    );

    // Only store in vault if auto-store is enabled
    if (keyVault.isAutoStoreEnabled()) {
      // Store private key first
      const parentId = await keyVault.storeKey({
        type: 'private',
        value: hex,
        label: 'Generated Private Key',
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
      data: hex,
      type: 'keys' as const,
      name: 'privkey',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating private key: ${error}`);
    throw error;
  }
}
