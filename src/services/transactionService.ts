import { Transaction, PrivateKey, ARC } from '@bsv/sdk';
import { sendUtxos, type Payment, type Utxo } from 'js-1sat-ord';

export interface SendBsvParams {
  recipientAddress: string;
  satoshis: number;
  wif: string;
  utxos: Utxo[];
  changeAddress: string;
  satsPerKb?: number; // Default: 50 sat/kb
}

export interface SendBsvResult {
  tx: Transaction;
  txid: string;
  fee: number;
  changeAmount: number;
  inputAmount: number;
}

export interface BroadcastResult {
  status: 'success' | 'error';
  txid?: string;
  message?: string;
}

export class TransactionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TransactionError';
  }
}

class TransactionService {
  private readonly DEFAULT_SATS_PER_KB = 50;
  private readonly DUST_LIMIT = 1; // 1 sat minimum output

  /**
   * Build and sign a BSV payment transaction using js-1sat-ord's sendUtxos
   * (matches 1sat-website implementation)
   *
   * NOTE: sendUtxos does NOT support identity signing - regular BSV sends
   * will not have SIGMA signatures (same as 1sat-website behavior)
   */
  async buildSendBsvTransaction(params: SendBsvParams): Promise<SendBsvResult> {
    const { recipientAddress, satoshis, wif, utxos, changeAddress, satsPerKb = this.DEFAULT_SATS_PER_KB } = params;

    // Validate inputs
    this.validateAddress(recipientAddress);
    this.validateAddress(changeAddress);
    if (satoshis <= 0) {
      throw new TransactionError('Amount must be greater than 0', 'INVALID_AMOUNT');
    }

    // Convert WIF to private key
    let paymentPk: PrivateKey;
    try {
      paymentPk = PrivateKey.fromWif(wif);
    } catch (error) {
      throw new TransactionError('Invalid WIF key', 'INVALID_WIF');
    }

    // Filter out 1-sat UTXOs (potential ordinals)
    const spendableUtxos = utxos.filter(u => u.satoshis > 1);
    if (spendableUtxos.length === 0) {
      throw new TransactionError('No spendable UTXOs available', 'NO_UTXOS');
    }

    // Build payments array
    const payments: Payment[] = [{
      to: recipientAddress,
      amount: satoshis
    }];

    // Use js-1sat-ord's sendUtxos (same as 1sat-website)
    try {
      const { tx, spentOutpoints, payChange } = await sendUtxos({
        utxos: spendableUtxos,
        paymentPk,
        payments,
        satsPerKb,
        changeAddress
      });

      const inputAmount = spentOutpoints.length > 0
        ? spendableUtxos
            .filter(u => spentOutpoints.includes(`${u.txid}_${u.vout}`))
            .reduce((sum, u) => sum + u.satoshis, 0)
        : 0;

      const changeAmount = payChange?.satoshis || 0;
      const fee = tx.getFee();

      return {
        tx,
        txid: tx.id('hex') as string,
        fee,
        changeAmount,
        inputAmount,
      };
    } catch (error) {
      throw new TransactionError(
        `Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TX_BUILD_FAILED'
      );
    }
  }


  /**
   * Validate Bitcoin address
   */
  private validateAddress(address: string): void {
    // Basic validation for mainnet P2PKH addresses
    if (!/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
      throw new TransactionError(`Invalid Bitcoin address: ${address}`, 'INVALID_ADDRESS');
    }
  }

  /**
   * Broadcast transaction to BSV network
   * Uses WhatsOnChain as primary, with fallback options
   */
  async broadcastTransaction(rawTx: string): Promise<BroadcastResult> {
    const broadcasters = [
      // Primary: WhatsOnChain
      async () => this.broadcastToWhatsOnChain(rawTx),
      // Fallback: GorillaPool (via ARC)
      async () => this.broadcastToArc(rawTx),
    ];

    let lastError: Error | null = null;

    for (const broadcast of broadcasters) {
      try {
        const result = await broadcast();
        if (result.status === 'success') {
          return result;
        }
        lastError = new Error(result.message || 'Unknown broadcast error');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn('Broadcast attempt failed, trying next broadcaster:', lastError.message);
      }
    }

    return {
      status: 'error',
      message: `All broadcast attempts failed: ${lastError?.message || 'Unknown error'}`,
    };
  }

  /**
   * Broadcast to WhatsOnChain API
   */
  private async broadcastToWhatsOnChain(rawTx: string): Promise<BroadcastResult> {
    try {
      const response = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txhex: rawTx }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsOnChain error: ${errorText}`);
      }

      const txid = await response.text();
      return {
        status: 'success',
        txid: txid.replace(/"/g, ''), // Remove quotes if present
        message: 'Transaction broadcast successfully via WhatsOnChain',
      };
    } catch (error) {
      throw new Error(`WhatsOnChain broadcast failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Broadcast using ARC (GorillaPool)
   */
  private async broadcastToArc(rawTx: string): Promise<BroadcastResult> {
    try {
      // Use @bsv/sdk ARC broadcaster
      const arcConfig = {
        apiKey: 'mainnet_06770f069488325c5cee888c8f00bfe0', // Public key for GorillaPool
      };

      const arc = new ARC('https://arc.gorillapool.io', arcConfig);
      const result = await arc.broadcast(rawTx);

      if (result.txid) {
        return {
          status: 'success',
          txid: result.txid,
          message: 'Transaction broadcast successfully via ARC',
        };
      }

      throw new Error('ARC broadcast failed: No txid returned');
    } catch (error) {
      throw new Error(`ARC broadcast failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction details from network
   */
  async getTransaction(txid: string): Promise<any> {
    try {
      const response = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/hash/${txid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new TransactionError(
        `Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TX_FETCH_FAILED'
      );
    }
  }
}

export const transactionService = new TransactionService();
