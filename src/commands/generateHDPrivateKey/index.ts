import { HD } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateHDPrivateKey(
  output: OutputManager,
  keyVault: KeyVault,
) {
  try {
    const hdPrivKey = HD.fromRandom();
    const hdPubKey = hdPrivKey.toPublic();
    const xprv = hdPrivKey.toString();
    const xpub = hdPubKey.toString();

    // Only store in vault if auto-store is enabled
    if (keyVault.isAutoStoreEnabled()) {
      // Store HD private key first
      const parentId = await keyVault.storeKey({
        type: 'hdprivate',
        value: xprv,
        label: 'Generated HD Private Key',
        metadata: {},
      });

      // Store HD public key with parentId reference
      await keyVault.storeKey({
        type: 'hdpublic',
        value: xpub,
        label: 'Generated HD Public Key',
        metadata: { parentId },
      });
    }

    return {
      data: xprv,
      type: 'keys' as const,
      name: 'hdprivkey',
    };
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error generating HD private key: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw error;
  }
}
