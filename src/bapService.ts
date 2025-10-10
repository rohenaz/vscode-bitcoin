import vsApi from './vsShim';
import { BAP, MemberID } from 'bsv-bap';
import type { KeyEntry } from './keyVault';

export interface BapIdentity {
  '@context': string;
  '@type': string;
  alternateName?: string;
  banner?: string;
  description?: string;
  homeLocation?: {
    '@type': string;
    name: string;
  };
  image?: string;
  paymail?: string;
  url?: string;
}

export interface BapAddress {
  address: string;
  txId: string;
  block: number;
}

export interface BapProfile {
  idKey: string;
  firstSeen: number;
  rootAddress: string;
  currentAddress: string;
  addresses: BapAddress[];
  identity: BapIdentity;
}

export interface BapResponse {
  status: string;
  result: BapProfile;
}

export interface LocalIdentity {
  idKey: string;
  name: string;
  counter: number;
  rootAddress?: string;
  hasOnChainProfile: boolean;
}

export class BapService {
  private readonly baseUrl: string;
  private bap: BAP | null = null;
  private memberKey: any | null = null; // MemberID instance
  private isMasterKey: boolean = false;
  private localIdentities: Map<string, LocalIdentity> = new Map();

  constructor() {
    // Get the configured BAP indexer URL or use default
    this.baseUrl = vsApi.workspace
      .getConfiguration('bitcoin')
      .get('bapIndexerUrl', 'https://api.sigmaidentity.com');
  }

  /**
   * Initialize BAP with an identity key from the vault
   * Detects master vs member key based on metadata
   */
  async initializeWithKey(keyEntry: KeyEntry): Promise<void> {
    if (keyEntry.type !== 'wif') {
      throw new Error('BAP requires a WIF key');
    }

    // Check if this is a master key (has bapIds) or member key (has bapId)
    const bapIds = keyEntry.metadata?.bapIds;
    const bapId = keyEntry.metadata?.bapId;

    if (bapIds) {
      // Master key - can create and manage multiple identities
      this.isMasterKey = true;
      this.bap = new BAP({
        rootPk: keyEntry.value
      });

      // Import existing identities
      this.bap.importIds(bapIds);

      // Load identities into local map
      this.loadIdentitiesFromIds(bapIds);
    } else if (bapId) {
      // Member key - single identity, read-only
      this.isMasterKey = false;
      this.memberKey = MemberID.fromBackup({
        wif: keyEntry.value,
        id: bapId
      });

      // Add this single identity to local map
      const idKey = this.memberKey.getIdentityKey();
      this.localIdentities.set(idKey, {
        idKey,
        name: this.memberKey.idName || 'BAP Member Identity',
        counter: 0,
        rootAddress: this.memberKey.getRootAddress?.(),
        hasOnChainProfile: false
      });
    } else {
      // Regular WIF key with no BAP metadata - treat as potential master
      this.isMasterKey = true;
      this.bap = new BAP({
        rootPk: keyEntry.value
      });
    }
  }

  /**
   * Load identities from bapIds string into local map
   */
  private loadIdentitiesFromIds(bapIds: string): void {
    if (!this.bap) return;

    try {
      // Parse the ids structure to get identity count
      const idsObj = JSON.parse(bapIds);
      const idsList = idsObj.ids || [];

      // Load each identity
      idsList.forEach((id: any, index: number) => {
        const identity = this.bap!.getId(id.idKey);
        if (identity) {
          this.localIdentities.set(id.idKey, {
            idKey: id.idKey,
            name: id.idName || `Identity ${index}`,
            counter: index,
            rootAddress: id.rootAddress,
            hasOnChainProfile: false
          });
        }
      });
    } catch (error) {
      console.error('Error loading identities from bapIds:', error);
    }
  }

  /**
   * Check if initialized key is a master key (can create identities)
   */
  public isMaster(): boolean {
    return this.isMasterKey;
  }

  /**
   * Create a new identity with a given name (master key only)
   * Returns the identity and the updated bapIds string to persist
   */
  createIdentity(name: string, counter?: number): { localIdentity: LocalIdentity; updatedIds: string } | null {
    if (!this.isMasterKey || !this.bap) {
      throw new Error('Only master keys can create identities');
    }

    try {
      const identity = counter !== undefined
        ? this.bap.newIdWithCounter(counter, name)
        : this.bap.newId(name);

      const idKey = identity.getIdentityKey();

      const localIdentity: LocalIdentity = {
        idKey,
        name,
        counter: counter ?? this.localIdentities.size,
        rootAddress: identity.getRootAddress?.(),
        hasOnChainProfile: false
      };

      this.localIdentities.set(idKey, localIdentity);

      // Export updated ids to persist back to vault
      const updatedIds = this.bap.exportIds();

      return { localIdentity, updatedIds };
    } catch (error) {
      console.error('Error creating BAP identity:', error);
      return null;
    }
  }

  /**
   * Discover identities by checking sequential counters
   */
  async discoverIdentities(maxCounter: number = 10): Promise<LocalIdentity[]> {
    if (!this.bap) {
      throw new Error('BAP not initialized');
    }

    const discovered: LocalIdentity[] = [];

    for (let i = 0; i < maxCounter; i++) {
      try {
        const identity = this.bap.newIdWithCounter(i, `Identity ${i}`);
        const idKey = identity.getIdentityKey();

        // Check if this identity exists on-chain
        const profile = await this.getProfile(idKey).catch(() => null);

        if (profile) {
          const localIdentity: LocalIdentity = {
            idKey,
            name: profile.identity.alternateName || `Identity ${i}`,
            counter: i,
            rootAddress: profile.rootAddress,
            hasOnChainProfile: true
          };

          discovered.push(localIdentity);
          this.localIdentities.set(idKey, localIdentity);
        }
      } catch (error) {
        // Continue checking next counter
      }
    }

    return discovered;
  }

  /**
   * Get all local identities
   */
  getLocalIdentities(): LocalIdentity[] {
    return Array.from(this.localIdentities.values());
  }

  /**
   * Generate initial ID transaction for a new identity
   */
  getInitialIdTransaction(idKey: string): string | null {
    if (!this.bap) return null;

    try {
      const localIdentity = this.localIdentities.get(idKey);
      if (!localIdentity) return null;

      const identity = this.bap.newIdWithCounter(localIdentity.counter, localIdentity.name);
      return identity.getInitialIdTransaction();
    } catch (error) {
      console.error('Error generating ID transaction:', error);
      return null;
    }
  }

  /**
   * Clear local identities cache
   */
  clearLocal(): void {
    this.bap = null;
    this.localIdentities.clear();
  }

  /**
   * Get profile from BAP indexer
   */
  async getProfile(idKey: string): Promise<BapProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/identity/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idKey }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as BapResponse;

      if (data.status !== 'OK' || !data.result) {
        throw new Error('Failed to fetch BAP profile');
      }

      return data.result;
    } catch (error) {
      throw new Error(
        `Failed to fetch BAP profile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async validateByAddress(address: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/identity/validByAddress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as { status: string };
      return data.status === 'OK';
    } catch (error) {
      throw new Error(
        `Failed to validate address: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
