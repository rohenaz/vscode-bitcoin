import { Mnemonic, HD } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateMnemonic(
  output: OutputManager,
  keyVault: KeyVault,
) {
  try {
    const mnemonic = Mnemonic.fromRandom();
    // This is the user-facing phrase
    const words = mnemonic.toString();

    // Also derive an xprv so that we can store it in metadata
    const hd = HD.fromSeed(mnemonic.toSeed());
    const xprv = hd.toString(); // "xprv..."

    // If auto-store is enabled, store it in the vault as type:'mnemonic'
    // .value => the 12 words
    // .metadata.xprv => the derived xprv
    if (keyVault.isAutoStoreEnabled()) {
      await keyVault.storeKey({
        type: 'mnemonic',
        value: words, // the actual phrase
        label: 'Generated Mnemonic',
        metadata: { xprv },
      });
    }

    // Return the mnemonic phrase so the command prints/displays it
    return {
      data: words,
      type: 'keys' as const,
      name: 'mnemonic',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating mnemonic: ${error}`);
    throw error;
  }
}