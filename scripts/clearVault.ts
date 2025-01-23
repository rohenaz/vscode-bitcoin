#!/usr/bin/env bun
/**
 * Clears all vault-related secrets so you can test the "first time" password flow again.
 *
 * Usage:
 *   bun run src/scripts/clearVault.ts
 *
 * Adjust the SECRET_KEYS array as needed if your vault uses different keys.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// If you store your extension's secrets in some file-based location:
const SECRET_FILE = path.resolve(
  process.cwd(),
  '.vscode-secrets.json' // <--- adapt to your actual secrets file if any
);

// The known secret keys used by your KeyVault
const SECRET_KEYS = [
  'bitcoin.encryptedVaultBlob',
  'bitcoin.passwordHash',
  'bitcoin.vaultSalt',
  'bitcoin.keyList',
  'bitcoin.encryptionKeyId',
];

async function clearVault() {
  console.log('Clearing all vault-related secrets from local storage...');

  // 1) If your extension or dev environment uses a JSON file approach:
  //    simply remove it or strip out relevant keys:

  if (fs.existsSync(SECRET_FILE)) {
    try {
      const raw = fs.readFileSync(SECRET_FILE, 'utf8');
      const data = JSON.parse(raw);

      // Remove the known keys
      for (const k of SECRET_KEYS) {
        if (data[k]) {
          delete data[k];
          console.log(`Removed secret: ${k}`);
        }
      }

      // Write back
      fs.writeFileSync(SECRET_FILE, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated secrets file: ${SECRET_FILE}`);
    } catch (err) {
      console.error('Failed to parse or modify secrets file:', err);
      process.exit(1);
    }
  } else {
    console.warn(`Secrets file not found: ${SECRET_FILE}`);
    console.warn('Nothing to clear. If you store secrets elsewhere, adapt this script.');
  }

  // 2) If you store extension secrets in OS credentials (e.g. keytar) or real vs-code SecretStorage,
  //    you can call your own "extension command" that removes them, or remove them
  //    however you do inside your extension code. For example:
  //
  // import keytar from 'keytar';
  // for (const k of SECRET_KEYS) {
  //   await keytar.deletePassword('your.extension.id', k);
  //   console.log(`Deleted secret from OS credential store: ${k}`);
  // }
  //
  // 3) If you want a custom approach, put it here. The main idea is:
  //    you identify how your extension’s secrets are actually persisted,
  //    then remove them programmatically so you can test "first-time password" again.

  console.log('Done! If the file-based secrets were removed, your vault should now be empty.');
}

clearVault().catch((err) => {
  console.error('Failed to clear vault secrets:', err);
  process.exit(1);
});