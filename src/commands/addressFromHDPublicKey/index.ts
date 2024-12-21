import vscode from 'vscode';
import { HD } from '@bsv/sdk';
import type { OutputManager } from '../../output';

export async function addressFromHDPublicKey(output: OutputManager) {
  const xPub = await vscode.window.showInputBox({
    value: '',
    placeHolder: 'Ex: xpub661MyMwAqRbcGa7...',
    validateInput: (text) => {
      return text.length !== 111 ? 'Invalid extended public key!' : null;
    },
  });

  const path = await vscode.window.showInputBox({
    value: 'm/0/0',
    placeHolder: 'Ex: m/0/0',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!xPub || !path) {
    return undefined;
  }

  const hdPubKey = HD.fromString(xPub);
  const derivedPubKey = hdPubKey.derive(path);
  const address = derivedPubKey.pubKey.toAddress();

  return {
    data: address,
    type: 'addresses' as const,
    name: 'from_hdpubkey_m_0_0',
  };
} 