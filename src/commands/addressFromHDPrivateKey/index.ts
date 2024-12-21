import vscode from 'vscode';
import { HD, PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';

export async function addressFromHDPrivateKey(output: OutputManager) {
  const xPriv = await vscode.window.showInputBox({
    value: '',
    placeHolder: 'Ex: xprv9s21ZrQH143K...',
    validateInput: (text) => {
      return text.length !== 111 ? 'Invalid extended private key!' : null;
    },
  });

  const path = await vscode.window.showInputBox({
    value: 'm/0/0',
    placeHolder: 'Ex: m/0/0',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!xPriv || !path) {
    return undefined;
  }

  const hdPrivKey = HD.fromString(xPriv);
  const derivedKey = hdPrivKey.derive(path);
  const privKey = PrivateKey.fromHex(derivedKey.privKey.toString());
  const pubKey = privKey.toPublicKey();
  const address = pubKey.toAddress();

  return {
    data: address,
    type: 'addresses' as const,
    name: `from_hdprivkey_${path.replaceAll('/', '_')}`,
  };
} 