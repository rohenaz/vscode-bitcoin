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
    const value = hdPrivKey.toString();

    // Store in vault
    await keyVault.storeKey({
      type: 'hdprivate',
      value,
      label: 'Generated HD Private Key',
    });

    return {
      data: value,
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
