// src/keyPanel.tsx
import '@kitajs/html/register';
import vsApi, { type WebviewPanel, type Disposable } from './vsShim';
import type { KeyVault, KeyEntry, KeyType } from './keyVault';
import { PrivateKey, PublicKey, HD, Mnemonic } from '@bsv/sdk';

/**
 * This KeyPanel is rendered in a webview using @kitajs/html + JSX.
 * We store only "private" keys from the "Add Key" modal, but user can choose "public"/"hdpublic"
 * to generate behind the scenes a private key, displaying it as "public" in the UI, etc.
 */

export class KeyPanel {
  public static currentPanel: KeyPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _vault: KeyVault;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel, vault: KeyVault) {
    this._panel = panel;
    this._vault = vault;

    // Populate initial HTML
    this.updateContent();

    // Handle disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this._disposables,
    );

    // Re-render if key vault changes
    this._vault.onDidChangeKeys(() => this.updateContent());
  }

  /**
   * Show the key panel. Reuse if already open.
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
        },
      );
      KeyPanel.currentPanel = new KeyPanel(panel, vault);
    }
  }

  /**
   * Re-render the HTML content for the panel
   */
  private async updateContent() {
    const allKeys = await this._vault.getAllKeys();

    // If no encryption key is set, pick the first single private key (if any)
    const encryptionKey = await this._vault.getEncryptionKey();
    if (!encryptionKey) {
      // Find any single private key
      const singlePrivate = allKeys.find(
        (k) =>
          (k.type === 'private' || k.type === 'wif' || k.type === 'encryption') &&
          !k.isEncryptionKey,
      );
      if (singlePrivate) {
        await this._vault.setEncryptionKey(singlePrivate.id);
      }
    }

    // Grab final set
    const refreshedKeys = await this._vault.getAllKeys();
    // Build parent->child relationships
    const hierarchy = buildKeyHierarchy(refreshedKeys);

    const nonce = getNonce();
    const cspSource = this._panel.webview.cspSource;

    // Build server-rendered HTML for the key list
    const keyRowsHtml = hierarchy.map((node) => renderKeyRecursive(node, 0)).join('');
    // Convert all backslash escapes that @kitajs/html might handle, etc.

    // Inline script for client-side behaviors
    const script = getWebviewScript(JSON.stringify(refreshedKeys));

    // CSS styles we'll embed
    const styles = getCssStyles();

    // Full @kitajs/html -> string
    const panelHtml = getPanelHtml({
      nonce,
      cspSource,
      keyRowsHtml,
      script,
      styles,
    });

    this._panel.webview.html = panelHtml;
  }

  /**
   * Handle messages from the webview
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
            vsApi.window.showErrorMessage(String(err)),
          );
        }
        break;

      case 'submitAddKey':
        if (message.type && message.value) {
          this.addKey(message.type, message.value, message.label ?? 'Imported Key').catch((err) =>
            vsApi.window.showErrorMessage(`Failed to add key: ${String(err)}`),
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
          this._vault
            .updateKeyLabel(message.id, message.label)
            .catch((err) => vsApi.window.showErrorMessage(String(err)));
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

  /**
   * Generate a random key in various formats
   */
  private async generateRandomKey(type: KeyType) {
    try {
      let generatedValue = '';
      let actualType: KeyType = type;

      switch (type) {
        case 'private':
        case 'public': {
          // We generate a random private key
          // If user asked for "public," we label the final KeyEntry as public
          // but the .value is still the private data
          const priv = PrivateKey.fromRandom();
          generatedValue = priv.toString(); // hex
          if (type === 'public') {
            actualType = 'public';
          } else {
            actualType = 'private';
          }
          break;
        }
        case 'wif': {
          generatedValue = PrivateKey.fromRandom().toWif();
          break;
        }
        case 'encryption': {
          generatedValue = PrivateKey.fromRandom().toWif();
          break;
        }
        case 'hdprivate':
        case 'hdpublic': {
          // if 'hdpublic', we store a random HD private internally but label type "hdpublic"
          const hdPriv = HD.fromRandom();
          generatedValue = hdPriv.toString();
          if (type === 'hdpublic') {
            actualType = 'hdpublic';
          } else {
            actualType = 'hdprivate';
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
        finalType: actualType,
      });
    } catch (err) {
      throw new Error(`Failed to generate random key: ${String(err)}`);
    }
  }

  /**
   * Add a new key from the modal
   */
  private async addKey(type: KeyType, value: string, label: string) {
    let storeValue = '';
    let storeType: KeyType;

    switch (type) {
      case 'private':
      case 'public': {
        // If "public" was chosen, we still store the private data, but mark as "public"
        // => user might want to see "public" in UI (no copy private).
        // If "private," store type=private, expecting raw 64 hex
        if (!/^[0-9A-Fa-f]{64}$/.test(value)) {
          throw new Error('Invalid private key hex (must be 64 hex characters)');
        }
        PrivateKey.fromString(value); // confirm valid
        storeValue = value;
        storeType = type; // 'public' or 'private'
        break;
      }
      case 'wif':
      case 'encryption': {
        // parse WIF
        const priv = PrivateKey.fromWif(value);
        storeValue = priv.toWif();
        storeType = type;
        break;
      }
      case 'hdprivate':
      case 'hdpublic': {
        // parse xprv. If it's 'hdpublic', we treat it as a private string but label as hdpublic
        if (!value.startsWith('xprv')) {
          throw new Error('Must start with "xprv"');
        }
        HD.fromString(value);
        storeValue = value;
        storeType = type;
        break;
      }
      case 'mnemonic': {
        const mn = Mnemonic.fromString(value);
        if (!mn.isValid()) {
          throw new Error('Invalid mnemonic phrase');
        }
        // store the xprv
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
    const key = await this._vault.getKey(id);
    if (!key) {
      vsApi.window.showWarningMessage('Key not found or already removed.');
      return;
    }

    // If it's the only key & also encryption key => can't delete
    if (key.isEncryptionKey) {
      const allKeys = await this._vault.getAllKeys();
      if (allKeys.length === 1) {
        vsApi.window.showWarningMessage(
          'Cannot delete the last key if it is the default encryption key.',
        );
        return;
      }
    }

    const confirm = await vsApi.window.showWarningMessage(
      'Are you sure you want to delete this key?',
      { modal: true },
      'Delete',
      'Cancel',
    );
    if (confirm !== 'Delete') return;

    await this._vault.deleteKey(id);
    vsApi.window.showInformationMessage('Key deleted');
    this.updateContent();
  }

  private async copyPrivate(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) {
      vsApi.window.showErrorMessage('Key not found');
      return;
    }
    // user explicitly wants the private data
    await vsApi.env.clipboard.writeText(key.value);
    vsApi.window.showInformationMessage('Private key copied to clipboard.');
  }

  private async copyPublic(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) {
      vsApi.window.showErrorMessage('Key not found');
      return;
    }
    const pubKey = derivePublicKeyString(key);
    await vsApi.env.clipboard.writeText(pubKey);
    vsApi.window.showInformationMessage('Public key copied to clipboard.');
  }

  private async copyAddress(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) {
      vsApi.window.showErrorMessage('Key not found');
      return;
    }
    const addr = deriveAddress(key);
    await vsApi.env.clipboard.writeText(addr);
    vsApi.window.showInformationMessage('Address copied to clipboard.');
  }

  private async deriveAddress(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) {
      vsApi.window.showErrorMessage('Key not found');
      return;
    }

    if (key.type === 'hdprivate' || key.type === 'hdpublic') {
      // prompt for path
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
  }

  private async type42Child(id: string) {
    const key = await this._vault.getKey(id);
    if (!key) {
      vsApi.window.showErrorMessage('Key not found');
      return;
    }
    const otherPubStr = await vsApi.window.showInputBox({
      prompt: "Enter other party's compressed public key (66 hex)",
      validateInput: (txt) => {
        if (!(txt.startsWith('02') || txt.startsWith('03')) || txt.length !== 66) {
          return 'Must be a 66-char compressed public key (start with 02 or 03)';
        }
        return null;
      },
    });
    if (!otherPubStr) return;

    const invoiceNum = await vsApi.window.showInputBox({
      prompt: 'Invoice number (any string)',
    });
    if (!invoiceNum) return;

    // get private from key
    const priv = toPrivateKey(key);
    if (!priv) {
      vsApi.window.showErrorMessage(`Cannot do Type42 derivation for ${key.type} key`);
      return;
    }
    const otherPub = PublicKey.fromString(otherPubStr);

    const child = priv.deriveChild(otherPub, invoiceNum);
    const wif = child.toWif();
    const label = `Derived (Type42) from ${key.label || key.type}`;

    await this._vault.storeKey({
      type: 'wif',
      value: wif,
      label,
    });
    vsApi.window.showInformationMessage('Type42 child key derived and stored.');
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

/**
 * Build a parent->children hierarchy from the array of KeyEntry.
 */
function buildKeyHierarchy(all: KeyEntry[]): Array<KeyEntry & { children?: KeyEntry[] }> {
  const map: Record<string, KeyEntry & { children: KeyEntry[] }> = {};
  for (const k of all) {
    map[k.id] = { ...k, children: [] };
  }

  const roots: Array<KeyEntry & { children?: KeyEntry[] }> = [];
  for (const k of all) {
    const parentId = k.metadata?.parentId; // if any
    if (parentId && map[parentId]) {
      map[parentId].children.push(map[k.id]);
    } else {
      // top-level
      roots.push(map[k.id]);
    }
  }
  return roots;
}

/**
 * Recursively render a key (and its children) as typed HTML
 */
function renderKeyRecursive(k: KeyEntry & { children?: KeyEntry[] }, indent: number): string {
  const childrenHtml = (k.children || []).map((c) => renderKeyRecursive(c, indent + 1)).join('');
  return `
    <div class="key-card indent-${indent}">
      <div class="key-top">
        <div class="key-type type-${k.type}">${k.type}</div>
        <div class="key-label" onclick="editLabel('${k.id}', '${escapeHtml(k.label || '')}')">
          ${escapeHtml(k.label || 'Untitled')}
        </div>
        <div class="key-actions">
          ${renderActions(k)}
        </div>
      </div>
      <div class="key-metadata">
        <div>${new Date(k.timestamp).toLocaleString()}</div>
        ${k.isEncryptionKey ? '<span class="encryption-key-badge">Default Encryption Key</span>' : ''}
      </div>
      <div class="key-value">
        ${escapeHtml(displayedKeyValue(k))}
      </div>
    </div>
    ${childrenHtml}
  `;
}

/**
 * Determine the displayed "key value" in the UI:
 * - If type is public or hdpublic => derivePublicKeyString
 * - else if type is private/wif/etc => mask the actual private data
 */
function displayedKeyValue(k: KeyEntry): string {
  if (k.type === 'public' || k.type === 'hdpublic') {
    // show the derived public key
    return derivePublicKeyString(k);
  }
  // private keys => mask
  const v = k.value;
  if (v.length <= 8) return v;
  return `${v.substring(0, 4)}...${v.substring(v.length - 4)}`;
}

/**
 * Render the action buttons for a given key
 */
function renderActions(k: KeyEntry): string {
  const isSinglePrivate = k.type === 'private' || k.type === 'wif' || k.type === 'encryption';
  const isPublicType = k.type === 'public' || k.type === 'hdpublic';
  // Copy Private only if it's not a public type
  const copyPrivateBtn = isPublicType
    ? ''
    : `<button class="key-button" onclick="copyPrivate('${k.id}')">Copy Private</button>`;

  // Copy Public => only if we can actually derive a public key from it
  const copyPublicBtn = `<button class="key-button" onclick="copyPublic('${k.id}')">Copy Public</button>`;

  // Copy Address => always
  const copyAddrBtn = `<button class="key-button" onclick="copyAddress('${k.id}')">Copy Address</button>`;
  // Derive Address => always
  const deriveAddrBtn = `<button class="key-button" onclick="deriveAddress('${k.id}')">Derive Address</button>`;
  // Derive Child => always
  const type42Btn = `<button class="key-button" onclick="type42Child('${k.id}')">Derive Child (Type42)</button>`;

  // Encryption => only if single private
  const encBtn = !k.isEncryptionKey && isSinglePrivate
    ? `<button class="key-button" onclick="setEncryptionKey('${k.id}')">Set Default</button>`
    : '';

  // Delete => always
  const deleteBtn = `<button class="key-button" onclick="deleteKey('${k.id}')">Delete</button>`;

  return [
    copyPrivateBtn,
    copyPublicBtn,
    copyAddrBtn,
    deriveAddrBtn,
    type42Btn,
    encBtn,
    deleteBtn,
  ]
    .filter((s) => s !== '')
    .join('\n');
}

/**
 * Derive the public key string from a KeyEntry
 */
function derivePublicKeyString(k: KeyEntry): string {
  // we have stored the private in k.value
  if (k.type === 'hdpublic') {
    // treat k.value as xprv but user sees it as "HD Public"
    const hdPriv = HD.fromString(k.value);
    return hdPriv.toPublic().toString();
  }
  if (k.type === 'public') {
    // treat k.value as raw private key
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
  // fallback?
  return '(unknown)';
}

/**
 * Derive single-address for non-hd, or the root address for hdprivate, or a path-based address
 */
function deriveAddress(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    // root address from hdpublic?
    const hdPriv = HD.fromString(k.value); // it's actually xprv stored
    const pub = hdPriv.toPublic();
    return pub.pubKey.toAddress().toString();
  }
  if (k.type === 'hdprivate') {
    // root address from xprv
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

/**
 * Derive an address from HD path
 */
function deriveHdAddress(k: KeyEntry, path: string): string {
  // If hdpublic => treat stored data as xprv
  const hdPriv = HD.fromString(k.value);
  const isPub = k.type === 'hdpublic';
  const derived = hdPriv.derive(path);
  let finalPriv: PrivateKey;
  if (isPub) {
    // we can't get the private key from an actual xpub, but in this code
    // we said we store the xprv anyway. So isPub just means we label it differently in UI
    finalPriv = PrivateKey.fromHex(derived.privKey.toString());
  } else {
    finalPriv = PrivateKey.fromHex(derived.privKey.toString());
  }
  return finalPriv.toAddress().toString();
}

/**
 * Convert a KeyEntry to PrivateKey if possible
 */
function toPrivateKey(k: KeyEntry): PrivateKey | null {
  if (k.type === 'private') {
    return PrivateKey.fromString(k.value);
  }
  if (k.type === 'public') {
    // we still have private in the .value
    return PrivateKey.fromString(k.value);
  }
  if (k.type === 'wif' || k.type === 'encryption') {
    return PrivateKey.fromWif(k.value);
  }
  if (k.type === 'hdprivate' || k.type === 'hdpublic') {
    const hdPriv = HD.fromString(k.value);
    return hdPriv.privKey; // might exist
  }
  return null;
}

/** Escape HTML for safety in text content. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Return a random nonce for CSP. */
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Return the typed-html for the entire panel. We do <html> ... </html> with
 * embedded styles, the key list, and the modal, plus an inline <script>.
 */
function getPanelHtml(opts: {
  nonce: string;
  cspSource: string;
  keyRowsHtml: string;
  script: string;
  styles: string;
}): string {
  const { nonce, cspSource, keyRowsHtml, script, styles } = opts;

  const app = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content={`default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`}
        />
        <title>Bitcoin Key Vault</title>
        <style>{styles}</style>
      </head>
      <body>
        {HeaderBar()}
        {/* Key List container with server-rendered markup */}
        <div id="keyList">{keyRowsHtml}</div>

        {Modal()}

        <script>{script}</script>
      </body>
    </html>
  );

  // typed-html => string
  return `<!DOCTYPE html>\n${String(app)}`;
}

/** Top header bar subcomponent. */
function HeaderBar() {
  return (
    <div class="header">
      <input
        id="searchInput"
        type="text"
        placeholder="Search keys..."
        oninput="searchKeys(this.value)"
      />
      <button class="add-key-button" onclick="openModal()" type="button">
        Add Key
      </button>
    </div>
  );
}

/** The add-key modal subcomponent. */
function Modal() {
  return (
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add New Key</h2>
          <button class="close-modal" onclick="closeModal()" type="button">×</button>
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
          <button class="secondary" onclick="generateRandom()" type="button">Generate</button>
          <div>
            <button class="secondary" onclick="closeModal()" type="button">Cancel</button>
            <button class="primary" onclick="submitAddKey()" type="button">Add Key</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Return the inline <script> code for client side, including search, openModal, etc.
 * We do everything in plain JS that posts messages or manipulates the DOM.
 */
function getWebviewScript(allKeysJson: string): string {
  return `
    const vscode = acquireVsCodeApi();
    let allKeys = ${allKeysJson};

    function searchKeys(query) {
      const lower = query.toLowerCase();
      // We'll do a minimal client-side filter. We won't rebuild hierarchy, just hide items not matching
      const items = document.querySelectorAll('#keyList .key-card');
      items.forEach(item => {
        const labelEl = item.querySelector('.key-label');
        const typeEl = item.querySelector('.key-type');
        const lbl = labelEl ? labelEl.textContent.toLowerCase() : '';
        const t = typeEl ? typeEl.textContent.toLowerCase() : '';
        if (lbl.includes(lower) || t.includes(lower)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    }

    function openModal() {
      const modal = document.getElementById('modalOverlay');
      modal.classList.add('show');
      document.getElementById('keyType').focus();
    }
    function closeModal() {
      const modal = document.getElementById('modalOverlay');
      modal.classList.remove('show');
      clearModalFields();
    }
    function clearModalFields() {
      document.getElementById('keyType').value = 'private';
      document.getElementById('keyLabel').value = '';
      document.getElementById('keyValue').value = '';
    }

    function generateRandom() {
      const type = document.getElementById('keyType').value;
      vscode.postMessage({ command: 'generateRandomKey', type });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'populateGeneratedKey') {
        const keyValueInput = document.getElementById('keyValue');
        keyValueInput.value = msg.value;
        // If the final type differs from user selection, update:
        if (msg.finalType) {
          document.getElementById('keyType').value = msg.finalType;
        }
      }
      if (msg.command === 'refreshKeys') {
        // If we want a complete re-render, we can do location.reload() or something
      }
    });

    function submitAddKey() {
      const type = document.getElementById('keyType').value;
      const label = document.getElementById('keyLabel').value.trim() || null;
      const value = document.getElementById('keyValue').value.trim();
      if (!value) {
        alert('Key Value is required!');
        return;
      }
      vscode.postMessage({
        command: 'submitAddKey',
        type,
        value,
        label: label || 'Imported ' + type + ' Key'
      });
      closeModal();
    }

    function editLabel(id, currentLabel) {
      const newLabel = prompt('Enter new label:', currentLabel);
      if (newLabel !== null && newLabel !== currentLabel) {
        vscode.postMessage({
          command: 'updateLabel',
          id,
          label: newLabel
        });
      }
    }

    function copyPrivate(id) {
      vscode.postMessage({ command: 'copyPrivate', id });
    }
    function copyPublic(id) {
      vscode.postMessage({ command: 'copyPublic', id });
    }
    function copyAddress(id) {
      vscode.postMessage({ command: 'copyAddress', id });
    }
    function deriveAddress(id) {
      vscode.postMessage({ command: 'deriveAddress', id });
    }
    function type42Child(id) {
      vscode.postMessage({ command: 'type42Child', id });
    }
    function deleteKey(id) {
      vscode.postMessage({ command: 'deleteKey', id });
    }
    function setEncryptionKey(id) {
      vscode.postMessage({ command: 'setEncryptionKey', id });
    }
  `;
}

/** Return big chunk of CSS we embed into <style>. */
function getCssStyles(): string {
  return `
  body {
    margin: 0;
    padding: 16px;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    line-height: 1.4;
  }
  input, select, button {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  #searchInput {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-fg);
    outline: none;
  }
  #searchInput:focus {
    border-color: var(--focus-border);
  }
  .add-key-button {
    background: var(--primary-btn);
    color: var(--primary-btn-text);
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .add-key-button:hover {
    background: var(--primary-btn-hover);
  }
  #keyList {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .key-card {
    background: var(--panel-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .indent-0 { margin-left: 0; }
  .indent-1 { margin-left: 20px; }
  .indent-2 { margin-left: 40px; }
  .indent-3 { margin-left: 60px; }
  .key-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .key-type {
    font-size: 0.8rem;
    padding: 2px 6px;
    border-radius: 4px;
    color: #fff;
    text-transform: uppercase;
  }
  .type-private { background: #de3f3f; }
  .type-wif { background: #c06f2f; }
  .type-encryption { background: #d2325f; }
  .type-hdprivate { background: #9e3ece; }
  .type-public { background: #3f82de; }
  .type-hdpublic { background: #3c46c9; }
  .type-mnemonic { background: #b57f1e; }
  .key-label {
    font-weight: 600;
    cursor: pointer;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .key-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .key-button {
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    background: var(--secondary-btn);
    color: var(--secondary-btn-text);
    font-size: 0.85rem;
  }
  .key-button:hover {
    background: var(--secondary-btn-hover);
  }
  .key-metadata {
    font-size: 0.8rem;
    color: var(--description-fg);
  }
  .key-value {
    background: var(--input-bg);
    color: var(--input-fg);
    padding: 6px;
    font-size: 0.85rem;
    word-break: break-word;
    border-radius: 3px;
  }
  .encryption-key-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 2px 4px;
    background: var(--secondary-btn);
    color: var(--secondary-btn-text);
    border-radius: 4px;
    font-size: 0.7rem;
  }
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px);
    justify-content: center;
    align-items: center;
    z-index: 999;
  }
  .modal-overlay.show {
    display: flex;
  }
  .modal-content {
    background: var(--panel-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    width: 400px;
    max-width: 90%;
    padding: 16px;
    position: relative;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .close-modal {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--fg);
  }
  .form-group {
    margin-bottom: 12px;
  }
  .form-group label {
    display: block;
    margin-bottom: 4px;
    font-size: 0.85rem;
  }
  .form-group select,
  .form-group input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-fg);
  }
  .modal-actions {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .modal-actions button {
    border: none;
    padding: 6px 12px;
    font-size: 0.9rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .primary {
    background: var(--primary-btn);
    color: var(--primary-btn-text);
  }
  .primary:hover {
    background: var(--primary-btn-hover);
  }
  .secondary {
    background: var(--secondary-btn);
    color: var(--secondary-btn-text);
  }
  .secondary:hover {
    background: var(--secondary-btn-hover);
  }
  `;
}