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
import { API_HOST, MARKET_API_HOST } from '../constants';

export interface TokenBalance {
  protocol: 'BSV20' | 'BSV21';
  tokenId: string;          // The id field from TokenUtxo
  tick?: string;           // BSV-20 ticker (if available from API)
  sym?: string;            // BSV-21 symbol (if available from API)
  balance: number;         // Actual token amount (amt / 10^decimals)
  decimals: number;        // Number of decimal places
  icon?: string;           // Icon origin/outpoint
  contract?: string;       // Contract type (e.g., "pow-20" for BSV-20, or BSV-21 contract)
  price?: number;          // Token price in BSV
  usdPrice?: number;       // Token price in USD
  utxos: TokenUtxo[];      // Underlying UTXOs
}

export interface Collection {
  id: string;              // Collection ID
  name?: string;           // Collection name from metadata
  description?: string;    // Collection description
  icon?: string;           // Collection icon
  items: NftUtxo[];        // NFTs in this collection
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
   * Uses same approach as 1sat-website
   */
  async getNftUtxos(ordAddress: string, collectionId?: string): Promise<NftUtxo[]> {
    try {
      // Fetch using same endpoint as 1sat-website
      let url = `${this.apiHost}/txos/address/${ordAddress}/unspent?limit=1000&offset=0&dir=DESC&status=all&bsv20=false`;

      if (collectionId) {
        url += `&q=${Buffer.from(JSON.stringify({map:{subTypeData:{collectionId}}})).toString('base64')}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error fetching NFT data for ${ordAddress}`);
      }

      const ordUtxos: any[] = await response.json();

      // Filter and map to NftUtxo format
      return ordUtxos
        .filter((item: any) =>
          item.satoshis === 1 && // 1-sat ordinals only
          !item.data?.list &&    // Exclude listings
          !item.data?.bsv20      // Exclude BSV20 tokens
        )
        .map((item: any) => {
          // Extract data from OrdUtxo structure
          const contentType = item.data?.insc?.file?.type || item.origin?.data?.insc?.file?.type || 'unknown';
          const collId = item.data?.map?.subTypeData?.collectionId || item.origin?.data?.map?.subTypeData?.collectionId;
          const origin = item.origin?.outpoint || `${item.txid}_${item.vout}`;

          // Extract metadata for display name (following 1sat-website artifact utility)
          const name = item.origin?.data?.map?.name ||
                       item.origin?.data?.map?.subTypeData?.name ||
                       item.origin?.data?.map?.app ||
                       item.data?.map?.name ||
                       item.data?.map?.subTypeData?.name ||
                       item.data?.map?.app;

          const num = item.origin?.num || item.origin?.inum;

          return {
            txid: item.txid,
            vout: item.vout,
            satoshis: 1,
            script: item.script,
            contentType,
            collectionId: collId,
            origin,
            name,
            num
          } as NftUtxo;
        });

    } catch (error) {
      console.error('Error fetching NFT UTXOs:', error);
      return [];
    }
  }

  /**
   * Group NFTs by collection
   * Returns collections and standalone NFTs separately
   */
  async groupNftsByCollection(nfts: NftUtxo[]): Promise<{
    collections: Collection[];
    standaloneNfts: NftUtxo[];
  }> {
    const startTime = Date.now();
    console.log('[OrdinalsService] ⏱️ groupNftsByCollection START -', nfts.length, 'NFTs');

    const collectionMap = new Map<string, NftUtxo[]>();
    const standalone: NftUtxo[] = [];

    // Group NFTs by collection ID
    for (const nft of nfts) {
      if (nft.collectionId) {
        if (!collectionMap.has(nft.collectionId)) {
          collectionMap.set(nft.collectionId, []);
        }
        collectionMap.get(nft.collectionId)!.push(nft);
      } else {
        standalone.push(nft);
      }
    }

    console.log('[OrdinalsService] ⏱️ Grouped into', collectionMap.size, 'collections and', standalone.length, 'standalone NFTs in', Date.now() - startTime, 'ms');

    // Convert to Collection objects with metadata (parallel fetch)
    const metadataStart = Date.now();
    console.log('[OrdinalsService] ⏱️ Fetching metadata for', collectionMap.size, 'collections in parallel...');

    const collectionEntries = Array.from(collectionMap.entries());
    const collections = await Promise.all(
      collectionEntries.map(async ([collectionId, items]) => {
        const fetchStart = Date.now();
        const metadata = await this.fetchCollectionMetadata(collectionId);
        console.log('[OrdinalsService] ⏱️ Fetched metadata for collection', collectionId, 'in', Date.now() - fetchStart, 'ms');

        return {
          id: collectionId,
          name: metadata?.name,
          description: metadata?.description,
          icon: metadata?.icon || items[0]?.origin,
          items
        };
      })
    );

    console.log('[OrdinalsService] ⏱️ All', collectionMap.size, 'collection metadata fetched in parallel in', Date.now() - metadataStart, 'ms');
    console.log('[OrdinalsService] ⏱️ groupNftsByCollection COMPLETE - Total time:', Date.now() - startTime, 'ms');

    return {
      collections: collections.sort((a, b) => b.items.length - a.items.length), // Sort by item count
      standaloneNfts: standalone
    };
  }

  /**
   * Fetch collection metadata from API
   */
  private async fetchCollectionMetadata(collectionId: string): Promise<any> {
    try {
      const url = `${this.apiHost}/collection/${collectionId}`;
      const response = await fetch(url);

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error(`Error fetching collection metadata for ${collectionId}:`, error);
      return null;
    }
  }

  /**
   * Get all BSV-20 tokens for an address
   */
  async getBsv20Tokens(ordAddress: string): Promise<TokenBalance[]> {
    try {
      // First get all ticks from the API
      const ticksUrl = `${this.apiHost}/bsv20/${ordAddress}/balance?bsv20=true`;
      const ticksResponse = await fetch(ticksUrl);
      if (!ticksResponse.ok) return [];

      const ticksData = await ticksResponse.json();
      const balances: TokenBalance[] = [];

      // For each tick, fetch metadata and UTXOs
      for (const item of ticksData) {
        if (!item.tick) continue; // BSV20 must have tick

        const tick = item.tick;

        // Fetch token UTXOs using js-1sat-ord
        const tokenUtxos = await fetchTokenUtxos(TokenType.BSV20, tick, ordAddress, 1000);

        if (tokenUtxos.length === 0) continue;

        // Fetch metadata
        const metadata = await this.fetchTokenMetadata('BSV20', tick);
        const decimals = metadata?.dec || 0;

        // Calculate balance from UTXOs
        const totalAmt = tokenUtxos.reduce((sum, u) => sum + BigInt(u.amt), BigInt(0));
        const balance = Number(totalAmt) / Math.pow(10, decimals);

        balances.push({
          protocol: 'BSV20',
          tokenId: tick,
          tick: tick,
          balance,
          decimals,
          icon: metadata?.icon,
          contract: metadata?.contract,
          utxos: tokenUtxos
        });
      }

      // Fetch market data for all ticks in batch
      await this.enrichWithMarketData(balances);

      return balances;
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
      // Get all token ids from the API
      const idsUrl = `${this.apiHost}/bsv20/${ordAddress}/balance?bsv20=true`;
      const idsResponse = await fetch(idsUrl);
      if (!idsResponse.ok) return [];

      const idsData = await idsResponse.json();
      const balances: TokenBalance[] = [];

      // For each id, fetch metadata and UTXOs
      for (const item of idsData) {
        if (item.tick) continue; // Skip BSV20 (has tick)
        if (!item.id) continue; // BSV21 must have id

        const tokenId = item.id;

        // Fetch token UTXOs using js-1sat-ord
        const tokenUtxos = await fetchTokenUtxos(TokenType.BSV21, tokenId, ordAddress, 1000);

        if (tokenUtxos.length === 0) continue;

        // Fetch metadata
        const metadata = await this.fetchTokenMetadata('BSV21', tokenId);
        const decimals = metadata?.dec || metadata?.decimals || 0;

        // Calculate balance from UTXOs
        const totalAmt = tokenUtxos.reduce((sum, u) => sum + BigInt(u.amt), BigInt(0));
        const balance = Number(totalAmt) / Math.pow(10, decimals);

        balances.push({
          protocol: 'BSV21',
          tokenId,
          sym: metadata?.sym || metadata?.symbol,
          balance,
          decimals,
          icon: metadata?.icon,
          contract: metadata?.contract,
          utxos: tokenUtxos
        });
      }

      // Note: BSV-21 tokens don't have market data on ticker/num endpoint
      // They would need a separate market endpoint

      return balances;
    } catch (error) {
      console.error('Error fetching BSV-21 tokens:', error);
      return [];
    }
  }

  /**
   * Fetch token metadata (ticker, symbol, decimals, icon) from API
   */
  private async fetchTokenMetadata(protocol: 'BSV20' | 'BSV21', tokenId: string): Promise<any> {
    try {
      const endpoint = protocol === 'BSV20' ? 'tick' : 'id';
      const url = `${this.apiHost}/bsv20/${endpoint}/${tokenId}`;
      const response = await fetch(url);

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${protocol} metadata for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Enrich token balances with market data (price, contract type) from 1sat market API
   */
  private async enrichWithMarketData(balances: TokenBalance[]): Promise<void> {
    try {
      const ticks = balances
        .filter(b => b.protocol === 'BSV20' && b.tick)
        .map(b => b.tick!);

      if (ticks.length === 0) return;

      // Fetch market data in batch from api.1sat.market
      const url = `${MARKET_API_HOST}/ticker/num`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: ticks })
      });

      if (!response.ok) {
        console.error('Failed to fetch market data:', response.statusText);
        return;
      }

      const marketData = await response.json();

      // Enrich balances with market data
      for (const balance of balances) {
        if (balance.protocol !== 'BSV20' || !balance.tick) continue;

        const market = marketData.find((m: any) => m.tick === balance.tick);
        if (market) {
          balance.price = market.price; // Price in satoshis per token
          balance.usdPrice = market.price ? (market.price * balance.balance) / 100000000 : undefined; // Convert sats to BSV then to value
          balance.contract = market.contract;
        }
      }
    } catch (error) {
      console.error('Error enriching with market data:', error);
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
}

export const ordinalsService = new OrdinalsService();
