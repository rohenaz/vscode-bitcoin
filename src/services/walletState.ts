import type { KeyVault, KeyEntry } from '../keyVault';
import type { WebviewView } from 'vscode';
import { ordinalsService } from './ordinalsService';
import type { NftUtxo } from 'js-1sat-ord';
import type { TokenBalance, Collection } from './ordinalsService';
import vsApi from '../vsShim';

export interface WalletState {
  fundingKey: {
    id: string;
    label?: string;
    payAddress: string;    // P2PKH address for payments
    ordAddress: string;    // Ordinals address (same key, different purpose)
  } | null;
  hasFundingKey: boolean;  // Track if funding key exists
  hasOrdinalsKey: boolean; // Track if ordinals key exists
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
  settings: {
    showBsv20: boolean;
    showBsv21: boolean;
    autoBroadcast: boolean;
  };
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
    hasFundingKey: false,
    hasOrdinalsKey: false,
    balance: { total: 0, spendable: 0 },
    nfts: [],
    collections: [],
    tokens: { bsv20: [], bsv21: [] },
    settings: {
      showBsv20: false,
      showBsv21: true,
      autoBroadcast: false
    },
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
  private configDisposable: { dispose: () => void } | null = null;

  // AbortControllers for cancelling in-flight requests
  private balanceAbortController: AbortController | null = null;
  private nftsAbortController: AbortController | null = null;
  private bsv20AbortController: AbortController | null = null;
  private bsv21AbortController: AbortController | null = null;

  async initialize(vault: KeyVault, webview: WebviewView): Promise<void> {
    this.vault = vault;
    this.webview = webview;

    // Update vault lock status immediately using direct property check
    this.state.isVaultLocked = !vault.isUnlocked;
    this.pushState();

    // Don't load funding key automatically - wait for explicit request from wallet tab
    // await this.loadFundingKey();

    // Listen to vault changes (keys added/removed/modified)
    this.vaultDisposable = vault.onDidChangeKeys(() => this.onFundingKeyChanged());

    // Listen to vault unlock events and immediately update state
    vault.onDidUnlock(() => {
      console.log('[WalletState] Vault unlocked event - checking vault.isUnlocked:', vault.isUnlocked);
      this.state.isVaultLocked = !vault.isUnlocked;
      this.pushState();
      // Don't automatically load funding key on unlock - wait for user to switch to wallet tab
      // this.onVaultUnlocked();
    });

    // Listen to configuration changes for token settings
    this.configDisposable = vsApi.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('bitcoin.wallet.showBsv20')) {
        console.log('[WalletState] BSV-20 setting changed, refreshing BSV-20 tokens only');
        this.refreshBsv20();
      }
      if (e.affectsConfiguration('bitcoin.wallet.showBsv21')) {
        console.log('[WalletState] BSV-21 setting changed, refreshing BSV-21 tokens only');
        this.refreshBsv21();
      }
    });

    // Setup auto-refresh if enabled
    this.setupAutoRefresh();
  }

  async loadFundingKey(shouldRefresh = true): Promise<void> {
    if (!this.vault) return;

    try {
      // Update vault locked state
      this.state.isVaultLocked = !this.vault.isUnlocked;

      const fundingKey = await this.vault.getFundingKey();
      const ordinalsKey = await this.vault.getOrdinalsKey();

      // Update state based on what keys we have
      if ((fundingKey && fundingKey.type === 'wif') || (ordinalsKey && ordinalsKey.type === 'wif')) {
        await this.setFundingKey(fundingKey, ordinalsKey, shouldRefresh);
      } else {
        this.clearFundingKey();
      }
    } catch (error) {
      console.error('[WalletState] Error loading funding key:', error);
      this.state.isVaultLocked = !this.vault.isUnlocked;
      this.clearFundingKey();
      this.pushState();
    }
  }

  private async setFundingKey(key: KeyEntry | undefined, ordinalsKey?: KeyEntry, shouldRefresh = true): Promise<void> {
    try {
      // Derive addresses from available keys
      const payAddress = key && key.type === 'wif'
        ? ordinalsService.deriveOrdAddress(key.value)
        : (ordinalsKey && ordinalsKey.type === 'wif' ? ordinalsService.deriveOrdAddress(ordinalsKey.value) : '');

      const ordAddress = ordinalsKey && ordinalsKey.type === 'wif'
        ? ordinalsService.deriveOrdAddress(ordinalsKey.value)
        : payAddress;

      // Use whichever key is available for ID and label
      const primaryKey = key || ordinalsKey;
      if (!primaryKey) {
        this.clearFundingKey();
        return;
      }

      this.state.fundingKey = {
        id: primaryKey.id,
        label: primaryKey.label,
        payAddress: payAddress,
        ordAddress: ordAddress
      };

      // Track which keys we have
      this.state.hasFundingKey = !!(key && key.type === 'wif');
      this.state.hasOrdinalsKey = !!(ordinalsKey && ordinalsKey.type === 'wif');

      // Clear data for keys that don't exist anymore
      if (!this.state.hasFundingKey) {
        this.balanceAbortController?.abort();
        this.balanceAbortController = null;
        this.state.balance = { total: 0, spendable: 0 };
        this.state.loadingStates.balance = false;
      }
      if (!this.state.hasOrdinalsKey) {
        this.nftsAbortController?.abort();
        this.nftsAbortController = null;
        this.bsv20AbortController?.abort();
        this.bsv20AbortController = null;
        this.bsv21AbortController?.abort();
        this.bsv21AbortController = null;
        this.state.nfts = [];
        this.state.collections = [];
        this.state.tokens = { bsv20: [], bsv21: [] };
        this.state.loadingStates.nfts = false;
        this.state.loadingStates.bsv20 = false;
        this.state.loadingStates.bsv21 = false;
      }

      // Push state immediately so UI updates right away
      this.pushState();

      // Fetch wallet data if requested (default behavior for initial load)
      if (shouldRefresh) {
        await this.refreshAllData();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error setting funding key:', error);
      this.pushError(errorMessage);
    }
  }

  private clearFundingKey(): void {
    // Abort all in-flight requests immediately
    this.abortAllRequests();

    const isVaultLocked = this.state.isVaultLocked;
    const currentSettings = this.state.settings;

    this.state = {
      fundingKey: null,
      hasFundingKey: false,
      hasOrdinalsKey: false,
      balance: { total: 0, spendable: 0 },
      nfts: [],
      collections: [],
      tokens: { bsv20: [], bsv21: [] },
      settings: currentSettings,
      loadingStates: {
        balance: false,
        nfts: false,
        bsv20: false,
        bsv21: false
      },
      isVaultLocked: isVaultLocked,
      lastUpdate: Date.now()
    };
    this.pushState();
  }

  private abortAllRequests(): void {
    console.log('[WalletState] Aborting all in-flight requests');
    this.balanceAbortController?.abort();
    this.balanceAbortController = null;
    this.nftsAbortController?.abort();
    this.nftsAbortController = null;
    this.bsv20AbortController?.abort();
    this.bsv20AbortController = null;
    this.bsv21AbortController?.abort();
    this.bsv21AbortController = null;
  }

  async refreshBalance(): Promise<void> {
    if (!this.state.fundingKey) return;

    const { payAddress } = this.state.fundingKey;

    if (this.state.hasFundingKey && payAddress) {
      // Abort any existing balance request
      this.balanceAbortController?.abort();
      this.balanceAbortController = new AbortController();
      const controller = this.balanceAbortController;

      this.state.loadingStates.balance = true;
      this.pushState();

      try {
        const payUtxos = await ordinalsService.getPaymentUtxos(payAddress);

        // Check if this request was aborted
        if (controller.signal.aborted) {
          console.log('[WalletState] Balance request aborted, ignoring results');
          return;
        }

        const total = ordinalsService.calculateBalance(payUtxos);
        const spendable = ordinalsService.calculateSpendableBalance(payUtxos);
        this.state.balance = { total, spendable };
        console.log('[WalletState] Balance updated:', { total, spendable });
      } catch (error) {
        if (controller.signal.aborted) {
          console.log('[WalletState] Balance request aborted');
          return;
        }
        console.error('Error fetching balance:', error);
        this.state.balance = { total: 0, spendable: 0 };
      } finally {
        if (!controller.signal.aborted) {
          this.state.loadingStates.balance = false;
          this.pushState();
        }
      }
    } else {
      this.state.balance = { total: 0, spendable: 0 };
      this.state.loadingStates.balance = false;
      this.pushState();
    }
  }

  async refreshNfts(): Promise<void> {
    if (!this.state.fundingKey) return;

    const { ordAddress } = this.state.fundingKey;
    const config = vsApi.workspace.getConfiguration('bitcoin');
    const showNfts = config.get('wallet.showNfts', true);

    if (this.state.hasOrdinalsKey && ordAddress && showNfts) {
      // Abort any existing NFTs request
      this.nftsAbortController?.abort();
      this.nftsAbortController = new AbortController();
      const controller = this.nftsAbortController;

      this.state.loadingStates.nfts = true;
      this.pushState();

      try {
        const nftUtxos = await ordinalsService.getNftUtxos(ordAddress);

        // Check if this request was aborted
        if (controller.signal.aborted) {
          console.log('[WalletState] NFTs request aborted, ignoring results');
          return;
        }

        const { collections, standaloneNfts } = await ordinalsService.groupNftsByCollection(nftUtxos);

        if (controller.signal.aborted) {
          console.log('[WalletState] NFTs request aborted after grouping, ignoring results');
          return;
        }

        this.state.collections = collections;
        this.state.nfts = standaloneNfts;
        console.log('[WalletState] NFTs updated:', { collections: collections.length, standalone: standaloneNfts.length });
      } catch (error) {
        if (controller.signal.aborted) {
          console.log('[WalletState] NFTs request aborted');
          return;
        }
        console.error('Error fetching NFTs:', error);
        this.state.nfts = [];
        this.state.collections = [];
      } finally {
        if (!controller.signal.aborted) {
          this.state.loadingStates.nfts = false;
          this.pushState();
        }
      }
    } else {
      this.state.nfts = [];
      this.state.collections = [];
      this.state.loadingStates.nfts = false;
      this.pushState();
    }
  }

  async refreshBsv20(): Promise<void> {
    if (!this.state.fundingKey) return;

    const { ordAddress } = this.state.fundingKey;
    const config = vsApi.workspace.getConfiguration('bitcoin');
    const showTokens = config.get('wallet.showTokens', true);
    const showBsv20 = config.get('wallet.showBsv20', false);

    if (this.state.hasOrdinalsKey && ordAddress && showTokens) {
      if (showBsv20) {
        // Abort any existing BSV-20 request
        this.bsv20AbortController?.abort();
        this.bsv20AbortController = new AbortController();
        const bsv20Controller = this.bsv20AbortController;

        this.state.loadingStates.bsv20 = true;
        this.pushState();
        try {
          const bsv20Tokens = await ordinalsService.getBsv20Tokens(ordAddress);

          if (bsv20Controller.signal.aborted) {
            console.log('[WalletState] BSV-20 request aborted, ignoring results');
            return;
          }

          this.state.tokens.bsv20 = bsv20Tokens;
          console.log('[WalletState] BSV-20 tokens updated:', bsv20Tokens.length);
        } catch (error) {
          if (bsv20Controller.signal.aborted) {
            console.log('[WalletState] BSV-20 request aborted');
            return;
          }
          console.error('Error fetching BSV-20 tokens:', error);
          this.state.tokens.bsv20 = [];
        } finally {
          if (!bsv20Controller.signal.aborted) {
            this.state.loadingStates.bsv20 = false;
            this.pushState();
          }
        }
      } else {
        this.state.tokens.bsv20 = [];
        this.state.loadingStates.bsv20 = false;
        this.pushState();
      }
    } else {
      this.state.tokens.bsv20 = [];
      this.state.loadingStates.bsv20 = false;
      this.pushState();
    }
  }

  async refreshBsv21(): Promise<void> {
    if (!this.state.fundingKey) return;

    const { ordAddress } = this.state.fundingKey;
    const config = vsApi.workspace.getConfiguration('bitcoin');
    const showTokens = config.get('wallet.showTokens', true);
    const showBsv21 = config.get('wallet.showBsv21', true);

    if (this.state.hasOrdinalsKey && ordAddress && showTokens) {
      if (showBsv21) {
        // Abort any existing BSV-21 request
        this.bsv21AbortController?.abort();
        this.bsv21AbortController = new AbortController();
        const bsv21Controller = this.bsv21AbortController;

        this.state.loadingStates.bsv21 = true;
        this.pushState();
        try {
          const bsv21Tokens = await ordinalsService.getBsv21Tokens(ordAddress);

          if (bsv21Controller.signal.aborted) {
            console.log('[WalletState] BSV-21 request aborted, ignoring results');
            return;
          }

          this.state.tokens.bsv21 = bsv21Tokens;
          console.log('[WalletState] BSV-21 tokens updated:', bsv21Tokens.length);
        } catch (error) {
          if (bsv21Controller.signal.aborted) {
            console.log('[WalletState] BSV-21 request aborted');
            return;
          }
          console.error('Error fetching BSV-21 tokens:', error);
          this.state.tokens.bsv21 = [];
        } finally {
          if (!bsv21Controller.signal.aborted) {
            this.state.loadingStates.bsv21 = false;
            this.pushState();
          }
        }
      } else {
        this.state.tokens.bsv21 = [];
        this.state.loadingStates.bsv21 = false;
        this.pushState();
      }
    } else {
      this.state.tokens.bsv21 = [];
      this.state.loadingStates.bsv21 = false;
      this.pushState();
    }
  }

  async refreshAllData(): Promise<void> {
    if (!this.state.fundingKey) return;

    const startTime = Date.now();
    console.log('[WalletState] ⏱️ refreshAllData START');

    try {
      // Call all refresh methods in parallel - each manages its own loading state
      await Promise.all([
        this.refreshBalance(),
        this.refreshNfts(),
        this.refreshBsv20(),
        this.refreshBsv21()
      ]);

      this.state.lastUpdate = Date.now();
      console.log('[WalletState] ⏱️ refreshAllData COMPLETE - Total time:', Date.now() - startTime, 'ms');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing wallet data:', error);
      this.pushError(errorMessage);
    }
  }

  private async onFundingKeyChanged(): Promise<void> {
    // Remember what we had before
    const oldPayAddress = this.state.fundingKey?.payAddress || null;
    const oldOrdAddress = this.state.fundingKey?.ordAddress || null;
    const hadFundingKey = this.state.hasFundingKey;
    const hadOrdinalsKey = this.state.hasOrdinalsKey;

    // Reload keys (without auto-refresh - we'll do selective refresh below)
    await this.loadFundingKey(false);

    // Detect what changed
    const newPayAddress = this.state.fundingKey?.payAddress || null;
    const newOrdAddress = this.state.fundingKey?.ordAddress || null;

    const fundingKeyAdded = !hadFundingKey && this.state.hasFundingKey;
    const fundingKeyReplaced = hadFundingKey && this.state.hasFundingKey && (oldPayAddress !== newPayAddress);
    const ordinalsKeyAdded = !hadOrdinalsKey && this.state.hasOrdinalsKey;
    const ordinalsKeyReplaced = hadOrdinalsKey && this.state.hasOrdinalsKey && (oldOrdAddress !== newOrdAddress);

    // Selectively refresh only what changed
    const needsFundingRefresh = fundingKeyAdded || fundingKeyReplaced;
    const needsOrdinalsRefresh = ordinalsKeyAdded || ordinalsKeyReplaced;

    if (needsFundingRefresh && !needsOrdinalsRefresh) {
      await this.refreshBalance();
    } else if (needsOrdinalsRefresh && !needsFundingRefresh) {
      await Promise.all([this.refreshNfts(), this.refreshBsv20(), this.refreshBsv21()]);
    } else if (needsFundingRefresh && needsOrdinalsRefresh) {
      await this.refreshAllData();
    }

    // Notify UI of final state
    this.webview?.webview.postMessage({
      type: 'wallet:fundingKeyChanged',
      data: this.state
    });
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
    } else {
      // Even if status didn't change, push current state to update UI
      this.pushState();
    }
  }

  pushState(): void {
    if (!this.webview) return;

    // Read settings before pushing
    const config = vsApi.workspace.getConfiguration('bitcoin');
    this.state.settings = {
      showBsv20: config.get('wallet.showBsv20', false),
      showBsv21: config.get('wallet.showBsv21', true),
      autoBroadcast: config.get('wallet.autoBroadcast', false)
    };

    this.webview.webview.postMessage({
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
        // Check if any data is currently loading before refreshing
        const isAnyLoading = this.state.loadingStates.balance ||
                            this.state.loadingStates.nfts ||
                            this.state.loadingStates.bsv20 ||
                            this.state.loadingStates.bsv21;

        if (this.state.fundingKey && !isAnyLoading) {
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

    if (this.configDisposable) {
      this.configDisposable.dispose();
      this.configDisposable = null;
    }
  }
}

export const walletState = new WalletStateManager();
