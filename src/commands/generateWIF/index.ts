import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';

export async function generateWIF(output: OutputManager, keyVault: KeyVault) {
  try {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif();

    // Only store in vault if auto-store is enabled
    if (keyVault.isAutoStoreEnabled()) {
      await keyVault.checkUnlock();
      await keyVault.storeKey({
        type: 'wif',
        value: wif,
        label: 'Generated WIF',
        metadata: {},
      });
    }

    return {
      data: wif,
      type: 'keys' as const,
      name: 'wif',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating WIF: ${error}`);
    throw error;
  }
}

export async function generateTestnetWIF(output: OutputManager, keyVault: KeyVault) {
  try {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif([0xef]);

    if (keyVault.isAutoStoreEnabled()) {
      await keyVault.checkUnlock();
      await keyVault.storeKey({
        type: 'wif',
        value: wif,
        label: 'Generated Testnet WIF',
        metadata: {}
      });
    }

    return {
      data: wif,
      type: 'keys' as const,
      name: 'wif_testnet',
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error generating testnet WIF: ${error}`);
    throw error;
  }
}

export function sanitizeVanityPrefix(prefix: string): string {
  return prefix.toLowerCase().replace(/[^123456789abcdefghijkmnopqrstuvwxyz]/g, '');
}

async function promptPrefix(networkLabel: string): Promise<string | undefined> {
  const prefix = await vscode.window.showInputBox({
    prompt: `Enter desired ${networkLabel} address prefix (1-5 base58 characters)`,
    validateInput: (value) => {
      const sanitized = sanitizeVanityPrefix(value);
      if (sanitized.length !== value.length) {
        return 'Prefix can only contain base58 characters excluding 0, O, I, l';
      }
      if (sanitized.length === 0) {
        return 'Prefix is required';
      }
      if (sanitized.length > 5) {
        return 'Prefix must be 5 characters or fewer';
      }
      return null;
    },
  });

  if (!prefix) {
    return undefined;
  }

  return sanitizeVanityPrefix(prefix);
}

export async function createVanityWIF(
  prefix: string,
  network: 'mainnet' | 'testnet',
): Promise<{ wif: string; address: string; attempts: number }> {
  const isTestnet = network === 'testnet';
  const prefixBytes = isTestnet ? [0xef] : [0x80];
  const maxAttempts = 1_000_000;

  for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
    const privKey = PrivateKey.fromRandom();
    const wif = privKey.toWif(prefixBytes);
    const address = privKey.toAddress(isTestnet ? 'testnet' : 'mainnet');
    if (address.toLowerCase().startsWith(prefix)) {
      return { wif, address, attempts: attempts + 1 };
    }
  }

  throw new Error('Failed to generate vanity address within attempt limit. Try a shorter prefix.');
}

export async function generateWIFVanity(output: OutputManager, keyVault: KeyVault) {
  const prefix = await promptPrefix('mainnet');
  if (!prefix) {
    return undefined;
  }
  const result = await createVanityWIF(prefix, 'mainnet');
  if (keyVault.isAutoStoreEnabled()) {
    await keyVault.checkUnlock();
    await keyVault.storeKey({
      type: 'wif',
      value: result.wif,
      label: 'Generated vanity WIF',
      metadata: {
        vanityPrefix: prefix,
        network: 'mainnet',
        attempts: result.attempts.toString(),
      },
    });
  }

  await output.handleOutput(result.wif, 'bitcoin.generateWIFVanity', 'keys', `wif_vanity_mainnet_${prefix}`);
  vscode.window.showInformationMessage(
    `Generated vanity address ${result.address} after ${result.attempts} attempts`,
  );
  return {
    data: result.wif,
    type: 'keys' as const,
    name: `wif_vanity_mainnet_${prefix}`,
  };
}

export async function generateTestnetWIFVanity(output: OutputManager, keyVault: KeyVault) {
  const prefix = await promptPrefix('testnet');
  if (!prefix) {
    return undefined;
  }
  const result = await createVanityWIF(prefix, 'testnet');
  if (keyVault.isAutoStoreEnabled()) {
    await keyVault.checkUnlock();
    await keyVault.storeKey({
      type: 'wif',
      value: result.wif,
      label: 'Generated vanity WIF (testnet)',
      metadata: {
        vanityPrefix: prefix,
        network: 'testnet',
        attempts: result.attempts.toString(),
      },
    });
  }

  await output.handleOutput(result.wif, 'bitcoin.generateTestnetWIFVanity', 'keys', `wif_vanity_testnet_${prefix}`);
  vscode.window.showInformationMessage(
    `Generated testnet vanity address ${result.address} after ${result.attempts} attempts`,
  );
  return {
    data: result.wif,
    type: 'keys' as const,
    name: `wif_vanity_testnet_${prefix}`,
  };
}
