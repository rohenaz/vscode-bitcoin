import type { KeyVault, KeyEntry } from '../keyVault';
import type { WebviewView } from 'vscode';
import { ordinalsService } from './ordinalsService';
import type { NftUtxo, TokenUtxo } from 'js-1sat-ord';
import type { TokenBalance, Collection } from './ordinalsService';
import vsApi from '../vsShim';

export interface WalletState {
  fundingKey: {
    id: string;
    label?: string;
    payAddress: string;    // P2PKH address for payments
    ordAddress: string;    // Ordinals address (same key, different purpose)
  } | null;
  balance: {
    total: number;         // Total satoshis
    spendable: number;     // Excludes 1-sat ordinals
  };
  nfts: NftUtxo[];         // Standalone NFTs (not in collections)
  collections: Collection[]; // Grouped collections
  tokens: {
    bsv20: TokenBalance[];
    bsv21: TokenBalance[];
  };
  isLoading: boolean;
  loadingStates: {
    balance: boolean;
    nfts: boolean;
    bsv20: boolean;
    bsv21: boolean;
  };
  isVaultLocked: boolean;  // Track if vault is locked
  lastUpdate: number;
}

class WalletStateManager {
  private state: WalletState = {
    fundingKey: null,
    balance: { total: 0, spendable: 0 },
    nfts: [],
    collections: [],
    tokens: { bsv20: [], bsv21: [] },
    isLoading: false,
    loadingStates: {
      balance: false,
      nfts: false,
      bsv20: false,
      bsv21: false
    },
    isVaultLocked: true,
    lastUpdate: 0
  };

  private vault: KeyVault | null = null;
  private webview: WebviewView | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private vaultDisposable: { dispose: () => void } | null = null;
  private loadingFundingKey: boolean = false; // Guard against concurrent loads

  async initialize(vault: KeyVault, webview: WebviewView): Promise<void> {
    this.vault = vault;
    this.webview = webview;

    // Update vault lock status immediately using direct property check
    this.state.isVaultLocked = !vault.isUnlocked;
    this.pushState();

    // Load initial state
    await this.loadFundingKey();

    // Listen to vault changes (keys added/removed/modified)
    this.vaultDisposable = vault.onDidChangeKeys(() => this.onFundingKeyChanged());

    // Listen to vault unlock events and immediately update state
    vault.onDidUnlock(() => {
      console.log('[WalletState] Vault unlocked event - checking vault.isUnlocked:', vault.isUnlocked);
      this.state.isVaultLocked = !vault.isUnlocked;
      this.pushState();
      this.onVaultUnlocked();
    });

    // Setup auto-refresh if enabled
    this.setupAutoRefresh();
  }

  async loadFundingKey(): Promise<void> {
    if (!this.vault) return;

    // Prevent concurrent loads - this fixes the double password entry issue
    if (this.loadingFundingKey) {
      console.log('[WalletState] loadFundingKey already in progress, skipping');
      return;
    }

    this.loadingFundingKey = true;

    try {
      console.log('[WalletState] loadFundingKey - vault.isUnlocked:', this.vault.isUnlocked);

      // Update vault locked state using direct check - same as Key Vault does
      this.state.isVaultLocked = !this.vault.isUnlocked;
      this.pushState();

      const fundingKey = await this.vault.getFundingKey();
      const ordinalsKey = await this.vault.getOrdinalsKey();

      console.log('[WalletState] Got funding key:', fundingKey ? fundingKey.id : 'null');
      console.log('[WalletState] Got ordinals key:', ordinalsKey ? ordinalsKey.id : 'null');

      // Double-check lock state after getFundingKey (vault may have been unlocked during prompt)
      this.state.isVaultLocked = !this.vault.isUnlocked;
      console.log('[WalletState] After getFundingKey - vault.isUnlocked:', this.vault.isUnlocked);

      if (fundingKey && fundingKey.type === 'wif') {
        await this.setFundingKey(fundingKey, ordinalsKey);
      } else {
        this.clearFundingKey();
      }
    } catch (error) {
      console.error('Error loading funding key:', error);
      this.state.isVaultLocked = !this.vault.isUnlocked;
      this.state.isLoading = false;
      this.pushState();
      this.clearFundingKey();
    } finally {
      this.loadingFundingKey = false;
    }
  }

  private async setFundingKey(key: KeyEntry, ordinalsKey?: KeyEntry): Promise<void> {
    try {
      const payAddress = ordinalsService.deriveOrdAddress(key.value);
      const ordAddress = ordinalsKey && ordinalsKey.type === 'wif'
        ? ordinalsService.deriveOrdAddress(ordinalsKey.value)
        : payAddress;

      this.state.fundingKey = {
        id: key.id,
        label: key.label,
        payAddress: payAddress,
        ordAddress: ordAddress
      };

      console.log('[WalletState] setFundingKey - payAddress:', payAddress);
      console.log('[WalletState] setFundingKey - ordAddress:', ordAddress);
      console.log('[WalletState] setFundingKey - using separate ordinals key:', !!ordinalsKey);

      // Set loading state and push before fetching
      this.state.isLoading = true;
      this.pushState();

      // Fetch all wallet data
      await this.refreshAllData();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error setting funding key:', error);
      this.pushError(errorMessage);
    } finally {
      this.state.isLoading = false;
      this.pushState();
    }
  }

  private clearFundingKey(): void {
    this.state = {
      fundingKey: null,
      balance: { total: 0, spendable: 0 },
      nfts: [],
      collections: [],
      tokens: { bsv20: [], bsv21: [] },
      isLoading: false,
      loadingStates: {
        balance: false,
        nfts: false,
        bsv20: false,
        bsv21: false
      },
      isVaultLocked: this.state.isVaultLocked,
      lastUpdate: Date.now()
    };
    this.pushState();
  }

  async refreshAllData(): Promise<void> {
    if (!this.state.fundingKey) return;

    const startTime = Date.now();
    console.log('[WalletState] ⏱️ refreshAllData START');

    // Only set loading if not already set (manual refresh calls)
    if (!this.state.isLoading) {
      this.state.isLoading = true;
      this.pushState();
    }

    try {
      const { payAddress, ordAddress } = this.state.fundingKey;

      // Get configuration for what to fetch
      const config = vsApi.workspace.getConfiguration('bitcoin');
      const showNfts = config.get('wallet.showNfts', true);
      const showTokens = config.get('wallet.showTokens', true);

      console.log('[WalletState] ⏱️ Config loaded, starting progressive fetches...', {
        showNfts,
        showTokens,
        elapsed: Date.now() - startTime
      });

      // Fetch balance FIRST and update immediately (fastest, most important)
      this.state.loadingStates.balance = true;
      this.pushState();
      const balanceStart = Date.now();
      ordinalsService.getPaymentUtxos(payAddress).then(payUtxos => {
        const total = ordinalsService.calculateBalance(payUtxos);
        const spendable = ordinalsService.calculateSpendableBalance(payUtxos);
        this.state.balance = { total, spendable };
        this.state.loadingStates.balance = false;
        console.log('[WalletState] ⏱️ Balance updated in', Date.now() - balanceStart, 'ms');
        this.pushState(); // Update UI immediately with balance
      }).catch(error => {
        console.error('Error fetching balance:', error);
        this.state.loadingStates.balance = false;
        this.pushState();
      });

      // Fetch NFTs and update UI as soon as they arrive
      if (showNfts) {
        this.state.loadingStates.nfts = true;
        this.pushState();
        const nftStart = Date.now();
        ordinalsService.getNftUtxos(ordAddress).then(async nftUtxos => {
          console.log('[WalletState] ⏱️ Processing', nftUtxos.length, 'NFTs...');
          const { collections, standaloneNfts } = await ordinalsService.groupNftsByCollection(nftUtxos);
          this.state.collections = collections;
          this.state.nfts = standaloneNfts;
          this.state.loadingStates.nfts = false;
          console.log('[WalletState] ⏱️ NFT grouping completed in', Date.now() - nftStart, 'ms', {
            collections: collections.length,
            standalone: standaloneNfts.length
          });
          this.pushState(); // Update UI immediately with NFTs
        }).catch(error => {
          console.error('Error fetching NFTs:', error);
          this.state.nfts = [];
          this.state.collections = [];
          this.state.loadingStates.nfts = false;
          this.pushState();
        });
      } else {
        this.state.nfts = [];
        this.state.collections = [];
      }

      // Fetch BSV-20 tokens and update UI as soon as they arrive
      if (showTokens) {
        this.state.loadingStates.bsv20 = true;
        this.pushState();
        const bsv20Start = Date.now();
        ordinalsService.getBsv20Tokens(ordAddress).then(bsv20Tokens => {
          this.state.tokens.bsv20 = bsv20Tokens;
          this.state.loadingStates.bsv20 = false;
          console.log('[WalletState] ⏱️ BSV-20 tokens updated in', Date.now() - bsv20Start, 'ms', {
            count: bsv20Tokens.length
          });
          this.pushState(); // Update UI immediately with BSV-20 tokens
        }).catch(error => {
          console.error('Error fetching BSV-20 tokens:', error);
          this.state.tokens.bsv20 = [];
          this.state.loadingStates.bsv20 = false;
          this.pushState();
        });

        // Fetch BSV-21 tokens and update UI as soon as they arrive
        this.state.loadingStates.bsv21 = true;
        this.pushState();
        const bsv21Start = Date.now();
        ordinalsService.getBsv21Tokens(ordAddress).then(bsv21Tokens => {
          this.state.tokens.bsv21 = bsv21Tokens;
          this.state.loadingStates.bsv21 = false;
          console.log('[WalletState] ⏱️ BSV-21 tokens updated in', Date.now() - bsv21Start, 'ms', {
            count: bsv21Tokens.length
          });
          this.pushState(); // Update UI immediately with BSV-21 tokens
        }).catch(error => {
          console.error('Error fetching BSV-21 tokens:', error);
          this.state.tokens.bsv21 = [];
          this.state.loadingStates.bsv21 = false;
          this.pushState();
        });
      } else {
        this.state.tokens = { bsv20: [], bsv21: [] };
      }

      // Wait for all fetches to complete before clearing loading state
      const promises: Promise<any>[] = [
        ordinalsService.getPaymentUtxos(payAddress)
      ];

      if (showNfts) {
        promises.push(ordinalsService.getNftUtxos(ordAddress).then(nfts =>
          ordinalsService.groupNftsByCollection(nfts)
        ));
      }

      if (showTokens) {
        promises.push(ordinalsService.getBsv20Tokens(ordAddress));
        promises.push(ordinalsService.getBsv21Tokens(ordAddress));
      }

      await Promise.allSettled(promises);

      this.state.lastUpdate = Date.now();
      console.log('[WalletState] ⏱️ refreshAllData COMPLETE - Total time:', Date.now() - startTime, 'ms');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing wallet data:', error);
      this.pushError(errorMessage);
    } finally {
      this.state.isLoading = false;
      this.pushState();
    }
  }

  private async onFundingKeyChanged(): Promise<void> {
    console.log('[WalletState] onFundingKeyChanged triggered');
    await this.loadFundingKey();

    // Send specific notification about funding key change
    this.webview?.webview.postMessage({
      type: 'wallet:fundingKeyChanged',
      data: this.state
    });
  }

  private async onVaultUnlocked(): Promise<void> {
    console.log('[WalletState] onVaultUnlocked - immediately loading funding key');
    // Vault state already updated in event listener above
    // Just load the funding key and start fetching
    await this.loadFundingKey();
  }

  async checkVaultStatus(): Promise<void> {
    if (!this.vault) return;

    const wasLocked = this.state.isVaultLocked;
    const isNowLocked = !this.vault.isUnlocked;

    console.log('[WalletState] checkVaultStatus - wasLocked:', wasLocked, 'isNowLocked:', isNowLocked);

    // Always update state with current vault status
    this.state.isVaultLocked = isNowLocked;

    // If vault status changed, reload funding key
    if (wasLocked !== isNowLocked) {
      this.pushState(); // Push status change immediately
      await this.loadFundingKey();
    }
  }

  pushState(): void {
    console.log('[WalletState] pushState:', {
      isVaultLocked: this.state.isVaultLocked,
      hasFundingKey: !!this.state.fundingKey,
      fundingKeyId: this.state.fundingKey?.id
    });
    this.webview?.webview.postMessage({
      type: 'wallet:stateUpdate',
      data: this.state
    });
  }

  private pushError(error: string): void {
    this.webview?.webview.postMessage({
      type: 'wallet:error',
      data: { error }
    });
  }

  private setupAutoRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    const config = vsApi.workspace.getConfiguration('bitcoin');
    const enabled = config.get('wallet.autoRefresh', true);
    const interval = config.get('wallet.refreshInterval', 60000);

    if (enabled && interval > 0) {
      this.refreshTimer = setInterval(() => {
        if (this.state.fundingKey && !this.state.isLoading) {
          this.refreshAllData();
        }
      }, interval);
    }
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.vaultDisposable) {
      this.vaultDisposable.dispose();
      this.vaultDisposable = null;
    }
  }
}

export const walletState = new WalletStateManager();
