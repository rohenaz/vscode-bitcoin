import { escapeHtml } from '@kitajs/html';
import type { KeyEntry } from '../../keyVault';
import { HD, PrivateKey } from '@bsv/sdk';

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

      <div
        class="key-value"
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          font-family: var(--vscode-editor-font-family, monospace);
          font-size: 0.8rem;
        "
      >
        {/* The truncated or full value + title for hover */}
        <div
          style="overflow:hidden; text-overflow:ellipsis;"
          title={displayedTitle(k)}
        >
          {displayedKeyValue(k)}
        </div>
        <div style="display:flex; gap:6px;">
          {renderFormatBadges(k)}
        </div>
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
 * For mnemonics, we just show the entire .value (which is the xprv),
 * but the actual words are in metadata. For other keys, we show the entire key or derived pub.
 */
function displayedTitle(k: KeyEntry): string {
  if (k.type === 'mnemonic') {
    // The user might want the entire xprv or phrase. We'll show xprv here
    return k.value;
  }
  if (k.type === 'hdpublic') {
    // show xpub
    return derivePublicKeyString(k);
  }
  if (k.type === 'public') {
    // single pub
    return derivePublicKeyString(k);
  }
  // otherwise just the raw .value
  return k.value;
}

/**
 * Show the "display" portion. For mnemonics, we show the entire phrase in plain text.
 * For others, we do a customTruncate unless short enough already.
 */
export function displayedKeyValue(k: KeyEntry): JSX.Element {
  if (k.type === 'mnemonic') {
    // Show the entire BIP39 phrase? Actually we store xprv in .value (some flows), but user wants the entire item.
    // The user said "Creating a mnemonic is supposed to show the phrase." The phrase is in metadata? Actually let's see.
    // We decided the entire .value is an xprv. The "words" are in metadata. But the user wants to see the phrase?
    // The user previously said they'd rather see the entire .value is the xprv, or the phrase? The code used to show just xprv. 
    // The user insisted "the phrase is displayed." So let's see if we want to read metadata?.mnemonicWords:
    const phrase = k.metadata?.mnemonicWords;
    if (phrase) {
      // if we have it, let's show the actual words
      return phrase;
    }
    // fallback to k.value if we don't have the words in metadata
    return k.value;
  }

  // For other key types, we do a custom truncation if the length > 10
  return customTruncate(deriveValueForDisplay(k));
}

/**
 * Derive the actual string to display (before truncation).
 * For HD public => we show the derived xpub, for single public => derived pub hex, else just k.value
 */
function deriveValueForDisplay(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    return derivePublicKeyString(k); // xpub
  }
  if (k.type === 'public') {
    return derivePublicKeyString(k); // single pub hex
  }
  // otherwise just k.value
  return k.value;
}

/**
 * Use a custom truncation approach that replaces the middle with the same number of dots
 * as the hidden characters. We show first 4 and last 4, unless it's short enough.
 */
function customTruncate(val: string): string {
  if (val.length <= 10) return val;
  const hiddenCount = val.length - 8; // those are the chars replaced by dots
  let dots = '';
  for (let i = 0; i < hiddenCount; i++) {
    dots += '.';
  }
  return val.slice(0, 4) + dots + val.slice(-4);
}

/**
 * The small format badges row next to the truncated value.
 * For single private/public => [HEX, WIF, ADDR].
 * For mnemonic => [WORDS, XPRIV, XPUB].
 * For HD private => [XPRIV, XPUB].
 * For HD public => [XPUB].
 */
function renderFormatBadges(k: KeyEntry): JSX.Element[] {
  const badges: JSX.Element[] = [];

  if (k.type === 'mnemonic') {
    badges.push(
      <button class="format-badge" data-cmd="copyWords" data-id={k.id} type="button">
        WORDS
      </button>,
      <button class="format-badge" data-cmd="copyXprv" data-id={k.id} type="button">
        XPRIV
      </button>,
      <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button">
        XPUB
      </button>,
    );
    return badges;
  }

  // Single private/public/wif/encryption => [HEX, WIF], if wif or public => ADDR
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
      <button class="format-badge" data-cmd="copyWif" data-id={k.id} type="button">
        WIF
      </button>,
    );
    // For WIF or Public => also an "ADDR" button
    if (k.type === 'wif' || k.type === 'public') {
      badges.push(
        <button class="format-badge" data-cmd="copyAddress" data-id={k.id} type="button">
          ADDR
        </button>,
      );
    }
  }

  // HD private => [XPRIV, XPUB]
  if (k.type === 'hdprivate') {
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

/**
 * The top-right row of action buttons.
 */
export function renderActions(k: KeyEntry): JSX.Element[] {
  const buttons: JSX.Element[] = [];
  const singlePriv =
    k.type === 'private' ||
    k.type === 'wif' ||
    k.type === 'encryption';

  const hdType =
    k.type === 'hdprivate' ||
    k.type === 'hdpublic' ||
    k.type === 'mnemonic';

  if (singlePriv) {
    buttons.push(
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
      buttons.push(
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

  if (hdType) {
    buttons.push(
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

  buttons.push(
    <button
      class="key-button"
      data-cmd="deleteKey"
      data-id={k.id}
      type="button"
    >
      Delete
    </button>,
  );

  return buttons;
}

/**
 * Return xpub or single compressed pub string for HD or single keys.
 */
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
    const priv = PrivateKey.fromString(k.value);
    return priv.toPublicKey().toString();
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

/**
 * Single address for simple keys or root address for HD.
 */
export function deriveAddress(k: KeyEntry): string {
  if (k.type === 'hdpublic') {
    const hd = HD.fromString(k.value).toPublic();
    return hd.pubKey.toAddress().toString();
  }
  if (k.type === 'hdprivate') {
    const hd = HD.fromString(k.value);
    if (!hd.privKey) return '(no privkey)';
    const p = PrivateKey.fromHex(hd.privKey.toString());
    return p.toAddress().toString();
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
    const pv = PrivateKey.fromWif(k.value);
    return pv.toAddress().toString();
  }
  return '(unknown)';
}

/**
 * Derive address from HD path.
 */
export function deriveHdAddress(k: KeyEntry, path: string): string {
  const hd = HD.fromString(k.value);
  const derived = hd.derive(path.replace(/'/g, 'h'));
  if (!derived.privKey) {
    return '(no privkey at path)';
  }
  const priv = PrivateKey.fromHex(derived.privKey.toString());
  return priv.toAddress().toString();
}

/**
 * Convert KeyEntry => PrivateKey if possible.
 */
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