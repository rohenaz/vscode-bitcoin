import vscode from 'vscode';
import { PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';

export async function publicKeyFromPrivateKey(output: OutputManager) {
  const privKeyStr = await vscode.window.showInputBox({
    value: '',
    placeHolder: 'Ex: L...',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!privKeyStr) {
    return undefined;
  }

  const privKey = PrivateKey.fromString(privKeyStr);
  const pubKey = privKey.toPublicKey();

  return {
    data: pubKey.toString(),
    type: 'keys' as const,
    name: 'pubkey_from_privkey',
  };
} 