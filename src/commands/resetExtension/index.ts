import type { OutputManager } from '../../output';
import type { ExtensionContext } from '../../vsShim';
import vsApi from '../../vsShim';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

// Constants for vault encryption
const ENCRYPTED_VAULT_BLOB = 'bitcoin.encryptedVaultBlob';
const SALT_KEY = 'bitcoin.vaultSalt';
const PASSWORD_HASH_KEY = 'bitcoin.passwordHash';

export async function backupExtensionData(context: ExtensionContext): Promise<{ data: string; type: string } | undefined> {
  // Get the path to the secrets storage file
  const secretsPath = path.join(
    context.globalStorageUri.fsPath,
    'secrets.json'
  );

  // Check if file exists
  try {
    await fs.access(secretsPath);
    // Open the folder containing the file
    await vsApi.env.openExternal(vsApi.Uri.file(path.dirname(secretsPath)));
    return undefined;
  } catch (err) {
    vsApi.window.showErrorMessage('No encrypted storage file found to backup');
    return undefined;
  }
}

export async function resetExtension(output: OutputManager, context: ExtensionContext): Promise<{ data: string; type: string } | undefined> {
  // Confirm with user
  const confirm = await vsApi.window.showWarningMessage(
    'This will completely reset the extension, clearing all keys, settings, and stored data. Are you sure?',
    { modal: true },
    'Backup First',
    'Yes, Reset Everything',
    'Cancel'
  );
  
  if (confirm === 'Backup First') {
    await backupExtensionData(context);
    return undefined;
  }
  
  if (confirm !== 'Yes, Reset Everything') {
    return undefined;
  }

  // Get extension ID directly from context
  const extensionId = context.extension.id;

  // 1. Clear all secrets
  await context.secrets.delete(ENCRYPTED_VAULT_BLOB);
  await context.secrets.delete(SALT_KEY);
  await context.secrets.delete(PASSWORD_HASH_KEY);

  // 2. Clear workspace storage
  const workspaceStorage = path.join(
    context.globalStorageUri.fsPath,
    '..',
    '..',
    'workspaceStorage',
    extensionId
  );
  await fs.rm(workspaceStorage, { recursive: true, force: true });

  // 3. Clear VS Code's secret storage cache
  const cachePath = path.join(
    os.tmpdir(),
    'vscode-secret-storage',
    extensionId
  );
  await fs.rm(cachePath, { recursive: true, force: true });

  // 4. Clear all extension storage
  const extensionStorage = path.join(
    os.homedir(),
    process.platform === 'darwin' 
      ? 'Library/Application Support/Code/User/globalStorage' 
      : process.platform === 'win32' 
        ? 'AppData/Roaming/Code/User/globalStorage'
        : '.config/Code/User/globalStorage',
    extensionId
  );
  await fs.rm(extensionStorage, { recursive: true, force: true });

  // 5. Reset all extension state
  await context.globalState.update('bitcoin.hasShownWelcome', undefined);
  await context.workspaceState.update('bitcoin.lastUsedPath', undefined);

  vsApi.window.showInformationMessage('Extension reset successfully. Please reload VS Code for changes to take effect.');
  return undefined;
} 