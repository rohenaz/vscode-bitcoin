// src/views/keyVault/render.tsx
// - "public" type also gets a "HEX" badge for copyHex
// - BIP32 path and Type42 metadata are displayed if present
// - "PUB" button is an action that triggers `publicChild` in script

import { escapeHtml } from '@kitajs/html';
import type { KeyEntry } from '../../keyVault';
import { HD, PrivateKey } from '@bsv/sdk';

/** Build parent->child hierarchy from KeyEntry array */
export function buildKeyHierarchy(
  all: KeyEntry[],
): Array<KeyEntry & { children: KeyEntry[] }> {
  const map: Record<string, KeyEntry & { children: KeyEntry[] }> = {};
  for (const k of all) {
    map[k.id] = { ...k, children: [] };
  }

  const roots: Array<KeyEntry & { children: KeyEntry[] }> = [];
  for (const k of all) {
    const p = k.metadata?.parentId;
    if (p && map[p]) {
      map[p].children.push(map[k.id]);
    } else {
      roots.push(map[k.id]);
    }
  }
  return roots;
}

/** The main recursive card rendering */
export function renderKeyRecursive(
  k: KeyEntry & { children?: KeyEntry[] },
  indent: number,
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

      <div class="key-metadata" style="display: flex; justify-content: space-between;">
        <div safe>{new Date(k.timestamp).toLocaleString()}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          {renderChildMetadata(k)}
          {k.isEncryptionKey && (
            <span class="encryption-key-badge">Default Encryption Key</span>
          )}
        </div>
      </div>

      <div
        class="key-value"
        style="display:flex; justify-content:space-between; align-items:center;"
      >
        <div style="overflow:hidden; text-overflow:ellipsis;">
          {displayedKeyValue(k)}
        </div>
        <div style="display:flex; gap:6px;">
          {renderFormatBadges(k)}
        </div>
      </div>

      {(k.children || []).map((c) => renderKeyRecursive(c, indent + 1))}
    </div>
  );
}

/** Display e.g. bip32Path or type42 metadata if present */
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
      <div safe style="font-size:0.85rem; color: var(--description-fg);">
        {m.type42OtherPub && <>OtherPub: {escapeHtml(m.type42OtherPub)}</>}
        {m.type42Invoice && <> / Invoice: {escapeHtml(m.type42Invoice)}</>}
      </div>
    );
  }
  return <></>;
}

/** Truncate or show derived pubkey if type=public/hdpublic */
export function displayedKeyValue(k: KeyEntry): JSX.Element {
  let raw: string;
  if (k.type === 'hdpublic') {
    raw = derivePublicKeyString(k); // xpub
  } else if (k.type === 'public') {
    raw = derivePublicKeyString(k); // single public hex
  } else {
    raw = k.value;
  }
  if (raw.length > 10) {
    return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
  }
  return raw;
}

/** The small copy badges for each format. */
function renderFormatBadges(k: KeyEntry): JSX.Element[] {
  const badges: JSX.Element[] = [];

  // Single private or "public" (since "public" holds private hex) => [HEX], [WIF]
  if (
    k.type === 'private' ||
    k.type === 'wif' ||
    k.type === 'encryption' ||
    k.type === 'public'
  ) {
    badges.push(
      <button class="format-badge" data-cmd="copyHex" data-id={k.id} type="button">
        HEX
      </button>,
    );
    badges.push(
      <button class="format-badge" data-cmd="copyWif" data-id={k.id} type="button">
        WIF
      </button>,
    );
  }

  // HD private & mnemonic => [XPRIV, XPUB]
  if (k.type === 'hdprivate' || k.type === 'mnemonic') {
    badges.push(
      <button class="format-badge" data-cmd="copyXprv" data-id={k.id} type="button">
        XPRIV
      </button>,
      <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button">
        XPUB
      </button>,
    );
  }

  // HD public => [XPUB]
  if (k.type === 'hdpublic') {
    badges.push(
      <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button">
        XPUB
      </button>,
    );
  }

  return badges;
}

/** Action buttons in the top-right (the "key-actions" row). */
export function renderActions(k: KeyEntry): JSX.Element[] {
  const arr: JSX.Element[] = [];
  const isSinglePriv =
    k.type === 'private' ||
    k.type === 'wif' ||
    k.type === 'encryption';

  const isHdType =
    k.type === 'hdprivate' ||
    k.type === 'hdpublic' ||
    k.type === 'mnemonic';

  // Single private => "PUB" => create a public child, "Type42", optional setEncryption
  if (isSinglePriv) {
    arr.push(
      <button
        class="key-button"
        data-cmd="publicChild"
        data-id={k.id}
        type="button"
      >
        PUB
      </button>,
      <button
        class="key-button"
        data-cmd="type42Child"
        data-id={k.id}
        type="button"
      >
        Type42
      </button>,
    );
    if (!k.isEncryptionKey) {
      arr.push(
        <button
          class="key-button"
          data-cmd="setEncryptionKey"
          data-id={k.id}
          type="button"
        >
          Set Default
        </button>,
      );
    }
  }

  // HD => "BIP32"
  if (isHdType) {
    arr.push(
      <button
        class="key-button"
        data-cmd="bip32Child"
        data-id={k.id}
        type="button"
      >
        BIP32
      </button>,
    );
  }

  // Delete
  arr.push(
    <button
      class="key-button"
      data-cmd="deleteKey"
      data-id={k.id}
      type="button"
    >
      Delete
    </button>,
  );

  return arr;
}

/** Convert KeyEntry => public key string (xpub or single pub hex). */
export function derivePublicKeyString(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    const hdPub = HD.fromString(k.value);
    return hdPub.toPublic().toString(); // xpub
  }
  if (k.type === 'hdprivate') {
    const hdPriv = HD.fromString(k.value);
    return hdPriv.toPublic().toString(); // xpub
  }
  if (k.type === 'public') {
    // interpret k.value as parent's private hex => get pub
    const priv = PrivateKey.fromString(k.value);
    return priv.toPublicKey().toString(); // single pub hex
  }
  if (k.type === 'private') {
    const pv = PrivateKey.fromString(k.value);
    return pv.toPublicKey().toString();
  }
  if (k.type === 'wif' || k.type === 'encryption') {
    const pv = PrivateKey.fromWif(k.value);
    return pv.toPublicKey().toString();
  }
  return '(unknown)';
}

/** Single address. For HD we also have deriveHdAddress if we want a path. */
export function deriveAddress(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    const pub = HD.fromString(k.value).toPublic();
    return pub.pubKey.toAddress().toString();
  }
  if (k.type === 'hdprivate') {
    const hd = HD.fromString(k.value);
    if (!hd.privKey) return '(no privkey)';
    const p = PrivateKey.fromHex(hd.privKey.toString());
    return p.toAddress().toString();
  }
  if (k.type === 'public') {
    // interpret k.value as private hex
    const priv = PrivateKey.fromString(k.value);
    return priv.toAddress().toString();
  }
  if (k.type === 'private') {
    const priv = PrivateKey.fromString(k.value);
    return priv.toAddress().toString();
  }
  if (k.type === 'wif' || k.type === 'encryption') {
    const pv = PrivateKey.fromWif(k.value);
    return pv.toAddress().toString();
  }
  return '(unknown)';
}

/** BIP32 path derivation for HD. */
export function deriveHdAddress(k: KeyEntry, path: string): string {
  const hd = HD.fromString(k.value);
  const derived = hd.derive(path);
  if (!derived.privKey) return '(no privkey at path)';
  const priv = PrivateKey.fromHex(derived.privKey.toString());
  return priv.toAddress().toString();
}

/** Convert KeyEntry => PrivateKey if possible. */
export function toPrivateKey(k: KeyEntry): PrivateKey | null {
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
    return hd.privKey || null;
  }
  return null;
}