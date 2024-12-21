import vscode from 'vscode';
import { PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';

export async function addressFromWIF(output: OutputManager) {
  const wif = await vscode.window.showInputBox({
    value: '',
    placeHolder: 'Ex: L...',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!wif) {
    return undefined;
  }

  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toAddress();

  return {
    data: address,
    type: 'addresses' as const,
    name: 'from_wif',
  };
} 