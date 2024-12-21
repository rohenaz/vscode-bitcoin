import vscode from 'vscode';
import { PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import type { KeyVault } from '../../keyVault';

export async function generatePrivateKey(output: OutputManager, keyVault: KeyVault) {
  try {
    const privateKey = PrivateKey.fromRandom();
    const hex = privateKey.toString();
    const wif = privateKey.toWif();

    // Output both formats
    await output.handleOutput(
      `Private Key (hex): ${hex}\nPrivate Key (WIF): ${wif}`,
      'bitcoin.generatePrivateKey',
      'keys',
      'privkey'
    );

    // Store in vault
    await keyVault.storeKey({
      type: 'private',
      value: hex,
      label: 'Generated Private Key',
    });

    return {
      data: hex,
      type: 'keys' as const,
      name: 'privkey',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating private key: ${error}`);
    throw error;
  }
}
