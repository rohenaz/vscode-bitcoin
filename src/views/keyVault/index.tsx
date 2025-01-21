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

/**
 * Helper for creating a mnemonic KeyEntry that
 *  - .value is the user’s phrase
 *  - .metadata.xprv is the derived xprv
 */
function createMnemonicEntry(phrase: string, label: string) {
  const mn = Mnemonic.fromString(phrase);
  if (!mn.isValid()) {
    throw new Error('Invalid mnemonic phrase');
  }
  const hd = HD.fromSeed(mn.toSeed());
  const xprv = hd.toString(); // derived xprv
  // Return everything needed to store
  return {
    type: 'mnemonic' as const,
    value: phrase,
    label,
    metadata: { xprv },
  };
}

export class KeyPanel {
  public static currentPanel: KeyPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _vault: KeyVault;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel, vault: KeyVault) {
    this._panel = panel;
    this._vault = vault;

    void this.updateContent();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg) => void this.handleMessage(msg),
      null,
      this._disposables,
    );
    this._vault.onDidChangeKeys(() => {
      void this.updateContent();
    });
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
    // Attempt default encryption key
    const all = await this._vault.getAllKeys();
    const enc = await this._vault.getEncryptionKey();
    if (!enc) {
      for (const k of all) {
        if (
          (k.type === 'private' ||
            k.type === 'wif' ||
            k.type === 'encryption') &&
          !k.isEncryptionKey
        ) {
          await this._vault.setEncryptionKey(k.id);
          break;
        }
      }
    }

    const refreshed = await this._vault.getAllKeys();
    const hierarchy = buildKeyHierarchy(refreshed);

    const elements = [];
    for (let i = 0; i < hierarchy.length; i++) {
      elements.push(renderKeyRecursive(hierarchy[i], 0));
    }

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
  }) {
    switch (msg.command) {
      case 'generateRandomKey': {
        if (msg.type) {
          await this.generateRandomKey(msg.type);
        }
        break;
      }
      case 'submitAddKey': {
        if (msg.type && msg.value !== undefined) {
          await this.addKey(msg.type, msg.value, msg.label ?? 'Imported Key');
        }
        break;
      }
      case 'deleteKey': {
        if (msg.id) {
          await this.deleteKey(msg.id);
        }
        break;
      }
      case 'updateLabel': {
        if (msg.id && msg.label !== undefined) {
          try {
            await this._vault.updateKeyLabel(msg.id, msg.label);
          } catch (err) {
            vsApi.window.showErrorMessage(String(err));
          }
        }
        break;
      }
      case 'setEncryptionKey': {
        if (msg.id) {
          try {
            await this._vault.setEncryptionKey(msg.id);
            vsApi.window.showInformationMessage('Default encryption key set');
          } catch (err) {
            vsApi.window.showErrorMessage(String(err));
          } finally {
            await this.updateContent();
          }
        }
        break;
      }
      case 'copyPrivate':
      case 'copyPublic':
      case 'copyAddress':
      case 'copyEntireKey':
      case 'copyHex':
      case 'copyWif':
      case 'copyXprv':
      case 'copyXpub':
      case 'copyPub':
      case 'copyWords': {
        if (msg.id) {
          await this.handleCopyCommand(msg.command, msg.id);
        }
        break;
      }
      case 'deriveAddress': {
        if (msg.id) {
          await this.deriveAddressPrompt(msg.id);
        }
        break;
      }
      case 'type42Child': {
        if (msg.id) {
          await this.type42Child(msg.id);
        }
        break;
      }
      case 'bip32Child': {
        if (msg.id) {
          await this.bip32Child(msg.id);
        }
        break;
      }
      case 'publicChild': {
        if (msg.id) {
          await this.createPublicChild(msg.id);
        }
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Generate random
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
          // Just generate the BIP39 words
          const mn = Mnemonic.fromRandom();
          val = mn.toString();
          break;
        }
        // Not offered in the modal now:
        case 'private':
        case 'public': {
          const pk = PrivateKey.fromRandom();
          val = pk.toString();
          break;
        }
      }

      // Put the generated result into the modal
      this._panel.webview.postMessage({
        command: 'populateGeneratedKey',
        value: val,
        finalType,
      });
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to generate random key: ${String(err)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Add Key
  // -------------------------------------------------------------------------
  private async addKey(type: KeyType, value: string, label: string) {
    try {
      // If user typed a mnemonic, unify logic with createMnemonicEntry
      if (type === 'mnemonic') {
        const entry = createMnemonicEntry(value, label);
        await this._vault.storeKey(entry);
      } else if (type === 'wif' || type === 'encryption') {
        // parse as WIF => store WIF
        const pk = PrivateKey.fromWif(value);
        await this._vault.storeKey({
          type,
          value: pk.toWif(),
          label,
        });
      } else if (type === 'hdprivate' || type === 'hdpublic') {
        if (!value.startsWith('xprv')) {
          throw new Error('Invalid xprv (must start with xprv).');
        }
        // confirm parse
        HD.fromString(value);
        await this._vault.storeKey({
          type,
          value,
          label,
        });
      } else {
        throw new Error('Unsupported key type in modal. Use WIF or HD or Mnemonic.');
      }

      vsApi.window.showInformationMessage('Key added successfully');
      await this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to add key: ${String(err)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  private async deleteKey(id: string) {
    try {
      await this.deleteKeyAndDescendants(id);
      vsApi.window.showInformationMessage('Key & children deleted');
      await this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Delete failed: ${String(err)}`);
    }
  }

  private async deleteKeyAndDescendants(id: string) {
    const toDelete = new Set<string>();
    toDelete.add(id);

    const queue = [id];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      const kids = await this._vault.getAllKeys().then((arr) => {
        const children = [];
        for (let j = 0; j < arr.length; j++) {
          const c = arr[j];
          if (c.metadata?.parentId === cur) {
            children.push(c);
          }
        }
        return children;
      });
      for (let j = 0; j < kids.length; j++) {
        const ch = kids[j];
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

  // -------------------------------------------------------------------------
  // Handle all copy commands
  // -------------------------------------------------------------------------
  private async handleCopyCommand(cmd: string, id: string) {
    const k = await this._vault.getKey(id);
    if (!k) return;

    switch (cmd) {
      case 'copyPrivate':
        await vsApi.env.clipboard.writeText(k.value);
        vsApi.window.showInformationMessage('Private key copied.');
        break;
      case 'copyPublic': {
        const pub = derivePublicKeyString(k);
        await vsApi.env.clipboard.writeText(pub);
        vsApi.window.showInformationMessage('Public key copied.');
        break;
      }
      case 'copyAddress': {
        const addr = deriveAddress(k);
        await vsApi.env.clipboard.writeText(addr);
        vsApi.window.showInformationMessage('Address copied.');
        break;
      }
      case 'copyEntireKey': {
        await vsApi.env.clipboard.writeText(k.value);
        vsApi.window.showInformationMessage('Full key copied.');
        break;
      }
      case 'copyHex': {
        // For 'public', derive pubkey
        if (k.type === 'public') {
          const pub = derivePublicKeyString(k);
          await vsApi.env.clipboard.writeText(pub);
          vsApi.window.showInformationMessage('HEX (public) copied');
        } else if (k.type === 'wif' || k.type === 'encryption') {
          const pk = PrivateKey.fromWif(k.value);
          await vsApi.env.clipboard.writeText(pk.toString());
          vsApi.window.showInformationMessage('HEX (private) copied');
        } else {
          vsApi.window.showErrorMessage('copyHex not valid for this type');
        }
        break;
      }
      case 'copyWif': {
        if (k.type === 'wif' || k.type === 'encryption') {
          await vsApi.env.clipboard.writeText(k.value);
          vsApi.window.showInformationMessage('WIF copied.');
        } else if (k.type === 'public') {
          const pk = PrivateKey.fromString(k.value);
          await vsApi.env.clipboard.writeText(pk.toWif());
          vsApi.window.showInformationMessage('WIF (from public) copied');
        } else {
          vsApi.window.showErrorMessage('copyWif not valid for this type');
        }
        break;
      }
      case 'copyXprv': {
        // If mnemonic => get from metadata.xprv
        if (k.type === 'mnemonic') {
          const xprv = k.metadata?.xprv;
          if (!xprv) {
            vsApi.window.showErrorMessage('No xprv in metadata');
          } else {
            await vsApi.env.clipboard.writeText(xprv);
            vsApi.window.showInformationMessage('XPRV copied (mnemonic).');
          }
        } else if (k.type === 'hdprivate') {
          await vsApi.env.clipboard.writeText(k.value);
          vsApi.window.showInformationMessage('XPRV copied');
        } else {
          vsApi.window.showErrorMessage('copyXprv not valid for this type');
        }
        break;
      }
      case 'copyXpub': {
        if (k.type === 'hdpublic') {
          await vsApi.env.clipboard.writeText(k.value);
          vsApi.window.showInformationMessage('XPUB copied');
        } else if (k.type === 'hdprivate') {
          const hd = HD.fromString(k.value);
          const xpub = hd.toPublic().toString();
          await vsApi.env.clipboard.writeText(xpub);
          vsApi.window.showInformationMessage('XPUB copied');
        } else if (k.type === 'mnemonic') {
          // retrieve xprv => derive xpub
          const xprv = k.metadata?.xprv;
          if (!xprv) {
            vsApi.window.showErrorMessage('No xprv in metadata');
            return;
          }
          const hd = HD.fromString(xprv);
          const xpub = hd.toPublic().toString();
          await vsApi.env.clipboard.writeText(xpub);
          vsApi.window.showInformationMessage('XPUB (mnemonic) copied');
        } else {
          vsApi.window.showErrorMessage('copyXpub not valid for this type');
        }
        break;
      }
      case 'copyPub': {
        // single 'public' => same as copyHex
        // or we can fallback to 'copyHex' logic
        if (k.type === 'public') {
          const pub = derivePublicKeyString(k);
          await vsApi.env.clipboard.writeText(pub);
          vsApi.window.showInformationMessage('Public (hex) copied');
        } else {
          vsApi.window.showErrorMessage('copyPub not valid for this type');
        }
        break;
      }
      case 'copyWords': {
        if (k.type === 'mnemonic') {
          await vsApi.env.clipboard.writeText(k.value);
          vsApi.window.showInformationMessage('Mnemonic words copied');
        } else {
          vsApi.window.showErrorMessage('No mnemonic words for this key type');
        }
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Derivations
  // -------------------------------------------------------------------------
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
    let duplicateFound = false;
    for (let i = 0; i < all.length; i++) {
      const ck = all[i];
      if (
        ck.metadata?.parentId === id &&
        ck.metadata?.type42OtherPub === otherPubStr &&
        ck.metadata?.type42Invoice === invoice
      ) {
        duplicateFound = true;
        break;
      }
    }
    if (duplicateFound) {
      vsApi.window.showWarningMessage('Type42 child with same pub & invoice already exists');
      return;
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
    await this.updateContent();
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
    for (let i = 0; i < all.length; i++) {
      const ck = all[i];
      if (ck.metadata?.parentId === id && ck.metadata?.bip32Path === path) {
        vsApi.window.showWarningMessage('A BIP32 child with that path already exists.');
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
    await this.updateContent();
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

    let privHex: string;
    if (parent.type === 'wif' || parent.type === 'encryption') {
      const pk = PrivateKey.fromWif(parent.value);
      privHex = pk.toString();
    } else {
      // parent.type === 'private' or 'public'
      privHex = parent.value;
    }

    await this._vault.storeKey({
      type: 'public',
      value: privHex,
      label: `Public child of ${parent.label ?? parent.type}`,
      metadata: { parentId: parent.id },
    });
    vsApi.window.showInformationMessage('Public key child created.');
    await this.updateContent();
  }

  public dispose() {
    KeyPanel.currentPanel = undefined;
    this._panel.dispose();
    for (let i = 0; i < this._disposables.length; i++) {
      this._disposables[i].dispose();
    }
    this._disposables = [];
  }
}

function getNonce(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < 16; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}