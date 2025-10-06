import { PrivateKey, Transaction } from '@bsv/sdk';
import { sendOrdinals, type SendOrdinalsConfig, type Utxo, type Destination } from 'js-1sat-ord';

export interface OrdinalTransferConfig {
  ordinals: Utxo[];          // Array of ordinal UTXOs to send
  paymentUtxos: Utxo[];      // Payment UTXOs for fees
  paymentPk: PrivateKey;     // Funding key
  ordPk: PrivateKey;         // Ordinals key
  recipientAddress: string;  // Destination address
  changeAddress: string;     // Change address
  satsPerKb?: number;       // Fee rate (optional)
}

export interface OrdinalTransferResult {
  tx: Transaction;
  fee: number;
  spentOutpoints: string[];
  payChange?: number;
}

export interface OrdinalTransferEstimate {
  success: boolean;
  fee?: number;
  estimatedSize?: number;
  error?: string;
}

class OrdinalTransferService {
  /**
   * Estimate the fee for transferring ordinals
   */
  async estimateTransferFee(config: OrdinalTransferConfig): Promise<OrdinalTransferEstimate> {
    try {
      const { ordinals, paymentUtxos, paymentPk, ordPk, recipientAddress, changeAddress, satsPerKb } = config;

      // Build destinations array - one for each ordinal to same address
      const destinations: Destination[] = ordinals.map(() => ({
        address: recipientAddress
      }));

      const sendConfig: SendOrdinalsConfig = {
        paymentUtxos,
        ordinals,
        paymentPk,
        ordPk,
        destinations,
        changeAddress,
        satsPerKb,
      };

      // Build transaction to estimate fee
      const { tx } = await sendOrdinals(sendConfig);
      const fee = tx.getFee();
      const estimatedSize = Math.ceil(tx.toHex().length / 2);

      return {
        success: true,
        fee,
        estimatedSize,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error estimating ordinal transfer fee:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Transfer ordinals to a recipient address
   */
  async transferOrdinals(config: OrdinalTransferConfig): Promise<OrdinalTransferResult> {
    const { ordinals, paymentUtxos, paymentPk, ordPk, recipientAddress, changeAddress, satsPerKb } = config;

    // Build destinations array - one for each ordinal to same address
    const destinations: Destination[] = ordinals.map(() => ({
      address: recipientAddress
    }));

    const sendConfig: SendOrdinalsConfig = {
      paymentUtxos,
      ordinals,
      paymentPk,
      ordPk,
      destinations,
      changeAddress,
      satsPerKb,
    };

    const { tx, spentOutpoints, payChange } = await sendOrdinals(sendConfig);
    const fee = tx.getFee();

    return {
      tx,
      fee,
      spentOutpoints,
      payChange,
    };
  }

  /**
   * Convert NftUtxo to Utxo format for js-1sat-ord
   */
  nftToUtxo(nft: any): Utxo {
    return {
      txid: nft.txid,
      vout: nft.vout,
      satoshis: nft.satoshis || 1,
      script: nft.script,
    };
  }
}

export const ordinalTransferService = new OrdinalTransferService();
