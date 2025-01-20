// src/views/keyVault/index.tsx

import vsApi, { type WebviewPanel, type Disposable } from '../../vsShim';
import type { KeyVault, KeyEntry, KeyType } from '../../keyVault';
import { PrivateKey, PublicKey, HD, Mnemonic } from '@bsv/sdk';
import { keyPanelStyles } from './styles';
import { escapeHtml } from '@kitajs/html';
import { getPanelScript } from './script'; // We'll place all event-handling logic in script.ts

/**
 * KeyPanel controls the "Bitcoin Key Vault" webview panel.
 * We store (and optionally display) private keys, child derivations, etc.
 */
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

    // Handle messages from the webview (the script in script.ts will postMessage to us)
    this._panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this._disposables
    );

    // Re-render if key vault changes
    this._vault.onDidChangeKeys(() => this.updateContent());
  }

  /**
   * Show the key panel. Reuse if already open
   */
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

  /**
   * Render the entire panel’s HTML
   */
  private async updateContent() {
    const allKeys = await this._vault.getAllKeys();

    // Attempt to set a default encryption key if not set
    const encryptionKey = await this._vault.getEncryptionKey();
    if (!encryptionKey) {
      const singlePrivate = allKeys.find(
        (k) =>
          (k.type === 'private' || k.type === 'wif' || k.type === 'encryption') &&
          !k.isEncryptionKey
      );
      if (singlePrivate) {
        await this._vault.setEncryptionKey(singlePrivate.id);
      }
    }

    const refreshedKeys = await this._vault.getAllKeys();
    const hierarchy = buildKeyHierarchy(refreshedKeys);

    const nonce = getNonce();
    const cspSource = this._panel.webview.cspSource;

    // Build typed-HTML content for the key list
    const keyElements = hierarchy.map((node) => renderKeyRecursive(node, 0));

    // Generate our front-end script from script.ts
    const allKeysJson = JSON.stringify(refreshedKeys);
    const script = getPanelScript(allKeysJson);

    // Build final HTML
    this._panel.webview.html = getPanelHtml({
      nonce,
      cspSource,
      keyElements,
      script,
      styles: keyPanelStyles,
    });
  }

  /**
   * Handle incoming messages posted from script.ts
   */
  private async handleMessage(message: {
    command: string;
    id?: string;
    label?: string;
    type?: KeyType;
    value?: string;
  }) {
    switch (message.command) {
      case 'generateRandomKey':
        if (message.type) {
          this.generateRandomKey(message.type).catch((err) =>
            vsApi.window.showErrorMessage(String(err))
          );
        }
        break;

      case 'submitAddKey':
        if (message.type && message.value) {
          this.addKey(message.type, message.value, message.label ?? 'Imported Key').catch((err) =>
            vsApi.window.showErrorMessage(`Failed to add key: ${String(err)}`)
          );
        }
        break;

      case 'deleteKey':
        if (message.id) {
          this.deleteKey(message.id);
        }
        break;

      case 'updateLabel':
        if (message.id && message.label !== undefined) {
          this._vault.updateKeyLabel(message.id, message.label).catch((err) =>
            vsApi.window.showErrorMessage(String(err))
          );
        }
        break;

      case 'setEncryptionKey':
        if (message.id) {
          this._vault
            .setEncryptionKey(message.id)
            .then(() => vsApi.window.showInformationMessage('Default encryption key set'))
            .finally(() => this.updateContent())
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
        }
        break;

      case 'copyPrivate':
        if (message.id) {
          this.copyPrivate(message.id);
        }
        break;

      case 'copyPublic':
        if (message.id) {
          this.copyPublic(message.id);
        }
        break;

      case 'copyAddress':
        if (message.id) {
          this.copyAddress(message.id);
        }
        break;

      case 'deriveAddress':
        if (message.id) {
          this.deriveAddress(message.id);
        }
        break;

      case 'type42Child':
        if (message.id) {
          this.type42Child(message.id);
        }
        break;
    }
  }

  // --- The actual logic for generating, adding, copying, deriving, etc. ---

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
        finalType,
      });
    } catch (err) {
      throw new Error(`Failed to generate random key: ${String(err)}`);
    }
  }

  private async addKey(type: KeyType, value: string, label: string) {
    let storeValue = '';
    let storeType: KeyType = type;

    switch (type) {
      case 'private':
      case 'public': {
        if (!/^[0-9A-Fa-f]{64}$/.test(value)) {
          throw new Error('Invalid private key hex (64 hex characters).');
        }
        PrivateKey.fromString(value);
        storeValue = value;
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
          throw new Error('Invalid xprv (must start with "xprv").');
        }
        HD.fromString(value);
        storeValue = value;
        break;
      }
      case 'mnemonic': {
        const mn = Mnemonic.fromString(value);
        if (!mn.isValid()) {
          throw new Error('Invalid mnemonic phrase');
        }
        // We store the xprv
        const hdPriv = HD.fromSeed(mn.toSeed());
        storeValue = hdPriv.toString();
        storeType = 'hdprivate';
        break;
      }
    }

    await this._vault.storeKey({
      type: storeType,
      value: storeValue,
      label,
    });

    vsApi.window.showInformationMessage('Key added successfully');
    this.updateContent();
  }

  private async deleteKey(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (!key) {
        vsApi.window.showWarningMessage('Key not found or already removed.');
        return;
      }

      // Make sure not to delete the last encryption key if it’s the only key
      if (key.isEncryptionKey) {
        const allKeys = await this._vault.getAllKeys();
        if (allKeys.length === 1) {
          vsApi.window.showWarningMessage(
            'Cannot delete the last key if it is the default encryption key.'
          );
          return;
        }
      }

      const confirm = await vsApi.window.showWarningMessage(
        'Are you sure you want to delete this key?',
        { modal: true },
        'Delete',
        'Cancel'
      );
      if (confirm !== 'Delete') return;

      await this._vault.deleteKey(id);
      vsApi.window.showInformationMessage('Key deleted');
      this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to delete key: ${String(err)}`);
    }
  }

  private async copyPrivate(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (!key) throw new Error('Key not found');
      await vsApi.env.clipboard.writeText(key.value);
      vsApi.window.showInformationMessage('Private key copied to clipboard.');
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to copy private key: ${String(err)}`);
    }
  }

  private async copyPublic(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (!key) throw new Error('Key not found');
      const pubKey = derivePublicKeyString(key);
      await vsApi.env.clipboard.writeText(pubKey);
      vsApi.window.showInformationMessage('Public key copied to clipboard.');
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to copy public key: ${String(err)}`);
    }
  }

  private async copyAddress(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (!key) throw new Error('Key not found');
      const addr = deriveAddress(key);
      await vsApi.env.clipboard.writeText(addr);
      vsApi.window.showInformationMessage('Address copied to clipboard.');
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to copy address: ${String(err)}`);
    }
  }

  private async deriveAddress(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (!key) throw new Error('Key not found');

      if (key.type === 'hdprivate' || key.type === 'hdpublic') {
        const path = await vsApi.window.showInputBox({
          placeHolder: 'e.g. m/0/0',
          value: 'm/0/0',
        });
        if (!path) return;

        const address = deriveHdAddress(key, path);
        vsApi.window.showInformationMessage(`Derived address: ${address}`);
      } else {
        const address = deriveAddress(key);
        vsApi.window.showInformationMessage(`Address: ${address}`);
      }
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to derive address: ${String(err)}`);
    }
  }

  private async type42Child(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (!key) throw new Error('Key not found');

      const otherPubStr = await vsApi.window.showInputBox({
        prompt: "Enter other party's compressed public key (66 hex)",
        validateInput: (txt) => {
          if (!txt.startsWith('02') && !txt.startsWith('03')) {
            return 'Must be 66-char compressed pubkey, starting with 02 or 03.';
          }
          if (txt.length !== 66) {
            return 'Must be 66 characters total.';
          }
          return null;
        },
      });
      if (!otherPubStr) return;

      const invoiceNum = await vsApi.window.showInputBox({
        prompt: 'Invoice number (any string)',
      });
      if (!invoiceNum) return;

      const priv = toPrivateKey(key);
      if (!priv) {
        throw new Error(`Cannot do Type42 derivation for ${key.type} key`);
      }

      const otherPub = PublicKey.fromString(otherPubStr);
      const child = priv.deriveChild(otherPub, invoiceNum);
      const wif = child.toWif();
      const label = `Derived (Type42) from ${key.label || key.type}`;

      await this._vault.storeKey({ type: 'wif', value: wif, label });
      vsApi.window.showInformationMessage('Type42 child key derived and stored.');
      this.updateContent();
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to derive Type42 child: ${String(err)}`);
    }
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

/** Build a parent->child hierarchy from the array of KeyEntry. */
function buildKeyHierarchy(all: KeyEntry[]): Array<KeyEntry & { children: KeyEntry[] }> {
  const map: Record<string, KeyEntry & { children: KeyEntry[] }> = {};
  for (const k of all) {
    map[k.id] = { ...k, children: [] };
  }

  const roots: Array<KeyEntry & { children: KeyEntry[] }> = [];
  for (const k of all) {
    const parentId = k.metadata?.parentId;
    if (parentId && map[parentId]) {
      map[parentId].children.push(map[k.id]);
    } else {
      roots.push(map[k.id]);
    }
  }
  return roots;
}

/**
 * Recursively render a single KeyEntry as typed HTML (JSX),
 * but use data-attributes (no inline onclick).
 */
function renderKeyRecursive(k: KeyEntry & { children?: KeyEntry[] }, indent: number): JSX.Element {
  return (
    <div class={`key-card indent-${indent}`}>
      <div class="key-top">
        <div class={`key-type type-${k.type}`}>{k.type}</div>

        {/* Instead of inline `onclick="..."`, we just store data attributes
            that the script can pick up. For label editing: */}
        <div
          class="key-label"
          data-cmd="editLabel"
          data-id={k.id}
          data-currentlabel={k.label || ''}
          safe
        >
          {k.label || 'Untitled'}
        </div>

        {/* The action buttons: each uses data-cmd + data-id. */}
        <div class="key-actions">{renderActions(k)}</div>
      </div>

      <div class="key-metadata">
        <div safe>{new Date(k.timestamp).toLocaleString()}</div>
        {k.isEncryptionKey && (
          <span class="encryption-key-badge">Default Encryption Key</span>
        )}
      </div>

      <div class="key-value">{escapeHtml(displayedKeyValue(k))}</div>
      {(k.children || []).map((child) => renderKeyRecursive(child, indent + 1))}
    </div>
  );
}

/** Show "public" or masked private data. */
function displayedKeyValue(k: KeyEntry): string {
  if (k.type === 'public' || k.type === 'hdpublic') {
    return derivePublicKeyString(k);
  }
  const v = k.value;
  if (v.length <= 8) return v;
  return `${v.substring(0, 4)}...${v.substring(v.length - 4)}`;
}

/** Action buttons -> data attributes for the script. */
function renderActions(k: KeyEntry): JSX.Element[] {
  const isSinglePrivate = k.type === 'private' || k.type === 'wif' || k.type === 'encryption';
  const isPublicType = k.type === 'public' || k.type === 'hdpublic';

  const actions: JSX.Element[] = [];

  if (!isPublicType) {
    actions.push(
      <button
        type="button"
        class="key-button"
        data-cmd="copyPrivate"
        data-id={k.id}
      >
        Copy Private
      </button>
    );
  }

  actions.push(
    <button
      type="button"
      class="key-button"
      data-cmd="copyPublic"
      data-id={k.id}
    >
      Copy Public
    </button>,
    <button
      type="button"
      class="key-button"
      data-cmd="copyAddress"
      data-id={k.id}
    >
      Copy Address
    </button>,
    <button
      type="button"
      class="key-button"
      data-cmd="deriveAddress"
      data-id={k.id}
    >
      Derive Address
    </button>,
    <button
      type="button"
      class="key-button"
      data-cmd="type42Child"
      data-id={k.id}
    >
      Derive Child (Type42)
    </button>
  );

  if (isSinglePrivate && !k.isEncryptionKey) {
    actions.push(
      <button
        type="button"
        class="key-button"
        data-cmd="setEncryptionKey"
        data-id={k.id}
      >
        Set Default
      </button>
    );
  }

  actions.push(
    <button
      type="button"
      class="key-button"
      data-cmd="deleteKey"
      data-id={k.id}
    >
      Delete
    </button>
  );

  return actions;
}

function derivePublicKeyString(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    const hdPriv = HD.fromString(k.value);
    return hdPriv.toPublic().toString();
  }
  if (k.type === 'public') {
    const priv = PrivateKey.fromString(k.value);
    return priv.toPublicKey().toString();
  }
  if (k.type === 'hdprivate') {
    const hdPriv = HD.fromString(k.value);
    return hdPriv.toPublic().toString();
  }
  if (k.type === 'private') {
    const priv = PrivateKey.fromString(k.value);
    return priv.toPublicKey().toString();
  }
  if (k.type === 'wif' || k.type === 'encryption') {
    const priv = PrivateKey.fromWif(k.value);
    return priv.toPublicKey().toString();
  }
  return '(unknown)';
}

function deriveAddress(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    const hdPriv = HD.fromString(k.value);
    const pub = hdPriv.toPublic();
    return pub.pubKey.toAddress().toString();
  }
  if (k.type === 'hdprivate') {
    const hdPriv = HD.fromString(k.value);
    const priv = PrivateKey.fromHex(hdPriv.privKey.toString());
    return priv.toAddress().toString();
  }
  if (k.type === 'public') {
    const priv = PrivateKey.fromString(k.value);
    return priv.toAddress().toString();
  }
  if (k.type === 'private') {
    const priv = PrivateKey.fromString(k.value);
    return priv.toAddress().toString();
  }
  if (k.type === 'wif' || k.type === 'encryption') {
    const priv = PrivateKey.fromWif(k.value);
    return priv.toAddress().toString();
  }
  return '(unknown)';
}

function deriveHdAddress(k: KeyEntry, path: string): string {
  const hdPriv = HD.fromString(k.value);
  const derived = hdPriv.derive(path);
  const finalPriv = PrivateKey.fromHex(derived.privKey.toString());
  return finalPriv.toAddress().toString();
}

/** Convert KeyEntry to PrivateKey if possible. */
function toPrivateKey(k: KeyEntry): PrivateKey | null {
  if (k.type === 'private') return PrivateKey.fromString(k.value);
  if (k.type === 'public') return PrivateKey.fromString(k.value);
  if (k.type === 'wif' || k.type === 'encryption') return PrivateKey.fromWif(k.value);
  if (k.type === 'hdprivate' || k.type === 'hdpublic') {
    const hdPriv = HD.fromString(k.value);
    return hdPriv.privKey;
  }
  return null;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Build the overall <html> ... returning a string with typed-html & the script included.
 */
function getPanelHtml(opts: {
  nonce: string;
  cspSource: string;
  keyElements: JSX.Element[];
  script: string;
  styles: string;
}): string {
  const { nonce, cspSource, keyElements, script, styles } = opts;

  const page = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content={`default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`}
        />
        <title>Bitcoin Key Vault</title>
        <style safe>{styles}</style>
      </head>
      <body>
        <HeaderBar />
        <div id="keyList">
          {keyElements}
        </div>
        <Modal />
        {/* Instead of inline script, we embed <script nonce=...>{script}</script> */}
        <script nonce={nonce}>{script}</script>
      </body>
    </html>
  );

  return `<!DOCTYPE html>\n${String(page)}`;
}

/** Top header bar subcomponent. No inline oninput; we use data-cmd in script.ts */
function HeaderBar() {
  return (
    <div class="header">
      <input
        id="searchInput"
        type="text"
        placeholder="Search keys..."
        data-cmd="searchKeys"
      />
      <button
        class="add-key-button"
        data-cmd="openModal"
        type="button"
      >
        Add Key
      </button>
    </div>
  );
}

/** The add-key modal subcomponent. Again, no inline onclick. Just data-cmd. */
function Modal() {
  return (
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add New Key</h2>
          <button
            class="close-modal"
            data-cmd="closeModal"
            type="button"
          >
            ×
          </button>
        </div>
        <div class="form-group">
          <label for="keyType">Key Type</label>
          <select id="keyType">
            <option value="private">Private Key (hex)</option>
            <option value="public">Public Key (Generate random private, show as public)</option>
            <option value="wif">Private Key (WIF)</option>
            <option value="encryption">Encryption (WIF)</option>
            <option value="hdprivate">HD Private (xprv)</option>
            <option value="hdpublic">HD Public (Generate random xprv, show as xpub)</option>
            <option value="mnemonic">Mnemonic (store xprv)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="keyLabel">Label</label>
          <input type="text" id="keyLabel" placeholder="Optional label" />
        </div>
        <div class="form-group">
          <label for="keyValue">Key Value</label>
          <input type="password" id="keyValue" />
        </div>
        <div class="modal-actions">
          <button
            class="secondary"
            data-cmd="generateRandom"
            type="button"
          >
            Generate
          </button>
          <div>
            <button
              class="secondary"
              data-cmd="closeModal"
              type="button"
            >
              Cancel
            </button>
            <button
              class="primary"
              data-cmd="submitAddKey"
              type="button"
            >
              Add Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}