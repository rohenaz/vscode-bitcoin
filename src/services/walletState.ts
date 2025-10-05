import type { KeyVault, KeyEntry } from '../keyVault';
import type { WebviewView } from 'vscode';
import { ordinalsService } from './ordinalsService';
import type { NftUtxo, TokenUtxo } from 'js-1sat-ord';
import type { TokenBalance } from './ordinalsService';
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
  nfts: NftUtxo[];
  tokens: {
    bsv20: TokenBalance[];
    bsv21: TokenBalance[];
  };
  isLoading: boolean;
  isVaultLocked: boolean;  // Track if vault is locked
  lastUpdate: number;
}

class WalletStateManager {
  private state: WalletState = {
    fundingKey: null,
    balance: { total: 0, spendable: 0 },
    nfts: [],
    tokens: { bsv20: [], bsv21: [] },
    isLoading: false,
    isVaultLocked: true,
    lastUpdate: 0
  };

  private vault: KeyVault | null = null;
  private webview: WebviewView | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private vaultDisposable: { dispose: () => void } | null = null;

  async initialize(vault: KeyVault, webview: WebviewView): Promise<void> {
    this.vault = vault;
    this.webview = webview;

    // Load initial state
    await this.loadFundingKey();

    // Listen to vault changes
    this.vaultDisposable = vault.onDidChangeKeys(() => this.onFundingKeyChanged());

    // Setup auto-refresh if enabled
    this.setupAutoRefresh();
  }

  async loadFundingKey(): Promise<void> {
    if (!this.vault) return;

    try {
      console.log('[WalletState] loadFundingKey - vault.isUnlocked:', this.vault.isUnlocked);

      // Update vault locked state
      this.state.isVaultLocked = !this.vault.isUnlocked;

      const fundingKey = await this.vault.getFundingKey();
      console.log('[WalletState] Got funding key:', fundingKey ? fundingKey.id : 'null');

      // Update lock state after getFundingKey (vault may have been unlocked)
      this.state.isVaultLocked = !this.vault.isUnlocked;
      console.log('[WalletState] After getFundingKey - vault.isUnlocked:', this.vault.isUnlocked);

      if (fundingKey && fundingKey.type === 'wif') {
        await this.setFundingKey(fundingKey);
      } else {
        this.clearFundingKey();
      }
    } catch (error) {
      console.error('Error loading funding key:', error);
      this.state.isVaultLocked = !this.vault.isUnlocked;
      this.clearFundingKey();
    }
  }

  private async setFundingKey(key: KeyEntry): Promise<void> {
    this.state.isLoading = true;
    this.pushState();

    try {
      const ordAddress = ordinalsService.deriveOrdAddress(key.value);

      this.state.fundingKey = {
        id: key.id,
        label: key.label,
        payAddress: ordAddress,
        ordAddress: ordAddress
      };

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
      tokens: { bsv20: [], bsv21: [] },
      isLoading: false,
      isVaultLocked: this.state.isVaultLocked,
      lastUpdate: Date.now()
    };
    this.pushState();
  }

  async refreshAllData(): Promise<void> {
    if (!this.state.fundingKey) return;

    this.state.isLoading = true;
    this.pushState();

    try {
      const { payAddress, ordAddress } = this.state.fundingKey;

      // Get configuration for what to fetch
      const config = vsApi.workspace.getConfiguration('bitcoin');
      const showNfts = config.get('wallet.showNfts', true);
      const showTokens = config.get('wallet.showTokens', true);

      // Fetch data in parallel
      const promises: Promise<any>[] = [
        ordinalsService.getPaymentUtxos(payAddress)
      ];

      if (showNfts) {
        promises.push(ordinalsService.getNftUtxos(ordAddress));
      }

      if (showTokens) {
        promises.push(ordinalsService.getBsv20Tokens(ordAddress));
        promises.push(ordinalsService.getBsv21Tokens(ordAddress));
      }

      const results = await Promise.all(promises);

      let resultIndex = 0;
      const payUtxos = results[resultIndex++];

      // Calculate balances
      const total = ordinalsService.calculateBalance(payUtxos);
      const spendable = ordinalsService.calculateSpendableBalance(payUtxos);

      this.state.balance = { total, spendable };

      // Update NFTs if enabled
      if (showNfts) {
        this.state.nfts = results[resultIndex++];
      } else {
        this.state.nfts = [];
      }

      // Update tokens if enabled
      if (showTokens) {
        this.state.tokens = {
          bsv20: results[resultIndex++],
          bsv21: results[resultIndex++]
        };
      } else {
        this.state.tokens = { bsv20: [], bsv21: [] };
      }

      this.state.lastUpdate = Date.now();

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

  async checkVaultStatus(): Promise<void> {
    if (!this.vault) return;

    const wasLocked = this.state.isVaultLocked;
    const isNowLocked = !this.vault.isUnlocked;

    // If vault status changed, reload funding key
    if (wasLocked !== isNowLocked) {
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
