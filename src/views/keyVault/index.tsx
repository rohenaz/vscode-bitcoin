// src/views/keyVault/index.tsx
// - Added "requestEditLabel" case to fix the prompt usage, relying on VS Code's showInputBox.

import vsApi, { type WebviewPanel, type Disposable } from '../../vsShim';
import type { KeyVault, KeyEntry, KeyType } from '../../keyVault';
import { PrivateKey, PublicKey, HD, Mnemonic } from '@bsv/sdk';
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

export class KeyPanel {
  public static currentPanel: KeyPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _vault: KeyVault;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel, vault: KeyVault) {
    this._panel = panel;
    this._vault = vault;

    // Initial render
    this.updateContent();

    // Cleanup
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg), null, this._disposables);

    // Re-render if vault changes
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
        },
      );
      KeyPanel.currentPanel = new KeyPanel(panel, vault);
    }
  }

  private async updateContent() {
    // Attempt to set default encryption key if none
    const all = await this._vault.getAllKeys();
    const encKey = await this._vault.getEncryptionKey();
    if (!encKey) {
      for (let i = 0; i < all.length; i++) {
        const k = all[i];
        if (
          (k.type === 'private' || k.type === 'wif' || k.type === 'encryption') &&
          !k.isEncryptionKey
        ) {
          await this._vault.setEncryptionKey(k.id);
          break;
        }
      }
    }

    // Build typed-HTML
    const refreshed = await this._vault.getAllKeys();
    const hierarchy = buildKeyHierarchy(refreshed);
    const elements = hierarchy.map((node) => renderKeyRecursive(node, 0));

    // Final HTML
    const nonce = getNonce();
    const cspSource = this._panel.webview.cspSource;
    const allKeysJson = JSON.stringify(refreshed);
    const script = getPanelScript(allKeysJson);

    this._panel.webview.html = getPanelHtml({
      nonce,
      cspSource,
      keyElements: elements,
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
  }) {
    switch (msg.command) {
      /** Replacing the old "editLabel" with "requestEditLabel" => showInputBox => update label. */
      case 'requestEditLabel':
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

      // The old 'updateLabel' command (if used externally)
      case 'updateLabel':
        if (msg.id && msg.label !== undefined) {
          this._vault.updateKeyLabel(msg.id, msg.label).catch((err) =>
            vsApi.window.showErrorMessage(String(err)),
          );
        }
        break;

      // ---------------------------------------------------------------------
      // The rest of your commands remain unchanged
      // ---------------------------------------------------------------------
      case 'generateRandomKey':
        if (msg.type) this.generateRandomKey(msg.type);
        break;

      case 'submitAddKey':
        if (msg.type && msg.value !== undefined) {
          this.addKey(msg.type, msg.value, msg.label ?? 'Imported Key');
        }
        break;

      case 'deleteKey':
        if (msg.id) this.deleteKey(msg.id);
        break;

      case 'setEncryptionKey':
        if (msg.id) {
          this._vault
            .setEncryptionKey(msg.id)
            .then(() => vsApi.window.showInformationMessage('Default encryption key set'))
            .finally(() => this.updateContent())
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;

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
    }
  }

  // -------------------------------------------------------------------------
  // The rest is unchanged
  // -------------------------------------------------------------------------
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

  private async addKey(type: KeyType, value: string, label: string) {
    try {
      let storeVal = value;
      const storeType: KeyType = type;
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
        case 'public': {
          throw new Error('Unsupported key type in modal. Use WIF instead.');
        }
      }

      await this._vault.storeKey({
        type: storeType,
        value: storeVal,
        label,
        metadata: meta,
      });

      vsApi.window.showInformationMessage('Key added successfully');
      this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to add key: ${String(err)}`);
    }
  }

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
    while (queue.length) {
      const cur = queue.pop();
      if (!cur) continue;
      const kids = await this._vault
        .getAllKeys()
        .then((arr) => arr.filter((c) => c.metadata?.parentId === cur));
      for (let i = 0; i < kids.length; i++) {
        const ch = kids[i];
        if (!toDelete.has(ch.id)) {
          toDelete.add(ch.id);
          queue.push(ch.id);
        }
      }
    }
    for (const d of toDelete) {
      await this._vault.deleteKey(d);
    }
  }

  // Copy commands:
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
    await vsApi.env.clipboard.writeText(pub);
    vsApi.window.showInformationMessage('Public key copied.');
  }
  private async copyAddress(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    const addr = deriveAddress(k);
    await vsApi.env.clipboard.writeText(addr);
    vsApi.window.showInformationMessage('Address copied.');
  }
  private async copyEntireKey(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    await vsApi.env.clipboard.writeText(k.value);
    vsApi.window.showInformationMessage('Full key copied.');
  }
  private async copyHex(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type === 'public') {
      const pub = derivePublicKeyString(k);
      await vsApi.env.clipboard.writeText(pub);
      vsApi.window.showInformationMessage('HEX (public) copied');
      return;
    }
    if (k.type === 'wif' || k.type === 'encryption') {
      const pk = PrivateKey.fromWif(k.value);
      await vsApi.env.clipboard.writeText(pk.toString());
      vsApi.window.showInformationMessage('HEX (private) copied');
      return;
    }
    vsApi.window.showErrorMessage('copyHex not valid for this type');
  }
  private async copyWif(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type === 'wif' || k.type === 'encryption') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('WIF copied.');
      return;
    }
    if (k.type === 'public') {
      const pk = PrivateKey.fromString(k.value);
      await vsApi.env.clipboard.writeText(pk.toWif());
      vsApi.window.showInformationMessage('WIF (from public) copied');
      return;
    }
    vsApi.window.showErrorMessage('copyWif not valid for this type');
  }
  private async copyXprv(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type === 'hdprivate') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('XPRV copied');
      return;
    }
    if (k.type === 'mnemonic') {
      await vsApi.env.clipboard.writeText(k.value);
      vsApi.window.showInformationMessage('XPRV (mnemonic) copied');
      return;
    }
    vsApi.window.showErrorMessage('copyXprv not valid for this type');
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

  // Derivations
  private async deriveAddressPrompt(id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;
    if (k.type === 'hdprivate' || k.type === 'hdpublic') {
      const path = await vsApi.window.showInputBox({
        prompt: 'Enter bip32 path, e.g. m/0/0',
        value: 'm/0/0',
      });
      if (!path) return;
      const addr = deriveHdAddress(k, path);
      vsApi.window.showInformationMessage(`Derived address: ${addr}`);
    } else {
      const addr = deriveAddress(k);
      vsApi.window.showInformationMessage(`Address: ${addr}`);
    }
  }

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
    const siblings = all.filter((x) => x.metadata?.parentId === id);
    for (let i = 0; i < siblings.length; i++) {
      const s = siblings[i];
      if (
        s.metadata?.type42OtherPub === otherPubStr &&
        s.metadata?.type42Invoice === invoice
      ) {
        vsApi.window.showWarningMessage('Type42 child with same pub & invoice already exists');
        return;
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

  private async bip32Child(id: string) {
    const parent = await this._vault.getKey(id);
    if (!parent) return;
    const path = await vsApi.window.showInputBox({
      prompt: 'Enter bip32 path, e.g. m/0/0',
      value: 'm/0/0',
    });
    if (!path) return;

    const all = await this._vault.getAllKeys();
    const siblings = all.filter((x) => x.metadata?.parentId === id);
    for (let i = 0; i < siblings.length; i++) {
      const s = siblings[i];
      if (s.metadata?.bip32Path === path) {
        vsApi.window.showWarningMessage('A BIP32 child with that path already exists');
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
    const derived = hd.derive(path);
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

  private async createPublicChild(id: string) {
    const parent = await this._vault.getKey(id);
    if (!parent) return;
    if (
      parent.type !== 'wif' &&
      parent.type !== 'private' &&
      parent.type !== 'encryption' &&
      parent.type !== 'public'
    ) {
      vsApi.window.showErrorMessage('Cannot create public child from this key type');
      return;
    }
    let privHex = '';
    if (parent.type === 'wif' || parent.type === 'encryption') {
      const pk = PrivateKey.fromWif(parent.value);
      privHex = pk.toString();
    } else {
      privHex = parent.value;
    }

    await this._vault.storeKey({
      type: 'public',
      value: privHex,
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
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < 16; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}