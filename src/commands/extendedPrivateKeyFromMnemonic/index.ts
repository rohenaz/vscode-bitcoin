import { HD, Mnemonic } from '@bsv/sdk';
import vscode from 'vscode';
import type { OutputManager } from '../../output';
import type { KeyVault } from '../../keyVault';

export async function extendedPrivateKeyFromMnemonic(output: OutputManager, keyVault: KeyVault) {
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

  // store the hdPrivKey in the key vault
  // Only store in vault if auto-store is enabled
  if (keyVault.isAutoStoreEnabled()) {
    await keyVault.checkUnlock();
    // store the mnemonic in the key vault
    const parentId = await keyVault.storeKey({
      type: 'mnemonic',
      value: mnemonicStr,
      label: 'Mnemonic',
      metadata: {},
    });

    // store the hdPrivKey in the key vault
    await keyVault.storeKey({
      type: 'hdprivate',
      value: hdPrivKey.toString(),
      label: 'HD Private Key',
      metadata: {
        parentId
      },
    });
  }

  return {
    data: hdPrivKey.toString(),
    type: 'keys' as const,
    name: 'hdprivkey_from_mnemonic',
  };
}
