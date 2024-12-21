import { HD } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateHDPublicKey(
  output: OutputManager,
  keyVault: KeyVault,
) {
  try {
    const hdPrivKey = HD.fromRandom();
    const hdPubKey = hdPrivKey.toPublic();
    const value = hdPubKey.toString();

    // Store in vault
    await keyVault.storeKey({
      type: 'hdpublic',
      value,
      label: 'Generated HD Public Key',
    });

    return {
      data: value,
      type: 'keys' as const,
      name: 'hdpubkey',
    };
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error generating HD public key: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw error;
  }
}
