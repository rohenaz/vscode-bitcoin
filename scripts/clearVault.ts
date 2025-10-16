#!/usr/bin/env bun
/**
 * Clears all vault-related secrets from VS Code Secret Storage
 * 
 * Usage:
 *   bun run scripts/clearVault.ts
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { $ } from 'bun';
import { argv } from 'node:process';
import { program } from 'commander';

// Get extension info from package.json
const packageJson = JSON.parse(
  await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
);
const [publisher, name] = packageJson.publisher ? 
  [packageJson.publisher, packageJson.name] : 
  ['unknown-publisher', 'bitcoin-extension'];

const EXTENSION_ID = `${publisher}.${name}`;

// Correct secret storage paths for VS Code
const STORAGE_PATHS = {
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', EXTENSION_ID, 'secrets.json'),
  linux: path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', EXTENSION_ID, 'secrets.json'),
  win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', EXTENSION_ID, 'secrets.json')
};

async function clearVault(options: { force: boolean }) {
  if (!options.force) {
    console.log('Add --force flag to confirm vault destruction');
    process.exit(1);
  }
  console.log('Clearing Bitcoin extension vault...\n');

  // 1. Clear secret storage file
  const secretFile = STORAGE_PATHS[process.platform as keyof typeof STORAGE_PATHS] || STORAGE_PATHS.linux;
  
  try {
    console.log('Checking secret storage file:', secretFile);
    const existsBefore = await fs.access(secretFile, fs.constants.F_OK).then(() => true).catch(() => false);
    console.log(`Secret file exists before cleanup: ${existsBefore}`);

    if (existsBefore) {
      const fileContent = await fs.readFile(secretFile, 'utf-8');
      let secretsJson: Record<string, unknown> = {};
      try {
        secretsJson = JSON.parse(fileContent);
      } catch (err) {
        console.error('Failed to parse secret file JSON:', err);
      }
      // Remove vault related keys without using the delete operator
      const restSecrets = Object.fromEntries(
        Object.entries(secretsJson).filter(([k]) =>
          k !== 'bitcoin.encryptedVaultBlob' && k !== 'bitcoin.vaultSalt' && k !== 'bitcoin.passwordHash'
        )
      );
      
      await fs.writeFile(secretFile, JSON.stringify(restSecrets, null, 2), 'utf-8');
      console.log('Vault keys removed from secret storage file.');
    } else {
      console.log('Secret file does not exist, nothing to clear.');
    }
  } catch (error) {
    console.warn('Could not clear secret storage:', (error as Error).message);
  }

  // 2. Clear workspace metadata
  const workspaceStorage = path.join(
    process.cwd(),
    '.vscode',
    'workspaceStorage',
    EXTENSION_ID
  );

  try {
    console.log('\nChecking workspace storage:', workspaceStorage);
    const existsBefore = await fs.access(workspaceStorage).then(() => true).catch(() => false);
    console.log(`Workspace storage exists before cleanup: ${existsBefore}`);

    await fs.rm(workspaceStorage, { recursive: true, force: true });
    
    const existsAfter = await fs.access(workspaceStorage).then(() => true).catch(() => false);
    console.log(`Workspace storage exists after cleanup: ${existsAfter}`);
  } catch (error) {
    console.warn('Could not remove workspace storage:', (error as Error).message);
  }

  // 3. Clear VS Code's secret storage cache
  const cachePath = path.join(
    os.tmpdir(),
    'vscode-secret-storage',
    EXTENSION_ID
  );
  
  try {
    console.log('\nChecking secret cache:', cachePath);
    const existsBefore = await fs.access(cachePath).then(() => true).catch(() => false);
    console.log(`Secret cache exists before cleanup: ${existsBefore}`);

    await fs.rm(cachePath, { recursive: true, force: true });
    
    const existsAfter = await fs.access(cachePath).then(() => true).catch(() => false);
    console.log(`Secret cache exists after cleanup: ${existsAfter}`);
  } catch (error) {
    console.warn('Could not clear secret cache:', (error as Error).message);
  }

  // 4. Clear macOS Keychain entries
  if (process.platform === 'darwin') {
    console.log('\nClearing macOS Keychain entries...');
    try {
      // Show existing keychain entries for the extension
      const { stdout: listOutput } = await $`security dump-keychain | grep "${EXTENSION_ID}" -B 3 -A 4`;
      console.log('Found Keychain entries:\n', listOutput || '[none]');

      // Delete generic passwords by service and account for the extension itself
      try {
        await $`security delete-generic-password -s ${EXTENSION_ID}`;
      } catch (e) {
        console.warn('Failed to delete keychain entry by service name:', e.message);
      }
      try {
        await $`security delete-generic-password -a ${EXTENSION_ID}`;
      } catch (e) {
        console.warn('Failed to delete keychain entry by account name:', e.message);
      }

      // Additionally, delete the specific vault keys individually
      const vaultKeys = ['bitcoin.encryptedVaultBlob', 'bitcoin.vaultSalt', 'bitcoin.passwordHash'];
      for (const key of vaultKeys) {
        try {
          await $`security delete-generic-password -a ${key} -s ${EXTENSION_ID}`;
          console.log(`Deleted vault key: ${key}`);
        } catch (e) {
          console.warn(`Failed to delete vault key ${key}:`, e.message);
        }
      }

      // Verify deletion, ignore error if not found
      let verifyOutput = '';
      try {
        const result = await $`security find-generic-password -s ${EXTENSION_ID} -a ${EXTENSION_ID}`;
        verifyOutput = result.stdout.toString();
      } catch (e) {
        verifyOutput = '';
      }
      console.log('Remaining entries after cleanup:\n', verifyOutput.trim() ? '[found]' : '[none]');
    } catch (error) {
      console.warn('Keychain cleanup failed:', error.message);
    }
  }

  // 5. Nuclear option - clear all extension storage
  const extensionStorage = path.join(
    os.homedir(),
    process.platform === 'darwin' 
      ? 'Library/Application Support/Code/User/globalStorage' 
      : process.platform === 'win32' 
        ? 'AppData/Roaming/Code/User/globalStorage'
        : '.config/Code/User/globalStorage',
    EXTENSION_ID
  );

  try {
    console.log('\nPerforming nuclear cleanup of extension storage:');
    await fs.rm(extensionStorage, { recursive: true, force: true });
    console.log(`Removed entire extension storage: ${extensionStorage}`);
  } catch (error) {
    console.warn('Nuclear cleanup failed:', (error as Error).message);
  }

  console.log('\nVault cleared successfully!');
  console.log('Restart VS Code to see the changes take effect.');
}

// Add CLI options
program
  .option('-f, --force', 'Force vault destruction')
  .parse();

clearVault(program.opts() as { force: boolean }).catch((err) => {
  console.error('Failed to clear vault:', err);
  process.exit(1);
});