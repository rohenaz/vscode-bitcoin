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
import * as vscode from 'vscode';
import { P2PKH } from '@bsv/sdk';

/**
 * Build ephemeral search tokens for a single KeyEntry,
 * including derived addresses, WIF, xpub, etc.
 */
function buildSearchTokens(k: KeyEntry): string[] {
  const out: string[] = [];

  // Always label, type, raw value
  out.push((k.label || '').toLowerCase());
  out.push(k.type.toLowerCase());
  out.push(k.value.toLowerCase());

  try {
    if (
      k.type === 'private' ||
      k.type === 'wif' ||
      k.type === 'encryption' ||
      k.type === 'public'
    ) {
      const priv = toPrivateKey(k);
      if (priv) {
        out.push(priv.toWif().toLowerCase());
        out.push(priv.toAddress().toString().toLowerCase());
        out.push(priv.toPublicKey().toString().toLowerCase());
      }
    } else if (k.type === 'hdprivate') {
      const hd = HD.fromString(k.value);
      if (hd.privKey) {
        const p = PrivateKey.fromHex(hd.privKey.toString());
        out.push(p.toWif().toLowerCase());
        out.push(p.toAddress().toString().toLowerCase());
      }
      // xpub
      out.push(hd.toPublic().toString().toLowerCase());
    } else if (k.type === 'hdpublic') {
      const hdpub = HD.fromString(k.value).toPublic();
      out.push(hdpub.toString().toLowerCase());
      out.push(hdpub.pubKey.toAddress().toString().toLowerCase());
    } else if (k.type === 'mnemonic') {
      // actual phrase
      out.push(k.value.toLowerCase());
      // parse xprv
      const hd = HD.fromString(k.value);
      out.push(hd.toPublic().toString().toLowerCase());
      if (hd.privKey) {
        const p = PrivateKey.fromHex(hd.privKey.toString());
        out.push(p.toWif().toLowerCase());
        out.push(p.toAddress().toString().toLowerCase());
      }
    }
  } catch {
    // ignore derivation errors
  }

  // Remove duplicates or empty strings
  const uniq = new Set<string>();
  for (let i = 0; i < out.length; i++) {
    const t = out[i].trim();
    if (t) uniq.add(t);
  }
  return Array.from(uniq);
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
      this.lastKeyHash = newHash;
      const idx: Record<string, string[]> = {};
      for (let i = 0; i < refreshed.length; i++) {
        idx[refreshed[i].id] = buildSearchTokens(refreshed[i]);
      }
      this.ephemeralIndex = idx;
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
    const script = getPanelScript(JSON.stringify(payload));

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

      case 'p2pkh':
        if (msg.type === 'public' && msg.value) {
          const pubKey = PublicKey.fromString(msg.value);
          const p2pkh = new P2PKH();
          const script = p2pkh.lock(pubKey.toString());
          await vsApi.env.clipboard.writeText(script.toASM());
          vsApi.window.showInformationMessage('P2PKH script copied to clipboard');
        }
        break;

      case 'woc':
        if (msg.type === 'public' && msg.value) {
          const pubKey = PublicKey.fromString(msg.value);
          const p2pkh = new P2PKH();
          const script = p2pkh.lock(pubKey.toString());
          const address = pubKey.toAddress().toString();
          const url = `https://whatsonchain.com/address/${address}`;
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
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