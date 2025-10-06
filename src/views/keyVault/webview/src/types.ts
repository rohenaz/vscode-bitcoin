export type KeyType =
  | 'private'
  | 'public'
  | 'wif'
  | 'wif-testnet'
  | 'vanity'
  | 'vanity-testnet'
  | 'hdprivate'
  | 'hdpublic'
  | 'mnemonic'
  | 'encryption'
  | 'identity'
  | 'funding'
  | 'keyshare';

export interface KeyEntry {
  id: string;
  type: KeyType;
  label?: string;
  value: string;
  timestamp: number;
  metadata?: Record<string, string>;
  isEncryptionKey?: boolean;
  isIdentityKey?: boolean;
  isFundingKey?: boolean;
  isOrdinalsKey?: boolean;
  keyShares?: string[];
  keyShareThreshold?: number;
  parentKeyId?: string;
  children?: KeyEntry[];
}

export interface KeyVaultPayload {
  keys: KeyEntry[];
  searchIndex: Record<string, string[]>;
}
