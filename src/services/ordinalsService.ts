import {
  fetchPayUtxos,
  fetchNftUtxos,
  fetchTokenUtxos,
  TokenType,
  type Utxo,
  type NftUtxo,
  type TokenUtxo
} from 'js-1sat-ord';
import { PrivateKey } from '@bsv/sdk';
import { API_HOST } from '../constants';

export interface OrdinalData {
  origin: string;        // outpoint (txid_vout)
  outpoint: string;      // current outpoint
  data?: {
    insc?: {
      file?: {
        type?: string;  // content type
        size?: number;
        hash?: string;
      };
      text?: string;
      json?: any;
    };
    map?: Record<string, any>;  // MAP metadata
    bsv20?: {
      tick?: string;
      amt?: string;
      op?: string;
    };
  };
  satoshis: number;
  script: string;
  vout: number;
  txid: string;
}

export interface TokenBalance {
  protocol: 'BSV20' | 'BSV21';
  tokenId: string;
  tick?: string;       // BSV-20 ticker
  balance: number;     // decimal amount
  decimals: number;
  icon?: string;       // icon outpoint
  utxos: TokenUtxo[];
}

class OrdinalsService {
  private apiHost = API_HOST;

  /**
   * Fetch payment UTXOs (base64 encoded scripts by default)
   */
  async getPaymentUtxos(address: string): Promise<Utxo[]> {
    try {
      return await fetchPayUtxos(address, 'base64');
    } catch (error) {
      console.error('Error fetching payment UTXOs:', error);
      return [];
    }
  }

  /**
   * Fetch all NFT/Ordinals for an address
   */
  async getNftUtxos(ordAddress: string, collectionId?: string): Promise<NftUtxo[]> {
    try {
      return await fetchNftUtxos(ordAddress, collectionId);
    } catch (error) {
      console.error('Error fetching NFT UTXOs:', error);
      return [];
    }
  }

  /**
   * Fetch token UTXOs for a specific token
   */
  async getTokenUtxos(
    protocol: TokenType,
    tokenId: string,
    ordAddress: string
  ): Promise<TokenUtxo[]> {
    try {
      return await fetchTokenUtxos(protocol, tokenId, ordAddress);
    } catch (error) {
      console.error('Error fetching token UTXOs:', error);
      return [];
    }
  }

  /**
   * Get all BSV-20 tokens for an address
   */
  async getBsv20Tokens(ordAddress: string): Promise<TokenBalance[]> {
    try {
      const url = `${this.apiHost}/bsv20/${ordAddress}/balance`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      return this.parseTokenBalances(data, 'BSV20');
    } catch (error) {
      console.error('Error fetching BSV-20 tokens:', error);
      return [];
    }
  }

  /**
   * Get all BSV-21 tokens for an address
   */
  async getBsv21Tokens(ordAddress: string): Promise<TokenBalance[]> {
    try {
      // Note: API endpoint structure may differ for BSV-21
      // This is a placeholder - adjust based on actual API
      const url = `${this.apiHost}/bsv21/${ordAddress}/balance`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      return this.parseTokenBalances(data, 'BSV21');
    } catch (error) {
      console.error('Error fetching BSV-21 tokens:', error);
      return [];
    }
  }

  /**
   * Get all ordinals/inscriptions for an address
   * Returns both NFTs and regular inscriptions
   */
  async getOrdinals(ordAddress: string): Promise<OrdinalData[]> {
    try {
      const url = `${this.apiHost}/txos/address/${ordAddress}/unspent?bsv20=false`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const utxos = await response.json();
      // Filter for ordinals (those with inscription data)
      return utxos.filter((u: any) => u.data?.insc || u.data?.map);
    } catch (error) {
      console.error('Error fetching ordinals:', error);
      return [];
    }
  }

  /**
   * Calculate total balance from UTXOs
   */
  calculateBalance(utxos: Utxo[]): number {
    return utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
  }

  /**
   * Calculate spendable balance (exclude 1-sat ordinals)
   */
  calculateSpendableBalance(utxos: Utxo[]): number {
    return utxos
      .filter(u => u.satoshis > 1)
      .reduce((sum, utxo) => sum + utxo.satoshis, 0);
  }

  /**
   * Derive ordinals address from WIF
   */
  deriveOrdAddress(wif: string): string {
    try {
      const pk = PrivateKey.fromWif(wif);
      return pk.toAddress().toString();
    } catch (error) {
      console.error('Error deriving ordinals address:', error);
      throw error;
    }
  }

  /**
   * Parse token balances from API response
   */
  private parseTokenBalances(data: any, protocol: 'BSV20' | 'BSV21'): TokenBalance[] {
    try {
      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data.map((token: any) => ({
        protocol,
        tokenId: token.id || token.tokenId || '',
        tick: token.tick || token.symbol,
        balance: Number.parseFloat(token.balance || token.amt || '0'),
        decimals: Number.parseInt(token.dec || token.decimals || '0', 10),
        icon: token.icon,
        utxos: [] // Will be populated on-demand if needed
      }));
    } catch (error) {
      console.error('Error parsing token balances:', error);
      return [];
    }
  }
}

export const ordinalsService = new OrdinalsService();
