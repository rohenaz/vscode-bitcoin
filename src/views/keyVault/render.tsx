import { escapeHtml } from '@kitajs/html';
import type { KeyEntry } from '../../keyVault';
import { HD, PrivateKey, Utils } from '@bsv/sdk';

const { toArray, toHex } = Utils;

/**
 * Build a parent->child hierarchy without using forEach or map.
 */
export function buildKeyHierarchy(
  all: KeyEntry[],
): Array<KeyEntry & { children: KeyEntry[] }> {
  const map: Record<string, KeyEntry & { children: KeyEntry[] }> = {};
  for (let i = 0; i < all.length; i++) {
    const k = all[i];
    map[k.id] = { ...k, children: [] };
  }

  const roots: Array<KeyEntry & { children: KeyEntry[] }> = [];
  for (let i = 0; i < all.length; i++) {
    const k = all[i];
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
 * Render a key card and its children recursively.
 */
export function renderKeyRecursive(
  k: KeyEntry & { children?: KeyEntry[] },
  indent: number,
): JSX.Element {
  return (
    <div class={`key-card indent-${indent}`} data-keyid={k.id}>
      <div class="key-top">
        <div class={`key-type type-${k.type}`}>{k.type}</div>
        <div
          class="key-label"
          data-cmd="editLabel"
          data-id={k.id}
          data-currentlabel={k.label || ''}
          safe
        >
          {k.label || 'Untitled'}
        </div>
        <div class="key-actions">{renderActions(k)}</div>
      </div>

      <div class="key-metadata" style="display: flex; justify-content: space-between;">
        <div safe>{new Date(k.timestamp).toLocaleString()}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          {renderChildMetadata(k)}
          {k.isEncryptionKey && (
            <span class="encryption-key-badge">Default Encryption Key</span>
          )}
        </div>
      </div>

      <button
        type="button"
        class="key-value"
        data-cmd="copyKeyValue"
        data-id={k.id}
        data-type={k.type}
        title={k.type === 'mnemonic' ? 'Hover to reveal, click to copy' : 'Click to copy'}
      >
        <div>
          {displayedKeyValue(k)}
        </div>

      </button>
      <div style="display: flex; align-items: center;">
          <div style="flex: 1;">&nbsp;</div>
          <div style="display: flex; align-items: end; gap: 6px;">{renderFormatBadges(k)}</div>
        </div>
      {k.children?.map((child) => renderKeyRecursive(child, indent + 1))}
    </div>
  );
}

/**
 * Possibly show bip32 path or type42 invoice/pub.
 */
function renderChildMetadata(k: KeyEntry): JSX.Element {
  const m = k.metadata || {};

  if (m.bip32Path) {
    return (
      <div style="font-size:0.85rem; color: var(--description-fg);">
        Path: {escapeHtml(m.bip32Path)}
      </div>
    );
  }
  if (m.type42OtherPub || m.type42Invoice) {
    return (
      <div style="font-size:0.85rem; color: var(--description-fg);" safe>
        {m.type42OtherPub && <>OtherPub: {escapeHtml(m.type42OtherPub)}</>}
        {m.type42Invoice && <> / Invoice: {escapeHtml(m.type42Invoice)}</>}
      </div>
    );
  }
  return <></>;
}

/**
 * Return the full string to use in the 'title' hover.
 */
function displayedTitle(k: KeyEntry): string {
  if (k.type === 'mnemonic') {
    return k.metadata?.mnemonicWords || k.value;
  }
  return deriveValueForDisplay(k);
}

/**
 * Show truncated display value with proper HTML escaping
 */
export function displayedKeyValue(k: KeyEntry): JSX.Element {
  if (k.type === 'mnemonic') {
    const phrase = k.metadata?.mnemonicWords || k.value;
    return <span class="mnemonic-text" title={phrase} safe>{customTruncate(phrase)}</span>;
  }
  const displayValue = deriveValueForDisplay(k);
  return <span title={displayValue} safe>{customTruncate(displayValue)}</span>;
}

/**
 * Derive display value from key type
 */
function deriveValueForDisplay(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    const hd = HD.fromString(k.value).toPublic();
    return hd.toString();
  }
  if (k.type === 'public') {
    const pubKey = PrivateKey.fromString(k.value).toPublicKey();
    return pubKey.toString();
  }
  return k.value;
}

/**
 * Truncate long values with middle ellipsis
 */
function customTruncate(str: string): string {
  if (str.length <= 12) return str;
  return `${str.slice(0, 6)}...${str.slice(-6)}`;
}

/**
 * Format badges based on key type
 */
function renderFormatBadges(k: KeyEntry): JSX.Element[] {
  const badges: JSX.Element[] = [];

  switch (k.type) {
    case 'mnemonic':
      badges.push(
        <button class="format-badge" data-cmd="copyWords" data-id={k.id} type="button">
          WORDS
        </button>,
        <button class="format-badge" data-cmd="copyXprv" data-id={k.id} type="button">
          XPRIV
        </button>,
        <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button">
          XPUB
        </button>
      );
      break;

    case 'private':
    case 'wif':
    case 'encryption':
      badges.push(
        <button class="format-badge" data-cmd="copyHex" data-id={k.id} type="button">
          HEX
        </button>,
        <button class="format-badge" data-cmd="copyWif" data-id={k.id} type="button">
          WIF
        </button>
      );
      if (k.type === 'wif') {
        badges.push(
          <button class="format-badge" data-cmd="copyAddress" data-id={k.id} type="button">
            ADDR
          </button>
        );
      }
      break;

    case 'public':
      badges.push(
        <button class="format-badge" data-cmd="copyHex" data-id={k.id} type="button">
          HEX
        </button>,
        <button class="format-badge" data-cmd="copyAddress" data-id={k.id} type="button">
          ADDR
        </button>
      );
      break;

    case 'hdprivate':
      badges.push(
        <button class="format-badge" data-cmd="copyXprv" data-id={k.id} type="button">
          XPRIV
        </button>,
        <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button">
          XPUB
        </button>
      );
      break;

    case 'hdpublic':
      badges.push(
        <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button">
          XPUB
        </button>
      );
      break;
  }

  return badges;
}

/**
 * Action buttons for key management
 */
export function renderActions(k: KeyEntry): JSX.Element[] {
  const actions: JSX.Element[] = [];
  const isHdKey = k.type === 'hdprivate' || k.type === 'hdpublic';
  const isPrivate = k.type === 'private' || k.type === 'wif';

  // Common actions
  actions.push(
    <button 
      class="action-button" 
      data-cmd="deleteKey" 
      data-id={k.id} 
      type="button"
      title="Delete key"
    >
      <i class="codicon codicon-trash" />
    </button>
  );

  // Key-specific actions
  if (isHdKey || k.type === 'mnemonic') {
    actions.push(
      <button 
        class="action-button" 
        data-cmd="bip32Child" 
        data-id={k.id} 
        type="button"
        title="Create BIP32 child key"
      >
        <i class="codicon codicon-git-branch" />
      </button>
    );
  }

  if (isPrivate) {
    actions.push(
      <button 
        class="action-button" 
        data-cmd="publicChild" 
        data-id={k.id} 
        type="button"
        title="Create public key"
      >
        <i class="codicon codicon-key" />
      </button>
    );
  }

  if (k.type === 'public') {
    actions.push(
      <button 
        class="action-button" 
        data-cmd="p2pkhScript" 
        data-id={k.id} 
        type="button"
        title="Create P2PKH script"
      >
        <i class="codicon codicon-symbol-key" />
      </button>,
      <button 
        class="action-button" 
        data-cmd="viewOnChain" 
        data-id={k.id} 
        type="button"
        title="View on WhatsOnChain"
      >
        <i class="codicon codicon-globe" />
      </button>
    );
  }

  return actions;
}

/**
 * Derive HD address from path
 */
export function deriveHdAddress(k: KeyEntry, path: string): string {
  try {
    const hd = HD.fromString(k.value);
    const derived = hd.derive(path.replace(/'/g, 'h'));
    if (!derived.privKey) return '(no privkey at path)';
    const priv = PrivateKey.fromHex(derived.privKey.toString());
    return priv.toAddress().toString();
  } catch {
    return 'Invalid derivation path';
  }
}

/**
 * Convert KeyEntry to PrivateKey if possible
 */
export function toPrivateKey(k: KeyEntry): PrivateKey | null {
  try {
    if (k.type === 'private') {
      return PrivateKey.fromString(k.value);
    }
    if (k.type === 'public') {
      return PrivateKey.fromString(k.value);
    }
    if (k.type === 'wif' || k.type === 'encryption') {
      return PrivateKey.fromWif(k.value);
    }
    if (k.type === 'hdprivate' || k.type === 'hdpublic') {
      const hd = HD.fromString(k.value);
      return hd.privKey ? PrivateKey.fromHex(hd.privKey.toString()) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Derive public key string from various key types
 */
export function derivePublicKeyString(k: KeyEntry): string {
  try {
    switch (k.type) {
      case 'hdpublic':
        return HD.fromString(k.value).toPublic().toString();
      case 'hdprivate':
        return HD.fromString(k.value).toPublic().toString();
      case 'public':
        return PrivateKey.fromString(k.value).toPublicKey().toString();
      case 'private':
        return PrivateKey.fromString(k.value).toPublicKey().toString();
      case 'wif':
      case 'encryption':
        return PrivateKey.fromWif(k.value).toPublicKey().toString();
      default:
        return 'Unsupported key type';
    }
  } catch {
    return 'Invalid key format';
  }
}

/**
 * Derive address from key
 */
export function deriveAddress(k: KeyEntry): string {
  try {
    const pubKey = derivePublicKeyString(k);
    return PrivateKey.fromString(pubKey).toAddress().toString();
  } catch {
    return 'Invalid address derivation';
  }
}