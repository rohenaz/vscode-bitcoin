import { HD } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

/**
 * generateHDPublicKey:
 * - If autoStore is off, we just return xpub. (existing minimal)
 * - Else, store xprv, then xpub referencing parentId
 */
export async function generateHDPublicKey(
  output: OutputManager,
  keyVault: KeyVault,
) {
  try {
    const hdPrivKey = HD.fromRandom();
    const hdPubKey = hdPrivKey.toPublic();
    const xPub = hdPubKey.toString();
    const xPrv = hdPrivKey.toString();

    if (!keyVault.isAutoStoreEnabled()) {
      // Return xpub only
      return {
        data: xPub,
        type: 'keys' as const,
        name: 'hdpubkey',
      };
    }

    // Store parent xprv
    const parentId = await keyVault.storeKey({
      type: 'hdprivate',
      value: xPrv,
      label: 'Parent HD Private Key for HDPublicKey',
      metadata: {},
    });

    // Store child xpub referencing parent
    await keyVault.storeKey({
      type: 'hdpublic',
      value: xPub,
      label: 'Generated HD Public Key',
      metadata: { parentId },
    });

    return {
      data: xPub,
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