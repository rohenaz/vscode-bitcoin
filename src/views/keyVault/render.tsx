// src/views/keyVault/render.tsx
// This file contains typed-HTML components for displaying KeyEntry items,
// building a hierarchy, and rendering action buttons. It's often imported
// by index.tsx to show the Key Vault keys.

import type { KeyEntry } from '../../keyVault';
import { HD, PrivateKey } from '@bsv/sdk';
import { escapeHtml } from '@kitajs/html';

/**
 * Build a parent->child hierarchy from the array of KeyEntry.
 */
export function buildKeyHierarchy(
  all: KeyEntry[]
): Array<KeyEntry & { children: KeyEntry[] }> {
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
 * using data attributes for the script to handle commands (no inline onclick).
 */
export function renderKeyRecursive(
  k: KeyEntry & { children?: KeyEntry[] },
  indent: number
): JSX.Element {
  return (
    <div class={`key-card indent-${indent}`}>
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

      <div class="key-metadata">
        <div safe>{new Date(k.timestamp).toLocaleString()}</div>
        {k.isEncryptionKey && (
          <span class="encryption-key-badge">Default Encryption Key</span>
        )}
      </div>

      <div class="key-value">
        {displayedKeyValue(k)}
        <span
          class="copy-icon"
          data-cmd="copyEntireKey"
          data-id={k.id}
          title="Copy entire raw value"
        >
          📋
        </span>
      </div>

      {(k.children || []).map((child) => renderKeyRecursive(child, indent + 1))}
    </div>
  );
}

/**
 * Shows either a public or masked version of the key,
 * or a short form if it's too long. We escape HTML to avoid XSS.
 */
export function displayedKeyValue(k: KeyEntry): JSX.Element {
  // If it's hdpublic, we show the derived public key instead of the xprv data:
  let raw = k.value;
  if (k.type === 'hdpublic') {
    const hdPriv = HD.fromString(k.value);
    raw = hdPriv.toPublic().toString();
  }

  // Shorten if it's longer than 10 characters
  const output =
    raw.length > 10
      ? `${raw.slice(0, 4)}...${raw.slice(-4)}`
      : raw;

  return escapeHtml(output);
}

/**
 * Defines the action buttons for each key type.
 * For WIF/Private => Copy Address, PubKey, Type42, Delete, etc.
 * For HD => PubKey, BIP32, Delete, etc.
 */
export function renderActions(k: KeyEntry): JSX.Element[] {
  const isSinglePrivate =
    k.type === 'private' || k.type === 'wif' || k.type === 'encryption';
  const isHdKey =
    k.type === 'hdprivate' || k.type === 'hdpublic' || k.type === 'mnemonic';
  const isPublicType = (k.type === 'public' || k.type === 'hdpublic');

  const actions: JSX.Element[] = [];

  // If it's a single private key (WIF, private, or encryption),
  // we might show "Copy Private," etc. But if it's "public" or "hdpublic" alone, skip:
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

  // Always can do "Copy Public," "Copy Address," etc.
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
    </button>
  );

  // If it's an HD key (hdprivate or hdpublic or mnemonic),
  // show "deriveAddress"
  if (isHdKey) {
    actions.push(
      <button
        type="button"
        class="key-button"
        data-cmd="deriveAddress"
        data-id={k.id}
      >
        Derive Address
      </button>
    );
  }

  // "Derive Child (Type42)" always an option here for demonstration
  actions.push(
    <button
      type="button"
      class="key-button"
      data-cmd="type42Child"
      data-id={k.id}
    >
      Derive Child (Type42)
    </button>
  );

  // Optionally set encryption if it's a single private
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

  // Always allow delete
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

/**
 * Derive a public key string from a KeyEntry
 */
export function derivePublicKeyString(k: KeyEntry): string {
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

/**
 * Derive a single address from KeyEntry
 */
export function deriveAddress(k: KeyEntry): string {
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

/**
 * Derive an address from HD path
 */
export function deriveHdAddress(k: KeyEntry, path: string): string {
  const hdPriv = HD.fromString(k.value);
  const derived = hdPriv.derive(path);
  const privHex = derived.privKey.toString();
  const priv = PrivateKey.fromHex(privHex);
  return priv.toAddress().toString();
}

/**
 * Convert KeyEntry to PrivateKey if possible
 */
export function toPrivateKey(k: KeyEntry): PrivateKey | null {
  if (k.type === 'private') return PrivateKey.fromString(k.value);
  if (k.type === 'public') return PrivateKey.fromString(k.value);
  if (k.type === 'wif' || k.type === 'encryption') {
    return PrivateKey.fromWif(k.value);
  }
  if (k.type === 'hdprivate' || k.type === 'hdpublic') {
    const hdPriv = HD.fromString(k.value);
    return hdPriv.privKey;
  }
  return null;
}