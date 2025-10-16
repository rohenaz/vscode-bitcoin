import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { OutputManager } from '../../output';

export async function publicKeyFromWIF(output: OutputManager) {
  try {
    const wif = await vscode.window.showInputBox({
      value: '',
      placeHolder: 'Ex: L...',
      validateInput: (text) => {
        return text.length === 0 ? 'WIF cannot be empty' : null;
      },
    });

    if (!wif) {
      return undefined;
    }

    const privKey = PrivateKey.fromWif(wif);
    const pubKey = privKey.toPublicKey();
    const value = pubKey.toString();

    return {
      data: value,
      type: 'keys' as const,
      name: 'from_wif',
    };
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error deriving public key from WIF: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw error;
  }
}
