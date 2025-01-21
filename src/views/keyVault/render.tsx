import { escapeHtml } from '@kitajs/html';
import type { KeyEntry } from '../../keyVault';
import { HD, PrivateKey } from '@bsv/sdk';

/** Build parent->child hierarchy from KeyEntry array without using forEach. */
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
    const p = k.metadata?.parentId;
    if (p && map[p]) {
      map[p].children.push(map[k.id]);
    } else {
      roots.push(map[k.id]);
    }
  }
  return roots;
}

/** Recursively render a KeyEntry card */
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

      {k.children?.map((c) => renderKeyRecursive(c, indent + 1))}
    </div>
  );
}

/** Possibly show bip32 path or type42 invoice/pub. */
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

/** Show the mnemonic phrase if type=mnemonic, else truncated value or derived pub. */
export function displayedKeyValue(k: KeyEntry): JSX.Element {
  if (k.type === 'mnemonic') {
    // Show the user’s full BIP39 phrase
    return k.value;
  }
  if (k.type === 'hdpublic') {
    const pub = derivePublicKeyString(k);
    return truncate(pub);
  }
  if (k.type === 'public') {
    const pub = derivePublicKeyString(k);
    return truncate(pub);
  }
  return truncate(k.value);
}

function truncate(val: string): string {
  if (val.length <= 10) return val;
  return `${val.slice(0, 4)}...${val.slice(-4)}`;
}

/** The small copy-badge row. */
function renderFormatBadges(k: KeyEntry): JSX.Element[] {
  const badges: JSX.Element[] = [];

  // mnemonic => [WORDS, XPRIV, XPUB]
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

  // Single private or 'public' => [HEX, WIF]
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

/** The big action row at top-right. */
export function renderActions(k: KeyEntry): JSX.Element[] {
  const arr: JSX.Element[] = [];
  const singlePriv =
    k.type === 'private' || k.type === 'wif' || k.type === 'encryption';

  const hdType =
    k.type === 'hdprivate' ||
    k.type === 'hdpublic' ||
    k.type === 'mnemonic';

  if (singlePriv) {
    arr.push(
      <button class="key-button" data-cmd="publicChild" data-id={k.id} type="button">
        PUB
      </button>,
      <button class="key-button" data-cmd="type42Child" data-id={k.id} type="button">
        Type42
      </button>,
    );
    if (!k.isEncryptionKey) {
      arr.push(
        <button class="key-button" data-cmd="setEncryptionKey" data-id={k.id} type="button">
          Set Default
        </button>,
      );
    }
  }
  if (hdType) {
    arr.push(
      <button class="key-button" data-cmd="bip32Child" data-id={k.id} type="button">
        BIP32
      </button>,
    );
  }
  arr.push(
    <button class="key-button" data-cmd="deleteKey" data-id={k.id} type="button">
      Delete
    </button>,
  );
  return arr;
}

/** Return xpub or single compressed pub. */
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

export function deriveHdAddress(k: KeyEntry, path: string): string {
  const hd = HD.fromString(k.value);
  const derived = hd.derive(path);
  if (!derived.privKey) {
    return '(no privkey at path)';
  }
  const priv = PrivateKey.fromHex(derived.privKey.toString());
  return priv.toAddress().toString();
}