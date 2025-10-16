/**
 * Market Service
 * Fetches market data from 1sat.market API
 *
 * Types match 1sat-website/src/types/
 */

import { MARKET_API_HOST } from '../constants';

export type AssetType = 'ordinals' | 'bsv20' | 'bsv21';

// From 1sat-website/src/types/common.ts
export interface GPFile {
  hash: string;
  size: number;
  type: string;
}

// From 1sat-website/src/types/ordinals.ts
export interface Inscription {
  json?: any;
  text?: string;
  words?: string[];
  file: GPFile;
}

export interface SIGMA {
  vin: number;
  valid: boolean;
  address: string;
  algorithm: string;
  signature: string;
}

export interface TxoData {
  txid: string;
  vout: number;
  height: number;
  idx: number;
  satoshis: number;
  types?: string[];
  insc?: Inscription;
  map?: { [key: string]: any };
  b?: File;
  sigma?: SIGMA[];
  list?: {
    price: number;
    payout: string;
  };
  bsv20?: any;
}

// From 1sat-website/src/types/ordinals.ts - OrdUtxo
export interface OrdUtxo {
  txid: string;
  vout: number;
  outpoint: string;
  satoshis: number;
  accSats: number;
  owner?: string;
  script: string;
  spend?: string;
  origin?: {
    data?: TxoData;
    num?: string;
    outpoint: string;
    map?: { [key: string]: any };
    inum?: number;
  };
  height: number;
  idx: number;
  data?: TxoData;
  sale: boolean;
}

// From 1sat-website/src/components/pages/TokenMarket/list.tsx - Holder types
export interface Holder {
  address: string;
  amt: string;
}

export interface TickHolder {
  address: string;
  amt: number;
  pct: number;
}

export interface CombinedHolder {
  address: string;
  totalWeightedAmt: number;
  tokens: { [tokenTick: string]: { amt: number; weightedAmt: number } };
}

// From 1sat-website/src/components/pages/TokenMarket/list.tsx - MarketData
export interface MarketData {
  accounts: number;
  tick?: string;
  id: string;
  sym?: string;
  price: number;
  marketCap: number;
  holders: Holder[];
  dec: number;
  data: TxoData;
  pctChange: number;
  fundAddress: string;
  fundTotal: string;
  fundUsed: string;
  fundBalance: string;
  included: boolean;
  pendingOps: number;
  icon?: string;
  supply?: string;
  max?: string;
  txid: string;
  vout: number;
  amt?: string;
  num: number;
  contract?: "pow-20" | "LockToMintBsv20" | undefined;
  difficulty?: string | undefined;
  startingreward?: string | undefined;
  lastSaleHeight?: number;
}

export type SortBy = 'marketCap' | 'price' | 'holders' | 'pctChange' | 'recentSale';

class MarketService {
  /**
   * Fetch market listings for a given asset type
   * Returns MarketData[] for bsv20/bsv21, OrdUtxo[] for ordinals
   */
  async getMarketListings(
    assetType: AssetType,
    options?: {
      limit?: number;
      offset?: number;
      sort?: SortBy;
      dir?: 'asc' | 'desc';
    }
  ): Promise<MarketData[] | OrdUtxo[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.sort) params.append('sort', options.sort);
    if (options?.dir) params.append('dir', options.dir);

    const url = `${MARKET_API_HOST}/market/${assetType}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch market listings: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search market listings
   */
  async searchMarket(
    assetType: AssetType,
    term: string,
    sort?: SortBy
  ): Promise<MarketData[] | OrdUtxo[]> {
    const params = new URLSearchParams();
    if (sort) params.append('sort', sort);

    const url = `${MARKET_API_HOST}/market/${assetType}/search/${encodeURIComponent(term)}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to search market: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get details for a specific market listing
   */
  async getMarketListing(
    assetType: AssetType,
    id: string
  ): Promise<MarketData | OrdUtxo> {
    const url = `${MARKET_API_HOST}/market/${assetType}/${id}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch market listing: ${response.statusText}`);
    }

    return response.json();
  }
}

export const marketService = new MarketService();
