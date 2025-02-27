import vsApi, { type WebviewPanel, type Disposable } from '../../vsShim';
import type { KeyVault, KeyEntry, KeyType } from '../../keyVault';
import { PrivateKey, PublicKey, HD, Mnemonic, Utils } from '@bsv/sdk';
import { keyPanelStyles } from './styles';
import {
  buildKeyHierarchy,
  renderKeyRecursive,
  derivePublicKeyString,
  deriveAddress,
  deriveHdAddress,
  toPrivateKey,
} from './render';
import { getPanelHtml } from './layout';
import { getPanelScript } from './script';
import * as vscode from 'vscode';
import { P2PKH } from '@bsv/sdk';

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
        if (addr) {
          tokens.push(addr.toLowerCase());
          const { data } = Utils.fromBase58Check(addr) as { data: number[] };
          const pubKeyHashHex = Utils.toHex(data).toLowerCase();
          tokens.push(pubKeyHashHex);
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
    if (addr) {
      tokens.push(addr.toLowerCase());
      const { data } = Utils.fromBase58Check(addr);
      const dataArray = typeof data === 'string' ? data.split('').map(c => c.charCodeAt(0)) : data;
      const pubKeyHashHex = Utils.toHex(dataArray).toLowerCase();
      tokens.push(pubKeyHashHex);
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
  private _disposables: Disposable[] = [];

  private lastKeyHash?: string;
  private ephemeralIndex: Record<string, string[]> = {};

  private constructor(panel: WebviewPanel, vault: KeyVault) {
    this._panel = panel;
    this._vault = vault;

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

  public static async show(vault: KeyVault) {
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
      KeyPanel.currentPanel = new KeyPanel(panel, vault);
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
      console.log('Keys changed, rebuilding search index...');
      console.log('Keys:', refreshed);
      
      this.lastKeyHash = newHash;
      const idx: Record<string, string[]> = {};
      for (let i = 0; i < refreshed.length; i++) {
        const key = refreshed[i];
        console.log(`\nBuilding search tokens for key ${key.id}:`);
        console.log('Key:', key);
        
        const tokens = buildSearchTokens(key);
        console.log('Generated tokens:', tokens);
        
        idx[key.id] = tokens;
      }
      this.ephemeralIndex = idx;
      console.log('\nFull search index:', this.ephemeralIndex);
    }

    // Build hierarchy
    const hierarchy = buildKeyHierarchy(refreshed);
    const cards = hierarchy.map((node) => renderKeyRecursive(node, 0));

    // Prepare for webview
    const payload = {
      keys: refreshed,
      searchIndex: this.ephemeralIndex,
    };

    const nonce = getNonce();
    const cspSource = this._panel.webview.cspSource;
    
    // Create a safe version of the payload for the script
    const safePayload = JSON.stringify(payload);
    
    const script = getPanelScript(safePayload);

    this._panel.webview.html = getPanelHtml({
      nonce,
      cspSource,
      keyElements: cards,
      script,
      styles: keyPanelStyles,
    });
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
        if (msg.type) this.generateRandomKey(msg.type);
        break;
      }

      case 'submitAddKey': {
        if (msg.type && msg.value !== undefined) {
          this.addKey(msg.type, msg.value, msg.label ?? 'Imported Key');
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

      case 'p2pkhScript':
        if (msg.id) {
          const key = await this._vault.getKey(msg.id);
          if (!key) return;
          
          const address = deriveAddress(key);
          if (!address) {
            vsApi.window.showErrorMessage('Could not derive address');
            return;
          }

          const script = new P2PKH().lock(address);
          await vsApi.env.clipboard.writeText(script.toASM());
          vsApi.window.showInformationMessage('P2PKH script copied to clipboard');
        }
        break;

      case 'viewOnChain':
        if (msg.id) {
          const key = await this._vault.getKey(msg.id);
          if (!key) return;

          const address = deriveAddress(key);
          if (!address) {
            vsApi.window.showErrorMessage('Could not derive address');
            return;
          }

          const url = `https://whatsonchain.com/address/${address}`;
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;

      case 'importBackup': {
        // Show file picker for JSON files
        const result = await vsApi.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            'JSON Files': ['json']
          },
          title: 'Import Identity Key Backup'
        });

        if (!result || result.length === 0) return;

        try {
          const fileContent = await vsApi.workspace.fs.readFile(result[0]);
          const backup = JSON.parse(fileContent.toString());

          if (!backup.derivedPrivateKey) {
            throw new Error('Invalid backup file: missing derivedPrivateKey');
          }

          // Store the key
          const id = await this._vault.storeKey({
            type: 'wif',
            value: backup.derivedPrivateKey,
            label: backup.name || backup.description || 'Imported Identity Key',
            metadata: {
              importedFrom: result[0].fsPath,
              importedAt: new Date().toISOString()
            }
          });

          // Set as identity key
          await this._vault.setIdentityKey(id);

          vsApi.window.showInformationMessage('Identity key imported successfully');
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