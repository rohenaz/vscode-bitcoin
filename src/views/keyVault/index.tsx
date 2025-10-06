import vsApi, { type WebviewPanel, type Disposable } from '../../vsShim';
import type { KeyVault, KeyEntry, KeyType } from '../../keyVault';
import { PrivateKey, PublicKey, HD, Mnemonic, Utils, P2PKH } from '@bsv/sdk';
import {
  buildKeyHierarchy,
  derivePublicKeyString,
  deriveAddress,
  deriveHdAddress,
  toPrivateKey,
  derivePublicKey,
  deriveTestnetAddress,
} from './render';
import { createVanityWIF, sanitizeVanityPrefix } from '../../commands/generateWIF';
import * as vscode from 'vscode';
import { decryptBackup, type DecryptedBackup, type OneSatBackup } from 'bitcoin-backup';

/**
 * Build an expanded set of "search tokens" for ephemeral indexing.
 */
function buildSearchTokens(key: KeyEntry): string[] {
  // Always include label, type, raw value in lowercase
  const tokens = [
    (key.label || '').toLowerCase(),
    key.type.toLowerCase(),
    key.value.toLowerCase(),
  ];

  try {
    if (key.type === 'wif' || key.type === 'private' || key.type === 'encryption') {
      const priv = toPrivateKey(key);
      if (priv) {
        tokens.push(priv.toWif().toLowerCase());
        tokens.push(priv.toString().toLowerCase());
        tokens.push(priv.toAddress().toString().toLowerCase());
        tokens.push(priv.toPublicKey().toString().toLowerCase());
      }
    } else if (key.type === 'hdprivate') {
      const hd = HD.fromString(key.value);
      if (hd.privKey) {
        const hex = hd.privKey.toString();
        const p = PrivateKey.fromHex(hex);
        tokens.push(p.toWif().toLowerCase());
        tokens.push(p.toAddress().toString().toLowerCase());
      }
      // xpub
      const xpub = hd.toPublic().toString();
      tokens.push(xpub.toLowerCase());
    } else if (key.type === 'mnemonic') {
      tokens.push(key.value.toLowerCase());
      try {
        const mn = Mnemonic.fromString(key.value);
        const hd = HD.fromSeed(mn.toSeed());
        const hex = hd.privKey ? hd.privKey.toString() : '';
        if (hex) {
          const p = PrivateKey.fromHex(hex);
          tokens.push(p.toWif().toLowerCase());
          tokens.push(p.toAddress().toString().toLowerCase());
        }
        tokens.push(hd.toPublic().toString().toLowerCase());
      } catch {
        // ignore parse errors
      }
    } else if (key.type === 'hdpublic') {
      const hdPub = HD.fromString(key.value);
      tokens.push(hdPub.toPublic().toString().toLowerCase());
    } else if (key.type === 'public') {
      try {
        const pub = PublicKey.fromString(key.value);
        tokens.push(pub.toString().toLowerCase());
        const addr = deriveAddress(key);
        if (addr && !addr.includes('Invalid')) {
          tokens.push(addr.toLowerCase());
          try {
            const result = Utils.fromBase58Check(addr);
            const data = Array.isArray(result) ? result : result.data;
            if (data) {
              const bytes = typeof data === 'string'
                ? data.split('').map((c) => c.charCodeAt(0))
                : (data as number[]);
              const pubKeyHashHex = Utils.toHex(bytes).toLowerCase();
              tokens.push(pubKeyHashHex);
            }
          } catch (err) {
            // Ignore Base58Check parse errors
            console.error('Error parsing public key address:', err);
          }
        }
      } catch (e) {
        // ignore errors
      }
    }
  } catch {
    // ignore derivation errors
  }

  // Additionally, try to add the public key hash from the derived address if available
  try {
    const addr = deriveAddress(key);
    if (addr && !addr.includes('Invalid')) {
      tokens.push(addr.toLowerCase());
      try {
        const result = Utils.fromBase58Check(addr);
        // Handle both object and array return types for backward compatibility
        const data = Array.isArray(result) ? result : result.data;
        if (data) {
          const dataArray = typeof data === 'string' ? data.split('').map(c => c.charCodeAt(0)) : data;
          const pubKeyHashHex = Utils.toHex(dataArray).toLowerCase();
          tokens.push(pubKeyHashHex);
        }
      } catch (err) {
        // Ignore Base58Check parse errors
        console.error('Error parsing address:', err);
      }
    }
  } catch (e) {
    // ignore errors
  }

  // Remove duplicates
  const unique = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t && t.trim().length > 0) {
      unique.add(t.trim());
    }
  }
  return Array.from(unique);
}

export class KeyPanel {
  public static currentPanel: KeyPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _vault: KeyVault;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: Disposable[] = [];

  private lastKeyHash?: string;
  private ephemeralIndex: Record<string, string[]> = {};

  private constructor(panel: WebviewPanel, vault: KeyVault, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._vault = vault;
    this._extensionUri = extensionUri;

    // Initial render
    this.updateContent();

    // Cleanup listeners
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this._disposables,
    );

    // Re-render on vault changes
    this._vault.onDidChangeKeys(() => this.updateContent());
  }

  public static async show(vault: KeyVault, extensionUri: vscode.Uri) {
    // Check if vault is locked
    if (!vault.isUnlocked) {
      // Check if this is first-time setup
      const hasExistingVault = await vault.hasExistingVault();
      
      const password = await vsApi.window.showInputBox({
        prompt: hasExistingVault ? 'Enter vault password to unlock' : 'Set a password for your key vault',
        password: true,
        placeHolder: hasExistingVault ? undefined : 'Choose a strong password'
      });
      if (!password) return; // User cancelled
      
      try {
        await vault.unlockVault(password);
      } catch (err) {
        vsApi.window.showErrorMessage(String(err));
        return;
      }
    }

    // Now show the panel
    if (KeyPanel.currentPanel) {
      KeyPanel.currentPanel._panel.reveal(1);
    } else {
      const panel = vsApi.window.createWebviewPanel(
        'bitcoinKeyVault',
        'Bitcoin Key Vault',
        1,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      KeyPanel.currentPanel = new KeyPanel(panel, vault, extensionUri);
    }
  }

  private async updateContent() {
    // Possibly set default encryption key
    const allKeys = await this._vault.getAllKeys();
    const enc = await this._vault.getEncryptionKey();
    if (!enc) {
      for (let i = 0; i < allKeys.length; i++) {
        const candidate = allKeys[i];
        if (
          (candidate.type === 'private' ||
            candidate.type === 'wif' ||
            candidate.type === 'encryption') &&
          !candidate.isEncryptionKey
        ) {
          await this._vault.setEncryptionKey(candidate.id);
          break;
        }
      }
    }

    // Fetch updated keys
    const refreshed = await this._vault.getAllKeys();

    // Build ephemeral index if changed
    const newHash = JSON.stringify(refreshed);
    if (newHash !== this.lastKeyHash) {
      this.lastKeyHash = newHash;
      const idx: Record<string, string[]> = {};
      for (let i = 0; i < refreshed.length; i++) {
        const key = refreshed[i];
        const tokens = buildSearchTokens(key);
        idx[key.id] = tokens;
      }
      this.ephemeralIndex = idx;
    }

    // Build hierarchy for payload
    const hierarchy = buildKeyHierarchy(refreshed);

    // If panel HTML not yet set, initialize it
    if (!this._panel.webview.html || this._panel.webview.html === '') {
      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    // Send update to webview
    const payload = {
      keys: hierarchy, // Send hierarchical structure
      searchIndex: this.ephemeralIndex,
    };

    this._panel.webview.postMessage({
      command: 'refreshKeys',
      keys: hierarchy,
      searchIndex: this.ephemeralIndex,
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for the React app build artifacts
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'keyVault', 'webview', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'views', 'keyVault', 'webview', 'dist', 'assets', 'index.css')
    );

    // Build initial payload
    const payload = {
      keys: [],
      searchIndex: {},
    };

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src https://ordfs.network data:;">
        <link href="${styleUri}" rel="stylesheet">
        <title>Bitcoin Key Vault</title>
        <style>
          .loader-container {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: var(--vscode-editor-background);
          }
          .loader {
            border: 3px solid transparent;
            border-top-color: var(--vscode-progressBar-background);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader-container" id="initial-loader">
          <div class="loader"></div>
        </div>
        <div id="root"></div>
        <script nonce="${nonce}">
          window.KEYVAULT_PAYLOAD = ${JSON.stringify(payload)};
        </script>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private async handleMessage(msg: {
    command: string;
    id?: string;
    label?: string;
    type?: KeyType;
    value?: string;
    currentLabel?: string;
    shares?: string[];
    text?: string;
    vanityPrefix?: string;
    metadata?: Record<string, string>;
    setAsWallet?: boolean;
    setAsOrdinals?: boolean;
  }) {
    switch (msg.command) {
      case 'copyKeyValue': {
        if (msg.id && msg.type) {
          const key = await this._vault.getKey(msg.id);
          if (!key) return;

          let value = key.value;
          if (msg.type === 'mnemonic') {
            value = key.metadata?.mnemonicWords || value;
          }

          await vsApi.env.clipboard.writeText(value);
          vsApi.window.showInformationMessage(`Copied ${msg.type} to clipboard`);
        }
        break;
      }

      case 'requestEditLabel': {
        if (msg.id && msg.currentLabel !== undefined) {
          const newLabel = await vsApi.window.showInputBox({
            prompt: 'Enter new label',
            value: msg.currentLabel,
          });
          if (newLabel && newLabel !== msg.currentLabel) {
            await this._vault.updateKeyLabel(msg.id, newLabel);
          }
        }
        break;
      }

      case 'updateLabel': {
        if (msg.id && msg.label !== undefined) {
          this._vault
            .updateKeyLabel(msg.id, msg.label)
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;
      }

      case 'generateRandomKey': {
        // Frontend sends this command with the selected key type
        if (msg.type) {
          await this.generateRandomKey(msg.type);
        }
        break;
      }

      case 'submitAddKey': {
        if (msg.type && msg.value !== undefined) {
          if (msg.type === 'vanity' || msg.type === 'vanity-testnet') {
            const prefix = sanitizeVanityPrefix(msg.vanityPrefix ?? '');
            if (!prefix) {
              vscode.window.showErrorMessage('Prefix is required for vanity keys.');
              return;
            }
            const result = await createVanityWIF(
              prefix,
              msg.type === 'vanity' ? 'mainnet' : 'testnet',
            );
            this._panel.webview.postMessage({ command: 'vanityGenerationCompleted' });
            this._panel.webview.postMessage({
              command: 'populateGeneratedKey',
              value: result.wif,
              finalType: 'wif',
            });
            vscode.window.showInformationMessage(
              `Generated ${msg.type === 'vanity' ? 'mainnet' : 'testnet'} vanity address ${result.address} after ${result.attempts} attempts`,
            );
            return;
          }

          // Store the key
          const keyId = await this._vault.storeKey({
            type: msg.type,
            value: msg.value,
            label: msg.label || 'Added Key',
            metadata: msg.metadata
          });

          // Handle advanced options
          if (msg.setAsWallet && msg.type === 'wif') {
            await this._vault.setFundingKey(keyId);
          }
          if (msg.setAsOrdinals && msg.type === 'wif') {
            await this._vault.setOrdinalsKey(keyId);
          }

          await this.updateContent();
        }
        break;
      }

      case 'deleteKey': {
        if (msg.id) this.deleteKey(msg.id);
        break;
      }

      case 'setEncryptionKey': {
        if (msg.id) {
          this._vault
            .setEncryptionKey(msg.id)
            .then(() => vsApi.window.showInformationMessage('Default encryption key set'))
            .finally(() => this.updateContent())
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;
      }

      // Copy commands
      case 'copyPrivate':
        if (msg.id) this.copyPrivate(msg.id);
        break;
      case 'copyPublic':
        if (msg.id) this.copyPublic(msg.id);
        break;
      case 'copyAddress':
        if (msg.id) this.copyAddress(msg.id);
        break;
      case 'copyTAddress':
        if (msg.id) this.copyTAddress(msg.id);
        break;
      case 'copyEntireKey':
        if (msg.id) this.copyEntireKey(msg.id);
        break;
      case 'copyHex':
        if (msg.id) this.copyHex(msg.id);
        break;
      case 'copyWif':
        if (msg.id) this.copyWif(msg.id);
        break;
      case 'copyXprv':
        if (msg.id) this.copyXprv(msg.id);
        break;
      case 'copyXpub':
        if (msg.id) this.copyXpub(msg.id);
        break;
      case 'copyPub':
        if (msg.id) this.copyPub(msg.id);
        break;
      case 'copyWords':
        if (msg.id) this.copyWords(msg.id);
        break;

      // Derivations
      case 'deriveAddress':
        if (msg.id) this.deriveAddressPrompt(msg.id);
        break;
      case 'type42Child':
        if (msg.id) this.type42Child(msg.id);
        break;
      case 'bip32Child':
        if (msg.id) this.bip32Child(msg.id);
        break;
      case 'publicChild':
        if (msg.id) this.createPublicChild(msg.id);
        break;

      case 'viewOnChain':
        if (msg.id) {
          const key = await this._vault.getKey(msg.id);
          if (!key) return;
          const address = deriveAddress(key);
          if (!address || address.startsWith('Invalid')) {
            vsApi.window.showErrorMessage('Could not derive a valid address for this key.');
            return;
          }

          const url = `https://whatsonchain.com/address/${address}`;
          await vsApi.env.openExternal(vsApi.Uri.parse(url));
        }
        break;

      case 'importBackup': {
        // Show file picker for both .bep and .json files
        const result = await vsApi.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            'Backup Files': ['bep', 'json']
          },
          title: 'Import Key Backup'
        });

        if (!result || result.length === 0) return;

        try {
          const fileContent = await vsApi.workspace.fs.readFile(result[0]);
          const contentString = fileContent.toString().trim();

          let decrypted: DecryptedBackup;

          // Check if content is encrypted (base64 string without JSON structure)
          const isEncrypted = !contentString.startsWith('{') && !contentString.startsWith('[');

          if (isEncrypted) {
            // Prompt for passphrase
            const passphrase = await vsApi.window.showInputBox({
              prompt: 'Enter passphrase to decrypt backup',
              password: true,
              placeHolder: 'Passphrase'
            });

            if (!passphrase) {
              vsApi.window.showWarningMessage('Import cancelled: passphrase required');
              return;
            }

            try {
              decrypted = await decryptBackup(contentString, passphrase);
            } catch (error) {
              throw new Error('Failed to decrypt backup. Invalid passphrase or corrupted file.');
            }
          } else {
            // Plain JSON backup
            try {
              decrypted = JSON.parse(contentString);
            } catch (error) {
              throw new Error('Invalid JSON backup file');
            }
          }

          // Process based on backup type
          const importedKeys: string[] = [];
          const importMetadata = {
            importedFrom: result[0].fsPath,
            importedAt: new Date().toISOString()
          };

          // Type 1: WifBackup - { wif, label?, createdAt? }
          if ('wif' in decrypted && !('id' in decrypted) && !('ordPk' in decrypted)) {
            const id = await this._vault.storeKey({
              type: 'wif',
              value: decrypted.wif,
              label: decrypted.label || 'Imported WIF Key',
              metadata: importMetadata
            });
            importedKeys.push(decrypted.label || 'WIF Key');
          }
          // Type 2: BapMemberBackup - { wif, id, label?, createdAt? }
          else if ('wif' in decrypted && 'id' in decrypted) {
            const id = await this._vault.storeKey({
              type: 'wif',
              value: decrypted.wif,
              label: decrypted.label || 'Imported BAP Member Key',
              metadata: {
                ...importMetadata,
                bapId: decrypted.id
              }
            });

            // Set as identity key
            await this._vault.setIdentityKey(id);
            importedKeys.push(decrypted.label || 'BAP Member Identity');
          }
          // Type 3: BapMasterBackup (Type 42) - { ids, rootPk, label?, createdAt? }
          else if ('ids' in decrypted && 'rootPk' in decrypted) {
            const id = await this._vault.storeKey({
              type: 'wif',
              value: decrypted.rootPk,
              label: decrypted.label || 'Imported BAP Master Key (Type 42)',
              metadata: {
                ...importMetadata,
                bapIds: decrypted.ids,
                backupType: 'type42'
              }
            });

            // Set as identity key
            await this._vault.setIdentityKey(id);
            importedKeys.push(decrypted.label || 'BAP Master (Type 42)');
          }
          // Type 4: BapMasterBackup (Legacy) - { ids, xprv, mnemonic, label?, createdAt? }
          else if ('ids' in decrypted && 'xprv' in decrypted && 'mnemonic' in decrypted) {
            // Store mnemonic (which generates xprv internally)
            const mnemonicId = await this._vault.storeKey({
              type: 'mnemonic',
              value: decrypted.mnemonic,
              label: decrypted.label || 'Imported BAP Master Key (Legacy)',
              metadata: {
                ...importMetadata,
                bapIds: decrypted.ids,
                backupType: 'legacy',
                mnemonicWords: decrypted.mnemonic
              }
            });

            // Derive master key from mnemonic and set as identity
            const mn = Mnemonic.fromString(decrypted.mnemonic);
            const hd = HD.fromSeed(mn.toSeed());
            if (hd.privKey) {
              const masterPk = PrivateKey.fromHex(hd.privKey.toString());
              const masterId = await this._vault.storeKey({
                type: 'wif',
                value: masterPk.toWif(),
                label: `${decrypted.label || 'BAP Master'} - Root Key`,
                metadata: {
                  ...importMetadata,
                  parentId: mnemonicId,
                  derivedFrom: 'mnemonic'
                }
              });

              await this._vault.setIdentityKey(masterId);
            }

            importedKeys.push(decrypted.label || 'BAP Master (Legacy)');
          }
          // Type 5: OneSatBackup - 3-field format { ordPk, payPk, identityPk, label?, createdAt? }
          else if ('ordPk' in decrypted && 'payPk' in decrypted && 'identityPk' in decrypted) {
            // Store ordinal key and set as ordinals key
            const ordId = await this._vault.storeKey({
              type: 'wif',
              value: decrypted.ordPk,
              label: `${decrypted.label || '1Sat'} - Ordinal Key`,
              metadata: {
                ...importMetadata,
                oneSatRole: 'ordinal'
              }
            });
            await this._vault.setOrdinalsKey(ordId);

            // Store payment key and set as wallet key
            const payId = await this._vault.storeKey({
              type: 'wif',
              value: decrypted.payPk,
              label: `${decrypted.label || '1Sat'} - Payment Key`,
              metadata: {
                ...importMetadata,
                oneSatRole: 'payment'
              }
            });
            await this._vault.setFundingKey(payId);

            // Store identity key and set as vault identity
            const identityId = await this._vault.storeKey({
              type: 'wif',
              value: decrypted.identityPk,
              label: `${decrypted.label || '1Sat'} - Identity Key`,
              metadata: {
                ...importMetadata,
                oneSatRole: 'identity'
              }
            });
            await this._vault.setIdentityKey(identityId);

            importedKeys.push(
              `${decrypted.label || '1Sat'} (3 keys: Ordinal, Payment, Identity)`
            );
          }
          // Type 6: 1Sat Backup (2-field format) - { ordPk, payPk, label?, createdAt? }
          // This is the actual format used by 1sat wallets (without identityPk)
          else if ('ordPk' in decrypted && 'payPk' in decrypted && !('identityPk' in decrypted)) {
            const oneSat = decrypted as Omit<OneSatBackup, 'identityPk'>;

            // Store ordinal key and set as ordinals key
            const ordId = await this._vault.storeKey({
              type: 'wif',
              value: oneSat.ordPk,
              label: `${oneSat.label || '1Sat'} - Ordinal Key`,
              metadata: {
                ...importMetadata,
                oneSatRole: 'ordinal'
              }
            });
            await this._vault.setOrdinalsKey(ordId);

            // Store payment key and set as wallet key
            const payId = await this._vault.storeKey({
              type: 'wif',
              value: oneSat.payPk,
              label: `${oneSat.label || '1Sat'} - Payment Key`,
              metadata: {
                ...importMetadata,
                oneSatRole: 'payment'
              }
            });
            await this._vault.setFundingKey(payId);

            importedKeys.push(
              `${oneSat.label || '1Sat'} (2 keys: Ordinal, Payment)`
            );
          }
          // Legacy format fallback - { derivedPrivateKey, name?, description? }
          else if ('derivedPrivateKey' in (decrypted as any)) {
            const legacy = decrypted as any;
            const id = await this._vault.storeKey({
              type: 'wif',
              value: legacy.derivedPrivateKey,
              label: legacy.name || legacy.description || 'Imported Legacy Key',
              metadata: {
                ...importMetadata,
                backupType: 'legacy-derivedPrivateKey'
              }
            });

            await this._vault.setIdentityKey(id);
            importedKeys.push(legacy.name || legacy.description || 'Legacy Key');
          }
          else {
            throw new Error('Unsupported backup format. Expected WifBackup, BapMemberBackup, BapMasterBackup, OneSatBackup, or legacy format.');
          }

          vsApi.window.showInformationMessage(
            `Successfully imported: ${importedKeys.join(', ')}`
          );
          await this.updateContent();
        } catch (error) {
          vsApi.window.showErrorMessage(
            `Failed to import backup: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }

      case 'setFundingKey': {
        if (!msg.id) break;
        await this._vault.setFundingKey(msg.id);
        await this.updateContent();
        break;
      }

      case 'clearFundingKey': {
        if (!msg.id) break;
        await this._vault.clearFundingKey();
        await this.updateContent();
        break;
      }

      case 'setOrdinalsKey': {
        if (!msg.id) break;
        await this._vault.setOrdinalsKey(msg.id);
        await this.updateContent();
        break;
      }

      case 'clearOrdinalsKey': {
        if (!msg.id) break;
        await this._vault.clearOrdinalsKey();
        await this.updateContent();
        break;
      }

      case 'setIdentityKey': {
        if (!msg.id) break;
        await this._vault.setIdentityKey(msg.id);
        await this.updateContent();
        break;
      }

      case 'clearIdentityKey': {
        if (!msg.id) break;
        await this._vault.clearIdentityKey();
        await this.updateContent();
        break;
      }

      case 'generateKeyShares': {
        if (!msg.id) break;
        
        const threshold = await vsApi.window.showInputBox({
          prompt: 'Enter the minimum number of shares required to reconstruct the key (threshold)',
          value: '2',
          validateInput: (value) => {
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num) || num < 2) {
              return 'Threshold must be at least 2';
            }
            return null;
          }
        });
        if (!threshold) return;
        
        const thresholdNum = Number.parseInt(threshold, 10);
        const defaultTotal = thresholdNum + 1; // Set default to threshold + 1
        
        const totalShares = await vsApi.window.showInputBox({
          prompt: 'Enter the total number of shares to generate',
          value: defaultTotal.toString(), // Use the calculated default
          validateInput: (value) => {
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num) || num < thresholdNum) {
              return `Total shares must be at least ${thresholdNum}`;
            }
            return null;
          }
        });
        if (!totalShares) return;
        
        try {
          const shares = await this._vault.generateKeyShares(
            msg.id, 
            thresholdNum, 
            Number.parseInt(totalShares, 10)
          );
          
          vsApi.window.showInformationMessage(
            `Generated ${shares.length} key shares (threshold: ${threshold})`
          );
          await this.updateContent();
        } catch (error) {
          vsApi.window.showErrorMessage(
            `Failed to generate key shares: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }

      case 'viewKeyShares': {
        if (!msg.id) break;
        
        const key = await this._vault.getKey(msg.id);
        if (!key || !key.keyShares || key.keyShares.length === 0) {
          vsApi.window.showErrorMessage('No key shares found for this key');
          return;
        }
        
        const options = key.keyShares.map((share, index) => ({
          label: `Share ${index + 1}`,
          description: `${share.substring(0, 20)}...`,
          share
        }));
        
        const selectedShare = await vsApi.window.showQuickPick(options, {
          placeHolder: 'Select a key share to copy',
          canPickMany: false
        });
        
        if (selectedShare) {
          await vsApi.env.clipboard.writeText(selectedShare.share);
          vsApi.window.showInformationMessage('Key share copied to clipboard');
        }
        break;
      }

      case 'reconstructFromKeyShares': {
        // Get the shares and label from the message
        const { shares, label } = msg;
        
        if (!shares || shares.length < 2) {
          vsApi.window.showErrorMessage('At least 2 key shares are required');
          return;
        }
        
        // Show a progress notification
        vsApi.window.withProgress({
          location: vsApi.ProgressLocation.Notification,
          title: 'Reconstructing private key from shares...',
          cancellable: false
        }, async () => {
          try {
            const wif = await this._vault.reconstructFromKeyShares(shares);
            
            await this._vault.storeKey({
              type: 'wif',
              value: wif,
              label: label || 'Reconstructed Key',
              metadata: {
                reconstructedAt: new Date().toISOString(),
                fromShares: shares.length.toString()
              }
            });
            
            vsApi.window.showInformationMessage(
              `Key successfully reconstructed from ${shares.length} shares and stored`
            );
            await this.updateContent();
          } catch (error) {
            vsApi.window.showErrorMessage(
              `Failed to reconstruct key: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        });
        
        break;
      }

      case 'openSharesModal': {
        // Send a message to the webview to open the shares modal
        this._panel.webview.postMessage({
          command: 'openSharesModal'
        });
        break;
      }
      
      case 'showError': {
        const { text } = msg;
        if (text) {
          vsApi.window.showErrorMessage(text);
        }
        break;
      }
    }
  }

  /**
   * Generate random key
   */
  private async generateRandomKey(type: KeyType) {
    try {
      if (type === 'vanity' || type === 'vanity-testnet') {
        const prefix = await vsApi.window.showInputBox({
          prompt: 'Enter desired prefix (1-5 base58 characters)',
          validateInput: (value) => {
            const sanitized = sanitizeVanityPrefix(value);
            if (sanitized.length !== value.length) {
              return 'Prefix can only contain base58 characters excluding 0, O, I, l';
            }
            if (!sanitized.length) {
              return 'Prefix is required';
            }
            if (sanitized.length > 5) {
              return 'Prefix must be 5 characters or fewer';
            }
            return null;
          },
        });

        if (!prefix) {
          vsApi.window.showWarningMessage('Vanity generation cancelled');
          return;
        }

        const sanitized = sanitizeVanityPrefix(prefix);
        if (!sanitized) {
          vsApi.window.showErrorMessage('Invalid prefix provided.');
          return;
        }

        this._panel.webview.postMessage({ command: 'vanityGenerationStarted' });
        try {
          const result = await createVanityWIF(
            sanitized,
            type === 'vanity' ? 'mainnet' : 'testnet',
          );

          this._panel.webview.postMessage({ command: 'vanityGenerationCompleted' });

          this._panel.webview.postMessage({
            command: 'populateGeneratedKey',
            value: result.wif,
            finalType: type,
          });

          vsApi.window.showInformationMessage(
            `Generated ${type === 'vanity' ? 'mainnet' : 'testnet'} vanity address ${result.address} after ${result.attempts} attempts`,
          );
        } catch (err) {
          this._panel.webview.postMessage({ command: 'vanityGenerationCompleted' });
          this._panel.webview.postMessage({
            command: 'populateGeneratedKey',
            value: '',
            finalType: type === 'vanity' ? 'vanity' : 'vanity-testnet',
          });
          vsApi.window.showErrorMessage(
            `Failed to generate vanity key: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return;
      }

      let val = '';
      let finalType = type;

      switch (type) {
        case 'wif':
        case 'encryption': {
          val = PrivateKey.fromRandom().toWif();
          break;
        }
        case 'hdprivate':
        case 'hdpublic': {
          const hd = HD.fromRandom();
          val = hd.toString();
          if (type === 'hdpublic') finalType = 'hdpublic';
          else finalType = 'hdprivate';
          break;
        }
        case 'mnemonic': {
          const mn = Mnemonic.fromRandom();
          val = mn.toString();
          break;
        }
        case 'private':
        case 'public': {
          const pk = PrivateKey.fromRandom();
          val = pk.toString();
          break;
        }
      }

      this._panel.webview.postMessage({
        command: 'populateGeneratedKey',
        value: val,
        finalType,
      });
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to generate random key: ${String(err)}`);
    }
  }

  /**
   * Add Key from modal
   */
  private async addKey(type: KeyType, value: string, label: string) {
    try {
      // If vault is locked, prompt for password
      if (!this._vault.isUnlocked) {
        const hasExistingVault = await this._vault.hasExistingVault();
        const password = await vsApi.window.showInputBox({
          prompt: hasExistingVault ? 'Enter vault password to unlock' : 'Set a password for your key vault',
          password: true,
          placeHolder: hasExistingVault ? undefined : 'Choose a strong password'
        });
        if (!password) return; // User cancelled
        
        try {
          await this._vault.unlockVault(password);
        } catch (err) {
          vsApi.window.showErrorMessage(String(err));
          return;
        }
      }

      let storeVal = value;
      const storeType = type;
      const meta: Record<string, string> = {};

      switch (type) {
        case 'wif':
        case 'encryption': {
          const pk = PrivateKey.fromWif(value);
          storeVal = pk.toWif();
          break;
        }
        case 'hdprivate':
        case 'hdpublic': {
          if (!value.startsWith('xprv')) {
            throw new Error('Invalid xprv (must start with xprv).');
          }
          HD.fromString(value);
          break;
        }
        case 'mnemonic': {
          const mn = Mnemonic.fromString(value);
          if (!mn.isValid()) {
            throw new Error('Invalid mnemonic phrase');
          }
          meta.mnemonicWords = mn.toString();
          const hd = HD.fromSeed(mn.toSeed());
          storeVal = hd.toString(); // xprv
          break;
        }
        case 'private':
        case 'public':
          throw new Error('Unsupported key type in modal. Use WIF instead.');
      }

      await this._vault.storeKey({
        type: storeType,
        value: storeVal,
        label,
        metadata: meta
      });

      vsApi.window.showInformationMessage('Key added successfully');
      this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to add key: ${String(err)}`);
    }
  }

  /**
   * Delete key + all descendants
   */
  private async deleteKey(id: string) {
    try {
      await this.deleteKeyAndDescendants(id);
      vsApi.window.showInformationMessage('Key & children deleted');
      this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Delete failed: ${String(err)}`);
    }
  }

  private async deleteKeyAndDescendants(id: string) {
    const toDelete = new Set<string>([id]);
    const queue = [id];

    while (queue.length > 0) {
      const cur = queue.pop();
      if (!cur) continue;
      const all = await this._vault.getAllKeys();
      for (let i = 0; i < all.length; i++) {
        const child = all[i];
        if (child.metadata?.parentId === cur) {
          if (!toDelete.has(child.id)) {
            toDelete.add(child.id);
            queue.push(child.id);
          }
        }
      }
    }
    for (const d of toDelete) {
      await this._vault.deleteKey(d);
    }
  }

  // -------------------------------------------------------------------------
  // Copy commands
  // -------------------------------------------------------------------------
  private async copyPrivate(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    await vsApi.env.clipboard.writeText(k.value);
    vsApi.window.showInformationMessage('Private key copied.');
  }
  private async copyPublic(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    const pub = derivePublicKeyString(k);
    if (!pub) {
      vsApi.window.showErrorMessage('Public key derivation failed');
      return;
    }
    await vsApi.env.clipboard.writeText(pub);
    vsApi.window.showInformationMessage('Public key copied.');
  }
  private async copyAddress(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    const addr = deriveAddress(k);
    await vsApi.env.clipboard.writeText(addr);
    vsApi.window.showInformationMessage(`Address ${addr} copied.`);
  }
  private async copyTAddress(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    const addr = deriveTestnetAddress(k);
    await vsApi.env.clipboard.writeText(addr);
    vsApi.window.showInformationMessage(`Testnet Address ${addr} copied.`);
  }
  private async copyEntireKey(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    await vsApi.env.clipboard.writeText(k.value);
    vsApi.window.showInformationMessage('Key copied.');
  }
  private async copyHex(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;

    if (k.type === 'public') {
      const pub = derivePublicKeyString(k);
      if (!pub) {
        vsApi.window.showErrorMessage('Public key hex derivation failed');
        return;
      }
      await vsApi.env.clipboard.writeText(pub);
      vsApi.window.showInformationMessage('HEX (public) copied');
    } else if (
      k.type === 'wif' ||
      k.type === 'encryption' ||
      k.type === 'private'
    ) {
      const pk = toPrivateKey(k);
      if (pk) {
        await vsApi.env.clipboard.writeText(pk.toString());
        vsApi.window.showInformationMessage('HEX (private) copied');
      }
    } else {
      vsApi.window.showErrorMessage('copyHex not valid for this type');
    }
  }
  private async copyWif(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;

    if (k.type === 'wif' || k.type === 'encryption') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('WIF copied.');
      return;
    }
    if (k.type === 'private' || k.type === 'public') {
      const pk = toPrivateKey(k);
      if (pk) {
        await vsApi.env.clipboard.writeText(pk.toWif());
        vsApi.window.showInformationMessage('WIF copied.');
      }
      return;
    }
    vsApi.window.showErrorMessage('copyWif not valid for this key type');
  }
  private async copyXprv(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type === 'hdprivate') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('XPRV copied');
    } else if (k.type === 'mnemonic') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('XPRV (mnemonic) copied');
    } else {
      vsApi.window.showErrorMessage('copyXprv not valid for this type');
    }
  }
  private async copyXpub(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type === 'hdpublic') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('XPUB copied');
      return;
    }
    if (k.type === 'hdprivate' || k.type === 'mnemonic') {
      const hd = HD.fromString(k.value);
      const xpub = hd.toPublic().toString();
      await vsApi.env.clipboard.writeText(xpub);
      vsApi.window.showInformationMessage('XPUB copied');
      return;
    }
    vsApi.window.showErrorMessage('copyXpub not valid for this type');
  }
  private async copyPub(id: string) {
    await this.copyHex(id);
  }
  private async copyWords(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type !== 'mnemonic') {
      vsApi.window.showErrorMessage('No mnemonic words for this key type');
      return;
    }
    const words = k.metadata?.mnemonicWords;
    if (!words) {
      vsApi.window.showErrorMessage('No stored mnemonic phrase');
      return;
    }
    await vsApi.env.clipboard.writeText(words);
    vsApi.window.showInformationMessage('Mnemonic words copied');
  }

  // -------------------------------------------------------------------------
  // Derive Address
  // -------------------------------------------------------------------------
  private async deriveAddressPrompt(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) return;

    if (key.type === 'hdprivate' || key.type === 'hdpublic') {
      const path = await vsApi.window.showInputBox({
        prompt: 'Enter bip32 path, e.g. m/0/0',
        value: 'm/0/0',
      });
      if (!path) return;

      const addr = deriveHdAddress(key, path);
      vsApi.window.showInformationMessage(`Derived address: ${addr}`);
    } else {
      const a = deriveAddress(key);
      vsApi.window.showInformationMessage(`Address: ${a}`);
    }
  }

  // -------------------------------------------------------------------------
  // Type42 child
  // -------------------------------------------------------------------------
  private async type42Child(id: string) {
    const parent = await this._vault.getKey(id);
    if (!parent) return;

    const otherPubStr = await vsApi.window.showInputBox({
      prompt: "Enter other party's compressed pubkey (66 hex)",
    });
    if (!otherPubStr) return;
    const invoice = await vsApi.window.showInputBox({
      prompt: 'Invoice number (any string)',
    });
    if (!invoice) return;

    const all = await this._vault.getAllKeys();
    for (let i = 0; i < all.length; i++) {
      const s = all[i];
      if (s.metadata?.parentId === id) {
        if (
          s.metadata?.type42OtherPub === otherPubStr &&
          s.metadata?.type42Invoice === invoice
        ) {
          vsApi.window.showWarningMessage(
            'Type42 child with same pub & invoice already exists',
          );
          return;
        }
      }
    }

    const priv = toPrivateKey(parent);
    if (!priv) {
      vsApi.window.showErrorMessage('Cannot do Type42 derivation on this key type');
      return;
    }
    const otherPub = PublicKey.fromString(otherPubStr);
    const child = priv.deriveChild(otherPub, invoice);
    const wif = child.toWif();

    await this._vault.storeKey({
      type: 'wif',
      value: wif,
      label: `Type42 child of ${parent.label ?? parent.type}`,
      metadata: {
        parentId: parent.id,
        type42OtherPub: otherPubStr,
        type42Invoice: invoice,
      },
    });
    vsApi.window.showInformationMessage('Type42 child created');
    this.updateContent();
  }

  // -------------------------------------------------------------------------
  // BIP32 child
  // -------------------------------------------------------------------------
  private async bip32Child(id: string) {
    const parent = await this._vault.getKey(id);
    if (!parent) return;

    const path = await vsApi.window.showInputBox({
      prompt: 'Enter bip32 path, e.g. m/0/0',
      value: 'm/0/0',
    });
    if (!path) return;

    const all = await this._vault.getAllKeys();
    for (let i = 0; i < all.length; i++) {
      const s = all[i];
      if (s.metadata?.parentId === id && s.metadata?.bip32Path === path) {
        vsApi.window.showWarningMessage(
          'A BIP32 child with that path already exists.',
        );
        return;
      }
    }

    if (
      parent.type !== 'hdprivate' &&
      parent.type !== 'hdpublic' &&
      parent.type !== 'mnemonic'
    ) {
      vsApi.window.showErrorMessage('BIP32 derivation only valid for HD or mnemonic keys');
      return;
    }
    const hd = HD.fromString(parent.value);
    const derived = hd.derive(path.replace(/'/g, 'h'));
    if (!derived.privKey) {
      vsApi.window.showErrorMessage('No private key at that path (maybe xpub only?)');
      return;
    }
    const pv = PrivateKey.fromHex(derived.privKey.toString());
    const wif = pv.toWif();

    await this._vault.storeKey({
      type: 'wif',
      value: wif,
      label: `BIP32 child of ${parent.label ?? parent.type}`,
      metadata: {
        parentId: parent.id,
        bip32Path: path,
      },
    });
    vsApi.window.showInformationMessage('BIP32 child created');
    this.updateContent();
  }

  // -------------------------------------------------------------------------
  // Create a "Public" child from single wif/private
  // -------------------------------------------------------------------------
  private async createPublicChild(id: string) {
    const parent = await this._vault.getKey(id);
    if (!parent) return;

    if (
      parent.type !== 'wif' &&
      parent.type !== 'private' &&
      parent.type !== 'encryption' &&
      parent.type !== 'public'
    ) {
      vsApi.window.showErrorMessage('Cannot create a public child from this key type');
      return;
    }

    // check if public child already exists
    const all = await this._vault.getAllKeys();
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      if (c.metadata?.parentId === parent.id && c.type === 'public') {
        vsApi.window.showWarningMessage('A public child already exists for this key');
        return;
      }
    }
    
    const pubKey = derivePublicKeyString(parent)
    if (!pubKey) {
      vsApi.window.showErrorMessage('Cannot derive public key from this key type');
      return;
    }
    await this._vault.storeKey({
      type: 'public',
      value: pubKey.toString(),
      label: `Public child of ${parent.label ?? parent.type}`,
      metadata: {
        parentId: parent.id,
      },
    });
    vsApi.window.showInformationMessage('Public key child created.');
    this.updateContent();
  }

  public dispose() {
    KeyPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length > 0) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}