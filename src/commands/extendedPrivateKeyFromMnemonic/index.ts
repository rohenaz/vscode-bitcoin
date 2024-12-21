import vscode from 'vscode';
import { HD, Mnemonic } from '@bsv/sdk';
import type { OutputManager } from '../../output';

export async function extendedPrivateKeyFromMnemonic(output: OutputManager) {
  const mnemonicStr = await vscode.window.showInputBox({
    value: '',
    placeHolder:
      'Ex: solid drastic bone type leopard law virtual share agree way bacon noise',
    validateInput: (text) => {
      return text.split(' ').length !== 12 ? 'Invalid mnemonic!' : null;
    },
  });

  if (!mnemonicStr) {
    return undefined;
  }

  const mnemonic = Mnemonic.fromString(mnemonicStr);
  const hdPrivKey = HD.fromSeed(mnemonic.toSeed());

  return {
    data: hdPrivKey.toString(),
    type: 'keys' as const,
    name: 'hdprivkey_from_mnemonic',
  };
} 