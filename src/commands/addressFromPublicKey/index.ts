import { PublicKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { OutputManager } from '../../output';

export async function addressFromPublicKey(output: OutputManager) {
  const pubKey = await vscode.window.showInputBox({
    value: '',
    placeHolder: 'Ex: 02...',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!pubKey) {
    return undefined;
  }

  const publicKey = PublicKey.fromString(pubKey);
  const address = publicKey.toAddress();

  return {
    data: address,
    type: 'addresses' as const,
    name: 'from_pubkey',
  };
}
