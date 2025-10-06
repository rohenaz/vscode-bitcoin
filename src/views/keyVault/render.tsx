import { escapeHtml } from '@kitajs/html';
import type { KeyEntry } from '../../keyVault';
import { HD, PrivateKey, PublicKey, Utils } from '@bsv/sdk';
import { BAP, MemberID } from 'bsv-bap';

const { toArray, toHex, toBase58Check } = Utils;

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
    <div 
      class={`key-card ${indent ? `indent-${indent}` : ''}`} 
      data-keyid={k.id}
      data-is-encryption-key={k.isEncryptionKey}
      data-is-identity-key={k.isIdentityKey}
      data-is-funding-key={k.isFundingKey}
      data-is-ordinals-key={k.isOrdinalsKey}
    >
      <div class="key-top">
        <div class="key-type-container">
          <div class={`key-type type-${k.type}`}>{k.type}</div>
          {k.type === 'wif' && isTestnetKey(k) && (
            <div class="key-badge testnet">Testnet</div>
          )}
          {k.isEncryptionKey && <div class="key-badge encryption">Encryption Key</div>}
          {k.isIdentityKey && <div class="key-badge identity">Identity Key</div>}
          {k.isFundingKey && <div class="key-badge funding">Wallet</div>}
          {k.isOrdinalsKey && <div class="key-badge ordinals">Ordinals</div>}
          <div
            class="key-label"
            data-cmd="editLabel"
            data-id={k.id}
            data-currentlabel={k.label || ''}
          >
            {escapeHtml(k.label || '')}
          </div>
        </div>
        <div class="key-actions">{renderActions(k)}</div>
      </div>

      <div class="key-metadata" style="display: flex; justify-content: space-between;">
        <div safe>{new Date(k.timestamp).toLocaleString()}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          {renderChildMetadata(k)}
        </div>
      </div>

      <div class="key-value" style="display: flex; justify-content: space-between; align-items: center;">
        <div 
          style="
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.75rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          "
          title={displayedTitle(k)}
        >
          {displayedKeyValue(k)}
        </div>
        <div style="display: flex; gap: 6px;">
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
  if (k.keyShares && k.keyShares.length > 0) {
    return (
      <div style="font-size:0.85rem; color: var(--description-fg);">
        Key Shares: {k.keyShares.length} shares (threshold: {k.keyShareThreshold})
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
    const masked = '•'.repeat(phrase.length);
    return (
      <div class="secure-reveal">
        <span class="state-default" safe>{masked}</span>
        <span class="state-hover" safe>{customTruncate(phrase)}</span>
        <span class="state-mousedown" safe>{phrase}</span>
      </div>
    );
  }

  const displayValue = deriveValueForDisplay(k);
  const address = deriveAddressForKey(k);
  const masked = '•'.repeat(displayValue.length);

  return (
    <div class="secure-reveal">
      <span class="state-default" safe>{address || masked}</span>
      <span class="state-hover" safe>{customTruncate(displayValue)}</span>
      <span class="state-mousedown" safe>{displayValue}</span>
    </div>
  );
}

/**
 * Derive address or identity identifier for default display (security)
 */
function deriveAddressForKey(k: KeyEntry): string | null {
  try {
    // For identity keys, show the BAP idKey if available
    if (k.isIdentityKey) {
      // Check for BAP master key (has bapIds with multiple identities)
      if (k.metadata?.bapIds) {
        try {
          const idsObj = JSON.parse(k.metadata.bapIds);
          const idsList = idsObj.ids || [];
          if (idsList.length > 0) {
            // Show first identity's idKey
            return idsList[0].idKey || null;
          }
        } catch (e) {
          // Fall through to derive from key
        }
      }

      // Check for BAP member key (has single bapId)
      if (k.metadata?.bapId) {
        try {
          const member = MemberID.fromBackup({
            wif: k.value,
            id: k.metadata.bapId
          });
          return member.getIdentityKey() || null;
        } catch (e) {
          // Fall through to derive from key
        }
      }

      // Fallback: derive idKey from WIF for new identity keys
      if (k.type === 'wif') {
        try {
          const bap = new BAP({ rootPk: k.value });
          const identity = bap.newId('temp');
          return identity.getIdentityKey() || null;
        } catch (e) {
          // Fall through to address
        }
      }
    }

    // Only derive address for WIF keys (private keys we want to protect)
    if (k.type === 'wif') {
      const isTestnet = k.metadata?.network === 'testnet';
      return isTestnet ? deriveTestnetAddress(k) : deriveAddress(k);
    }
    return null; // Don't show address for other types, will show masked instead
  } catch (e) {
    return null;
  }
}

/**
 * Derive display value from key type
 */
function deriveValueForDisplay(k: KeyEntry): string {
  try {
    if (k.type === 'hdpublic') {
      const hd = HD.fromString(k.value).toPublic();
      return hd.toString();
    }
    if (k.type === 'public') {
      return k.value; // Already a public key string
    }
    return k.value;
  } catch (e) {
    console.error('Error deriving display value:', e);
    return k.value;
  }
}

/**
 * Custom truncation that shows dots equal to hidden characters
 */
function customTruncate(val: string): string {
  if (val.length <= 10) return val;
  const hiddenCount = val.length - 8; // chars replaced by dots
  const dots = '.'.repeat(hiddenCount);
  return val.slice(0, 4) + dots + val.slice(-4);
}

/**
 * Format badges based on key type
 */
function renderFormatBadges(k: KeyEntry): JSX.Element[] {
  const badges: JSX.Element[] = [];

  switch (k.type) {
    case 'mnemonic':
      badges.push(
        <button class="format-badge" data-cmd="copyWords" data-id={k.id} type="button" data-tooltip="Copy mnemonic words">
          WORDS
        </button>,
        <button class="format-badge" data-cmd="copyXprv" data-id={k.id} type="button" data-tooltip="Copy extended private key">
          XPRIV
        </button>,
        <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button" data-tooltip="Copy extended public key">
          XPUB
        </button>
      );
      break;

    case 'private':
    case 'wif':
    case 'encryption':
      badges.push(
        <button class="format-badge" data-cmd="copyWif" data-id={k.id} type="button" data-tooltip="Copy WIF format">
        WIF
        </button>,
        <button class="format-badge" data-cmd="copyHex" data-id={k.id} type="button" data-tooltip="Copy hex format">
          HEX
        </button>
      );
      if (k.type === 'wif') {
        const testnet = isTestnetKey(k);
        badges.push(
          <button
            class="format-badge"
            data-cmd={testnet ? 'copyTAddress' : 'copyAddress'}
            data-id={k.id}
            type="button"
            data-tooltip={testnet ? 'Copy testnet address' : 'Copy Bitcoin address'}
          >
            {testnet ? 'TADDR' : 'ADDR'}
          </button>
        );
      }
      break;

    case 'public':
      badges.push(
        <button class="format-badge" data-cmd="copyHex" data-id={k.id} type="button" data-tooltip="Copy hex format">
          HEX
        </button>,
        <button class="format-badge" data-cmd="copyAddress" data-id={k.id} type="button" data-tooltip="Copy Bitcoin address">
          ADDR
        </button>,
        <button class="format-badge" data-cmd="p2pkhScript" data-id={k.id} type="button" data-tooltip="Copy P2PKH script">
          P2PKH
        </button>
      );
      break;

    case 'hdprivate':
      badges.push(
        <button class="format-badge" data-cmd="copyXprv" data-id={k.id} type="button" data-tooltip="Copy extended private key">
          XPRIV
        </button>,
        <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button" data-tooltip="Copy extended public key">
          XPUB
        </button>
      );
      break;

    case 'hdpublic':
      badges.push(
        <button class="format-badge" data-cmd="copyXpub" data-id={k.id} type="button" data-tooltip="Copy extended public key">
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
  const singlePriv =
    k.type === 'private' ||
    k.type === 'wif' ||
    k.type === 'encryption';
  const hdType =
    k.type === 'hdprivate' ||
    k.type === 'hdpublic' ||
    k.type === 'mnemonic';

  if (singlePriv) {
    actions.push(
      <button
        class="key-button"
        data-cmd="publicChild"
        data-id={k.id}
        type="button"
        data-tooltip="Derive public key"
      >
        PUB
      </button>,
      <button
        class="key-button"
        data-cmd="type42Child"
        data-id={k.id}
        type="button"
        data-tooltip="Derive Type-42 child key"
      >
        Type42
      </button>,
    );
    if (!k.isEncryptionKey) {
      actions.push(
        <button
          class="key-button"
          data-cmd="setEncryptionKey"
          data-id={k.id}
          type="button"
          data-tooltip="Set as encryption key"
        >
          + Encryption
        </button>,
      );
    }
  }

  // Add key shares action for WIF keys
  if (k.type === 'wif') {
    if (k.keyShares && k.keyShares.length > 0) {
      actions.push(
        <button
          class="key-button"
          data-cmd="viewKeyShares"
          data-id={k.id}
          type="button"
          data-tooltip="View key shares"
        >
          Shares
        </button>
      );
    } else {
      actions.push(
        <button
          class="key-button"
          data-cmd="generateKeyShares"
          data-id={k.id}
          type="button"
          data-tooltip="Split key into shares (Shamir's Secret Sharing)"
        >
          Split
        </button>
      );
    }
  }

  if (hdType) {
    actions.push(
      <button
        class="key-button"
        data-cmd="bip32Child"
        data-id={k.id}
        type="button"
        data-tooltip="Derive BIP32 child key"
      >
        BIP32
      </button>,
    );
  }

  if (k.type === 'public') {
    actions.push(
      <button
        class="key-button"
        data-cmd="viewOnChain"
        data-id={k.id}
        type="button"
        data-tooltip="View on WhatsOnChain"
      >
        WoC
      </button>
    );
  }

  // Add "Set as Wallet Key" action for WIF keys
  if (k.type === 'wif' && !k.isFundingKey) {
    actions.push(
      <button
        class="key-button"
        data-cmd="setFundingKey"
        data-id={k.id}
        type="button"
      >
        + Wallet
      </button>
    );
  }

  // Add "Clear Wallet Key" action for wallet keys
  if (k.isFundingKey) {
    actions.push(
      <button
        class="key-button"
        data-cmd="clearFundingKey"
        data-id={k.id}
        type="button"
      >
        - Wallet
      </button>
    );
  }

  // Add "Set as Ordinals Key" action for WIF keys
  if (k.type === 'wif' && !k.isOrdinalsKey) {
    actions.push(
      <button
        class="key-button"
        data-cmd="setOrdinalsKey"
        data-id={k.id}
        type="button"
      >
        + Ord
      </button>
    );
  }

  // Add "Clear Ordinals Key" action for ordinals keys
  if (k.isOrdinalsKey) {
    actions.push(
      <button
        class="key-button"
        data-cmd="clearOrdinalsKey"
        data-id={k.id}
        type="button"
      >
        - Ord
      </button>
    );
  }

  // Add "Set as Identity Key" action for WIF keys
  if (k.type === 'wif' && !k.isIdentityKey) {
    actions.push(
      <button
        class="key-button"
        data-cmd="setIdentityKey"
        data-id={k.id}
        type="button"
      >
        + ID
      </button>
    );
  }

  // Add "Clear Identity Key" action for identity keys
  if (k.isIdentityKey) {
    actions.push(
      <button
        class="key-button"
        data-cmd="clearIdentityKey"
        data-id={k.id}
        type="button"
      >
        - ID
      </button>
    );
  }

  actions.push(
    <button
      class="key-button"
      data-cmd="deleteKey"
      data-id={k.id}
      type="button"
    >
      DEL
    </button>,
  );

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
 * Parse private key from key entry
 */
export function toPrivateKey(key: KeyEntry): PrivateKey | null {
  try {
    if (key.type === 'private') return PrivateKey.fromString(key.value);
    if (key.type === 'public') return PrivateKey.fromString(key.value);
    if (key.type === 'wif' || key.type === 'encryption') {
      return PrivateKey.fromWif(key.value);
    }
    if (key.type === 'hdprivate') {
      return PrivateKey.fromString(key.value);
    }
  } catch {
    return null;
  }
  return null;
}

/*
 * Derive public key string from single key types
 */
export function derivePublicKeyString(k: KeyEntry): string | null {
  return derivePublicKey(k)?.toString() ?? null;
}

export function derivePublicKey(k: KeyEntry): PublicKey | null {
  try {
    switch (k.type) {
      case 'hdpublic': {
        const hd = HD.fromString(k.value);
        return hd.pubKey;
      }
      case 'hdprivate': {
        const hd = HD.fromString(k.value);
        return hd.pubKey;
      }
      case 'public':
        return PublicKey.fromString(k.value);
      case 'private':
        return PrivateKey.fromString(k.value).toPublicKey();
      case 'wif':
      case 'encryption':
        return PrivateKey.fromWif(k.value).toPublicKey();
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Derive address from key
 */
export function deriveAddress(k: KeyEntry): string {
  try {
    const pubKey = derivePublicKey(k);
    const pkh = pubKey?.toHash() as number[] | undefined;
    if (!pkh) return 'Invalid address derivation';
    return toBase58Check(pkh, [0x00]);
  } catch {
    return 'Invalid address derivation';
  }
}

/**
 * Derive testnet address from key
 */
export function deriveTestnetAddress(k: KeyEntry): string {
  try {
    const pubKey = derivePublicKey(k);
    const pkh = pubKey?.toHash() as number[] | undefined;
    if (!pkh) return 'Invalid address derivation';
    return toBase58Check(pkh, [0x6f]);
  } catch {
    return 'Invalid address derivation';
  }
}

/**
 * Detect if key encodes a testnet value (only reliable for WIF)
 */
function isTestnetKey(k: KeyEntry): boolean {
  try {
    if (k.type === 'wif') {
      const res = Utils.fromBase58Check(k.value);
      const prefix = Array.isArray(res.prefix) ? res.prefix : [];
      // 0xef indicates testnet WIF
      return prefix.length > 0 && prefix[0] === 0xef;
    }
  } catch {
    // ignore
  }
  return false;
}