import { PrivateKey, Utils } from '@bsv/sdk';
import vscode from 'vscode';
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
  let isTestnet = false;
  try {
    const decoded = Utils.fromBase58Check(wif);
    const prefixBytes = Array.isArray(decoded.prefix)
      ? decoded.prefix
      : Utils.toArray(decoded.prefix);
    if (prefixBytes[0] === 0xef) {
      isTestnet = true;
    }
  } catch {
    // Ignore decode issues; default to mainnet
  }

  const address = privateKey.toAddress(isTestnet ? 'testnet' : 'mainnet');

  return {
    data: address,
    type: 'addresses' as const,
    name: 'from_wif',
  };
}
