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
    const xprv = hdPrivKey.toString();

    // Only store in vault if auto-store is enabled
    if (keyVault.isAutoStoreEnabled()) {
      // Store HD private key
      // User can derive xPub child using the "+ xPub" button in the UI
      await keyVault.storeKey({
        type: 'hdprivate',
        value: xprv,
        label: 'Generated HD Private Key',
        metadata: {},
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
