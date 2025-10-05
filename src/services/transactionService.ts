import { Transaction, PrivateKey, P2PKH, ARC, Script } from '@bsv/sdk';
import type { Utxo } from 'js-1sat-ord';

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
   * Build and sign a BSV payment transaction
   */
  buildSendBsvTransaction(params: SendBsvParams): SendBsvResult {
    const { recipientAddress, satoshis, wif, utxos, changeAddress, satsPerKb = this.DEFAULT_SATS_PER_KB } = params;

    // Validate inputs
    this.validateAddress(recipientAddress);
    this.validateAddress(changeAddress);
    if (satoshis <= 0) {
      throw new TransactionError('Amount must be greater than 0', 'INVALID_AMOUNT');
    }

    // Convert WIF to private key
    let privateKey: PrivateKey;
    try {
      privateKey = PrivateKey.fromWif(wif);
    } catch (error) {
      throw new TransactionError('Invalid WIF key', 'INVALID_WIF');
    }

    // Select UTXOs with coin selection
    const { selectedUtxos, totalInput } = this.selectUtxos(utxos, satoshis, satsPerKb);

    // Estimate fee with selected UTXOs
    const estimatedFee = this.estimateFee(selectedUtxos.length, 2, satsPerKb); // 2 outputs (recipient + change)
    const totalNeeded = satoshis + estimatedFee;

    if (totalInput < totalNeeded) {
      throw new TransactionError(
        `Insufficient funds. Need ${totalNeeded} sats (${satoshis} + ${estimatedFee} fee), have ${totalInput} sats`,
        'INSUFFICIENT_FUNDS'
      );
    }

    // Calculate change
    const changeAmount = totalInput - satoshis - estimatedFee;

    // Build transaction
    const tx = new Transaction();

    // Add inputs from selected UTXOs
    for (const utxo of selectedUtxos) {
      // Decode base64 script if needed
      let scriptBuffer: number[];
      if (typeof utxo.script === 'string') {
        try {
          // Try base64 first (default from js-1sat-ord)
          scriptBuffer = Array.from(Buffer.from(utxo.script, 'base64'));
        } catch {
          // Fallback to hex
          scriptBuffer = Array.from(Buffer.from(utxo.script, 'hex'));
        }
      } else {
        scriptBuffer = utxo.script;
      }

      tx.addInput({
        sourceTransaction: undefined, // Will be looked up if needed
        sourceTXID: utxo.txid,
        sourceOutputIndex: utxo.vout,
        unlockingScriptTemplate: new P2PKH().unlock(privateKey),
        sequence: 0xffffffff,
      });
    }

    // Add recipient output
    tx.addOutput({
      satoshis,
      lockingScript: new P2PKH().lock(recipientAddress),
    });

    // Add change output if above dust limit
    if (changeAmount >= this.DUST_LIMIT) {
      tx.addOutput({
        satoshis: changeAmount,
        lockingScript: new P2PKH().lock(changeAddress),
      });
    }

    // Sign the transaction
    try {
      tx.sign();
    } catch (error) {
      throw new TransactionError(
        `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIGNING_FAILED'
      );
    }

    // Get final fee (may differ slightly from estimate)
    const actualFee = totalInput - satoshis - changeAmount;

    return {
      tx,
      txid: tx.id('hex') as string,
      fee: actualFee,
      changeAmount,
      inputAmount: totalInput,
    };
  }

  /**
   * Select UTXOs for transaction using simple largest-first strategy
   * Excludes 1-sat UTXOs (potential ordinals)
   */
  private selectUtxos(
    utxos: Utxo[],
    targetAmount: number,
    satsPerKb: number
  ): { selectedUtxos: Utxo[]; totalInput: number } {
    // Filter out 1-sat UTXOs (potential ordinals)
    const spendableUtxos = utxos.filter(u => u.satoshis > 1);

    if (spendableUtxos.length === 0) {
      throw new TransactionError('No spendable UTXOs available', 'NO_UTXOS');
    }

    // Sort by value descending (largest first)
    const sortedUtxos = [...spendableUtxos].sort((a, b) => b.satoshis - a.satoshis);

    const selectedUtxos: Utxo[] = [];
    let totalInput = 0;

    // Keep adding UTXOs until we have enough (including estimated fees)
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalInput += utxo.satoshis;

      // Estimate fee with current selection
      const estimatedFee = this.estimateFee(selectedUtxos.length, 2, satsPerKb);
      const needed = targetAmount + estimatedFee;

      if (totalInput >= needed) {
        break;
      }
    }

    return { selectedUtxos, totalInput };
  }

  /**
   * Estimate transaction fee based on size
   * Formula: (numInputs * 148 + numOutputs * 34 + 10) bytes * satsPerKb / 1000
   */
  private estimateFee(numInputs: number, numOutputs: number, satsPerKb: number): number {
    const estimatedSize = numInputs * 148 + numOutputs * 34 + 10;
    const fee = Math.ceil((estimatedSize * satsPerKb) / 1000);
    return fee;
  }

  /**
   * Calculate exact fee for a built transaction
   */
  calculateFee(tx: Transaction, inputAmount: number): number {
    const outputAmount = tx.outputs?.reduce((sum, out) => sum + (out.satoshis || 0), 0) || 0;
    return inputAmount - outputAmount;
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
