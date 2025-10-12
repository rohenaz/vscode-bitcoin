import {
  type Distribution,
  type Payment,
  TokenInputMode,
  TokenSelectionStrategy,
  TokenType,
  type TokenUtxo,
  type TransferOrdTokensConfig,
  type Utxo,
  fetchTokenUtxos,
  selectTokenUtxos,
  transferOrdTokens
} from 'js-1sat-ord';
import { PrivateKey, Transaction } from '@bsv/sdk';
import { API_HOST } from '../constants';

export interface TokenInfo {
  protocol: 'BSV20' | 'BSV21';
  tokenId: string;
  tick?: string;
  sym?: string;
  decimals: number;
  fundAddress?: string;
}

export interface TransferTokenConfig {
  tokenInfo: TokenInfo;
  amount: number;
  recipientAddress: string;
  paymentUtxos: Utxo[];
  tokenUtxos: TokenUtxo[];
  paymentPk: PrivateKey;
  ordPk: PrivateKey;
  changeAddress: string;
  ordAddress: string;
}

export interface BurnTokenConfig {
  tokenInfo: TokenInfo;
  amount: number;
  paymentUtxos: Utxo[];
  tokenUtxos: TokenUtxo[];
  paymentPk: PrivateKey;
  ordPk: PrivateKey;
  changeAddress: string;
  ordAddress: string;
}

export interface TransferResult {
  tx: Transaction;
  spentOutpoints: string[];
  tokenChange?: TokenUtxo[];
  payChange?: Utxo;
  fee: number;
}

export interface FeeEstimate {
  estimatedFee: number;
  estimatedSize: number;
  fundingFee: number;
  totalCost: number;
}

class TokenTransferService {
  /**
   * Fetch token information from the API
   */
  async getTokenInfo(
    protocol: 'BSV20' | 'BSV21',
    tokenId: string
  ): Promise<TokenInfo | null> {
    try {
      const endpoint = protocol === 'BSV20' ? 'tick' : 'id';
      const url = `${API_HOST}/bsv20/${endpoint}/${tokenId}`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const data = await response.json();

      return {
        protocol,
        tokenId: data.id || tokenId,
        tick: data.tick,
        sym: data.sym,
        decimals: data.dec || 0,
        fundAddress: data.fundAddress
      };
    } catch (error) {
      console.error('Error fetching token info:', error);
      return null;
    }
  }

  /**
   * Transfer tokens to a recipient
   */
  async transferToken(config: TransferTokenConfig): Promise<TransferResult> {
    const {
      tokenInfo,
      amount,
      recipientAddress,
      paymentUtxos,
      tokenUtxos,
      paymentPk,
      ordPk,
      changeAddress,
      ordAddress
    } = config;

    // Create distribution for recipient
    const distributions: Distribution[] = [{
      address: recipientAddress,
      tokens: amount
    }];

    // Additional payments for token funding (if required)
    const additionalPayments: Payment[] = [];
    if (tokenInfo.fundAddress) {
      additionalPayments.push({
        to: tokenInfo.fundAddress,
        amount: 2000 // 1000 sats per inscription * 2
      });
    }

    // Select token UTXOs using smallest-first strategy
    const { selectedUtxos: inputTokens } = selectTokenUtxos(
      tokenUtxos,
      amount,
      tokenInfo.decimals,
      {
        inputStrategy: TokenSelectionStrategy.SmallestFirst,
        outputStrategy: TokenSelectionStrategy.LargestFirst,
      }
    );

    // Build transfer configuration
    const transferConfig: TransferOrdTokensConfig = {
      protocol: tokenInfo.protocol === 'BSV20' ? TokenType.BSV20 : TokenType.BSV21,
      tokenID: tokenInfo.tokenId,
      utxos: paymentUtxos,
      inputTokens,
      distributions,
      tokenChangeAddress: ordAddress,
      changeAddress,
      paymentPk,
      ordPk,
      additionalPayments,
      decimals: tokenInfo.decimals,
      inputMode: TokenInputMode.Needed,
      splitConfig: {
        outputs: inputTokens.length === 1 ? 2 : 1,
        threshold: amount,
      }
    };

    // Execute transfer
    const { tx, spentOutpoints, tokenChange, payChange } = await transferOrdTokens(transferConfig);

    return {
      tx,
      spentOutpoints,
      tokenChange,
      payChange,
      fee: tx.getFee()
    };
  }

  /**
   * Burn tokens (send to self to remove from circulation)
   */
  async burnToken(config: BurnTokenConfig): Promise<TransferResult> {
    // Burning is just transferring to the same address (change address)
    return this.transferToken({
      ...config,
      recipientAddress: config.ordAddress
    });
  }

  /**
   * Estimate fee for token transfer
   */
  async estimateTransferFee(
    tokenInfo: TokenInfo,
    amount: number,
    tokenUtxos: TokenUtxo[],
    paymentUtxos: Utxo[]
  ): Promise<FeeEstimate> {
    try {
      // Select token UTXOs to estimate
      const { selectedUtxos } = selectTokenUtxos(
        tokenUtxos,
        amount,
        tokenInfo.decimals,
        {
          inputStrategy: TokenSelectionStrategy.SmallestFirst,
          outputStrategy: TokenSelectionStrategy.LargestFirst,
        }
      );

      // Estimate transaction size
      const numInputs = paymentUtxos.length + selectedUtxos.length;
      const numOutputs = 4; // recipient, token change, pay change, optional fund payment

      // Rough estimation:
      // - Each input ~150 bytes
      // - Each output ~34 bytes
      // - Overhead ~10 bytes
      const estimatedSize = (numInputs * 150) + (numOutputs * 34) + 10;

      // Fee rate: 0.05 sat/byte (standard)
      const feeRate = 0.05;
      const estimatedFee = Math.ceil(estimatedSize * feeRate);

      // Fund payment if required
      const fundingFee = tokenInfo.fundAddress ? 2000 : 0;

      return {
        estimatedFee,
        estimatedSize,
        fundingFee,
        totalCost: estimatedFee + fundingFee
      };
    } catch (error) {
      console.error('Error estimating fee:', error);
      throw new Error(`Failed to estimate fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch token UTXOs for a given token and address
   */
  async fetchTokenUtxos(
    protocol: 'BSV20' | 'BSV21',
    tokenId: string,
    ordAddress: string
  ): Promise<TokenUtxo[]> {
    try {
      const tokenType = protocol === 'BSV20' ? TokenType.BSV20 : TokenType.BSV21;
      return await fetchTokenUtxos(tokenType, tokenId, ordAddress);
    } catch (error) {
      console.error('Error fetching token UTXOs:', error);
      return [];
    }
  }

  /**
   * Calculate total token balance from UTXOs
   */
  calculateTokenBalance(utxos: TokenUtxo[], decimals: number): number {
    const total = utxos.reduce((sum, utxo) => sum + Number(utxo.amt), 0);
    return total / Math.pow(10, decimals);
  }
}

export const tokenTransferService = new TokenTransferService();
