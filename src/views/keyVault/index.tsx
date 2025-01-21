// src/views/keyVault/index.tsx
// Main KeyPanel entry point. Manages the WebviewPanel, handles incoming messages
// from script.ts, and orchestrates the KeyVault updates.

import vsApi, { type WebviewPanel, type Disposable } from '../../vsShim';
import type { KeyVault, KeyEntry, KeyType } from '../../keyVault';
import { PrivateKey, PublicKey, HD, Mnemonic } from '@bsv/sdk';
import { keyPanelStyles } from './styles';

// We import typed-HTML subcomponents from render.tsx
import {
  buildKeyHierarchy,
  renderKeyRecursive,
  deriveAddress,
  deriveHdAddress,
  derivePublicKeyString,
  toPrivateKey
} from './render';

// We import getPanelHtml for the layout
import { getPanelHtml } from './layout';
// We import getPanelScript for the front-end script
import { getPanelScript } from './script';

export class KeyPanel {
  public static currentPanel: KeyPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _vault: KeyVault;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel, vault: KeyVault) {
    this._panel = panel;
    this._vault = vault;

    // Render initial content
    this.updateContent();

    // Clean up when panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview script
    this._panel.webview.onDidReceiveMessage((message) => this.handleMessage(message),
      null,
      this._disposables
    );

    // Re-render if the vault changes
    this._vault.onDidChangeKeys(() => this.updateContent());
  }

  public static show(vault: KeyVault) {
    if (KeyPanel.currentPanel) {
      KeyPanel.currentPanel._panel.reveal(1);
    } else {
      const panel = vsApi.window.createWebviewPanel(
        'bitcoinKeyVault',
        'Bitcoin Key Vault',
        1,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );
      KeyPanel.currentPanel = new KeyPanel(panel, vault);
    }
  }

  private async updateContent() {
    const allKeys = await this._vault.getAllKeys();

    // Attempt to set a default encryption key if not set
    const enc = await this._vault.getEncryptionKey();
    if (!enc) {
      const singlePriv = allKeys.find(
        (k) =>
          (k.type === 'private' || k.type === 'wif' || k.type === 'encryption')
          && !k.isEncryptionKey
      );
      if (singlePriv) {
        await this._vault.setEncryptionKey(singlePriv.id);
      }
    }

    const refreshed = await this._vault.getAllKeys();
    const hierarchy = buildKeyHierarchy(refreshed);

    const nonce = getNonce();
    const cspSource = this._panel.webview.cspSource;

    // Render typed HTML for each root item
    const keyElements = hierarchy.map((node) => renderKeyRecursive(node, 0));

    // Generate front-end script
    const allKeysJson = JSON.stringify(refreshed);
    const script = getPanelScript(allKeysJson);

    // Build the final HTML
    this._panel.webview.html = getPanelHtml({
      nonce,
      cspSource,
      keyElements,
      script,
      styles: keyPanelStyles
    });
  }

  private async handleMessage(msg: {
    command: string;
    id?: string;
    label?: string;
    type?: KeyType;
    value?: string; // optional key data from script
  }) {
    switch (msg.command) {
      case 'generateRandomKey':
        if (msg.type) {
          this.generateRandomKey(msg.type).catch((err) => {
            vsApi.window.showErrorMessage(String(err));
          });
        }
        break;

      case 'submitAddKey':
        if (msg.type && msg.value !== undefined) {
          this.addKey(msg.type, msg.value, msg.label ?? 'Imported Key')
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;

      case 'deleteKey':
        if (msg.id) {
          this.deleteKey(msg.id);
        }
        break;

      case 'updateLabel':
        if (msg.id && msg.label !== undefined) {
          this._vault.updateKeyLabel(msg.id, msg.label)
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;

      case 'setEncryptionKey':
        if (msg.id) {
          this._vault
            .setEncryptionKey(msg.id)
            .then(() =>
              vsApi.window.showInformationMessage('Default encryption key set')
            )
            .finally(() => this.updateContent())
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;

      case 'copyPrivate':
        if (msg.id) await this.copyPrivate(msg.id);
        break;
      case 'copyPublic':
        if (msg.id) await this.copyPublic(msg.id);
        break;
      case 'copyAddress':
        if (msg.id) await this.copyAddress(msg.id);
        break;

      case 'deriveAddress':
        if (msg.id) await this.deriveAddressPrompt(msg.id);
        break;
      case 'type42Child':
        if (msg.id) await this.type42Child(msg.id);
        break;

      // "copyEntireKey" if script calls it
      case 'copyEntireKey':
        if (msg.id) await this.copyEntireKey(msg.id);
        break;
    }
  }

  // ----------------------------------------------------------------
  // Implementation details for each command
  // ----------------------------------------------------------------

  private async generateRandomKey(type: KeyType) {
    try {
      let generatedValue = '';
      let finalType: KeyType = type;

      switch (type) {
        case 'private':
        case 'public': {
          const priv = PrivateKey.fromRandom();
          generatedValue = priv.toString(); // hex
          if (type === 'public') {
            finalType = 'public';
          } else {
            finalType = 'private';
          }
          break;
        }
        case 'wif':
        case 'encryption': {
          generatedValue = PrivateKey.fromRandom().toWif();
          break;
        }
        case 'hdprivate':
        case 'hdpublic': {
          const hdPriv = HD.fromRandom();
          generatedValue = hdPriv.toString();
          if (type === 'hdpublic') {
            finalType = 'hdpublic';
          } else {
            finalType = 'hdprivate';
          }
          break;
        }
        case 'mnemonic': {
          const mn = Mnemonic.fromRandom();
          generatedValue = mn.toString();
          break;
        }
      }

      this._panel.webview.postMessage({
        command: 'populateGeneratedKey',
        value: generatedValue,
        finalType
      });
    } catch (error) {
      throw new Error(`Failed to generate random key: ${String(error)}`);
    }
  }

  private async addKey(type: KeyType, value: string, label: string) {
    let storeValue = value;
    let storeType: KeyType = type;

    switch (type) {
      case 'private':
      case 'public': {
        // must be 64 hex
        if (!/^[0-9A-Fa-f]{64}$/.test(value)) {
          throw new Error('Invalid private key hex (64 chars).');
        }
        PrivateKey.fromString(value); // confirm parse
        break;
      }
      case 'wif':
      case 'encryption': {
        const priv = PrivateKey.fromWif(value);
        storeValue = priv.toWif();
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
          throw new Error('Invalid mnemonic phrase.');
        }
        // store xprv
        const hdPriv = HD.fromSeed(mn.toSeed());
        storeValue = hdPriv.toString();
        storeType = 'hdprivate';
        break;
      }
    }

    await this._vault.storeKey({
      type: storeType,
      value: storeValue,
      label
    });

    vsApi.window.showInformationMessage('Key added successfully.');
    this.updateContent();
  }

  private async deleteKey(id: string) {
    try {
      await this.deleteKeyAndDescendants(id);
      vsApi.window.showInformationMessage('Key (and children) deleted.');
      this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Delete failed: ${String(err)}`);
    }
  }

  private async deleteKeyAndDescendants(id: string) {
    const toDelete = new Set([id]);
    const queue = [id];
    while (queue.length) {
      const current = queue.pop();
      if (!current) continue;
      const kids = await this._vault.getAllKeys().then(keys =>
        keys.filter(k => k.metadata?.parentId === current)
      );
      for (const child of kids) {
        if (!toDelete.has(child.id)) {
          toDelete.add(child.id);
          queue.push(child.id);
        }
      }
    }
    for (const delId of toDelete) {
      await this._vault.deleteKey(delId);
    }
  }

  private async copyPrivate(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) throw new Error('Key not found');
    await vsApi.env.clipboard.writeText(key.value);
    vsApi.window.showInformationMessage('Private key copied.');
  }

  private async copyPublic(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) throw new Error('Key not found');
    const pubKey = derivePublicKeyString(key);
    await vsApi.env.clipboard.writeText(pubKey);
    vsApi.window.showInformationMessage('Public key copied.');
  }

  private async copyAddress(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) throw new Error('Key not found');
    const addr = deriveAddress(key);
    await vsApi.env.clipboard.writeText(addr);
    vsApi.window.showInformationMessage('Address copied.');
  }

  private async copyEntireKey(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) throw new Error('Key not found');
    await vsApi.env.clipboard.writeText(key.value);
    vsApi.window.showInformationMessage('Full key copied.');
  }

  private async deriveAddressPrompt(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) throw new Error('Key not found');

    if (key.type === 'hdprivate' || key.type === 'hdpublic') {
      const path = await vsApi.window.showInputBox({
        prompt: 'Enter HD path, e.g. m/0/0',
        value: 'm/0/0'
      });
      if (!path) return;
      const newAddr = deriveHdAddress(key, path);
      vsApi.window.showInformationMessage(`Derived address: ${newAddr}`);
    } else {
      const newAddr = deriveAddress(key);
      vsApi.window.showInformationMessage(`Address: ${newAddr}`);
    }
  }

  private async type42Child(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) throw new Error('Key not found');

    const otherPubStr = await vsApi.window.showInputBox({
      prompt: "Enter other's compressed pubkey (66 hex, starting 02/03)"
    });
    if (!otherPubStr) return;
    if (!otherPubStr.startsWith('02') && !otherPubStr.startsWith('03')) {
      vsApi.window.showErrorMessage('Invalid pubkey. Must start with 02 or 03.');
      return;
    }
    if (otherPubStr.length !== 66) {
      vsApi.window.showErrorMessage('Invalid length. Must be 66 hex chars.');
      return;
    }

    const invoice = await vsApi.window.showInputBox({
      prompt: 'Invoice number (any string).'
    });
    if (!invoice) return;

    const priv = toPrivateKey(key);
    if (!priv) {
      vsApi.window.showErrorMessage('Cannot perform Type42 on this key.');
      return;
    }
    const otherPub = PublicKey.fromString(otherPubStr);
    const child = priv.deriveChild(otherPub, invoice);
    const wif = child.toWif();

    const childLabel = `Type42 child of ${key.label ?? key.type}`;
    await this._vault.storeKey({
      type: 'wif',
      value: wif,
      label: childLabel,
      metadata: { parentId: id }
    });
    vsApi.window.showInformationMessage('Type42 child derived & stored.');
    this.updateContent();
  }

  public dispose() {
    KeyPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

// Helper for CSP nonce
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}