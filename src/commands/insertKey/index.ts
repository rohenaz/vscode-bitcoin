import { PrivateKey } from '@bsv/sdk';
import vscode from 'vscode';
import type { KeyVault, KeyEntry } from '../../keyVault';

type KeyFormat = 'wif' | 'hex' | 'decimal';

interface FormatOption {
  label: string;
  description: string;
  value: KeyFormat;
}

const formatOptions: FormatOption[] = [
  { label: 'WIF', description: 'Wallet Import Format (default)', value: 'wif' },
  { label: 'Hex', description: 'Hexadecimal format', value: 'hex' },
  { label: 'Decimal', description: 'Decimal number format', value: 'decimal' },
];

function formatKeyValue(key: KeyEntry, format: KeyFormat): string {
  // If it's already a WIF and we want WIF, just return it
  if (key.type === 'wif' && format === 'wif') {
    return key.value;
  }

  try {
    let privateKey: PrivateKey;

    // Parse the key based on its type
    if (key.type === 'wif') {
      privateKey = PrivateKey.fromWif(key.value);
    } else if (key.type === 'private') {
      // Assume hex format for 'private' type
      privateKey = PrivateKey.fromString(key.value, 'hex');
    } else {
      throw new Error(`Cannot format key of type "${key.type}"`);
    }

    // Convert to requested format
    switch (format) {
      case 'wif':
        return privateKey.toWif();
      case 'hex':
        return privateKey.toHex();
      case 'decimal':
        return privateKey.toString();
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  } catch (error) {
    throw new Error(`Failed to format key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function insertKey(keyVault: KeyVault): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  try {
    // Ensure vault is unlocked
    await keyVault.checkUnlock();

    // Get all keys from vault
    const allKeys = await keyVault.getAllKeys();

    // Filter to only private keys (wif and private types)
    const privateKeys = allKeys.filter(
      (k) => k.type === 'wif' || k.type === 'private'
    );

    if (privateKeys.length === 0) {
      vscode.window.showInformationMessage(
        'No private keys found in vault. Generate or import a key first.'
      );
      return;
    }

    // Create quick pick items for keys
    const keyItems = privateKeys.map((key) => {
      let description = key.type;
      if (key.isIdentityKey) description += ' • Identity';
      if (key.isFundingKey) description += ' • Funding';
      if (key.isOrdinalsKey) description += ' • Ordinals';
      if (key.isEncryptionKey) description += ' • Encryption';

      return {
        label: key.label || `${key.type} key`,
        description,
        detail: key.metadata ? Object.entries(key.metadata)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ') : undefined,
        key,
      };
    });

    // Show key picker
    const selectedKeyItem = await vscode.window.showQuickPick(keyItems, {
      placeHolder: 'Select a key to insert',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selectedKeyItem) {
      return;
    }

    // Show format picker
    const selectedFormat = await vscode.window.showQuickPick(formatOptions, {
      placeHolder: 'Select output format (press Enter for WIF)',
    });

    if (!selectedFormat) {
      return;
    }

    // Format the key
    const formattedKey = formatKeyValue(
      selectedKeyItem.key,
      selectedFormat.value
    );

    // Insert at cursor
    await editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, formattedKey);
    });

    vscode.window.showInformationMessage(
      `Inserted ${selectedKeyItem.label} as ${selectedFormat.label}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to insert key: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}


