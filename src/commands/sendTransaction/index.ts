import { P2PKH, PrivateKey, Script, Transaction, Utils } from '@bsv/sdk';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';
import { API_HOST } from '../../constants';
import { syncManager } from '../../services/syncManager';

const { toArray, toHex, fromBase58Check } = Utils;

export interface Output {
  satoshis: number;
  script: string;
}

export interface SendTxResponse {
  txid: string;
  hex: string;
}

interface Utxo {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
}

export const fetchPayUtxos = async (
  address: string,
  scriptEncoding: 'hex' | 'base64' | 'asm' = 'base64',
): Promise<Utxo[]> => {
  const payUrl = `${API_HOST}/txos/address/${address}/unspent?bsv20=false`;
  console.log({ payUrl });
  const payRes = await fetch(payUrl);
  if (payRes.status === 404) {
    return []; // No UTXOs found for this address
  }
  if (!payRes.ok) {
    const error = (await payRes
      .json()
      .catch(() => ({ message: payRes.statusText }))) as { message: string };
    // If it's a checksum mismatch, it might be a BAP ID
    if (error.message === 'Checksum mismatch') {
      throw new Error(
        'Invalid address format. If this is a BAP ID, please use the BAP lookup command instead.',
      );
    }
    throw new Error(
      `Error fetching pay utxos: ${payRes.status} ${
        error.message || payRes.statusText
      }`,
    );
  }
  let payUtxos = (await payRes.json()) as (Utxo & {
    lock?: { address: string; until: number };
  })[];
  // exclude all 1 satoshi utxos and locked utxos
  payUtxos = payUtxos.filter((u) => u.satoshis !== 1 && !u.lock);

  // Get pubkey hash from address
  const pubKeyHash = fromBase58Check(address);
  const p2pkhScript = new P2PKH().lock(pubKeyHash.data);
  payUtxos = payUtxos.map((utxo) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    satoshis: utxo.satoshis,
    script:
      scriptEncoding === 'hex' || scriptEncoding === 'base64'
        ? Buffer.from(p2pkhScript.toBinary()).toString(scriptEncoding)
        : p2pkhScript.toASM(),
  }));
  return payUtxos;
};

export async function sendTransaction(
  keyVault: KeyVault,
  outputs: Output[],
  scriptEncoding: 'hex' | 'base64' | 'asm' = 'base64',
): Promise<SendTxResponse | undefined> {
  if (!outputs?.length) {
    throw new Error('No outputs provided');
  }

  await keyVault.checkUnlock();

  // Get the funding key
  const fundingKey = await keyVault.getFundingKey();
  if (!fundingKey) {
    throw new Error('No funding key set. Please set one in the Key Vault first.');
  }

  try {
    // Convert the funding key to a private key
    const privateKey = PrivateKey.fromWif(fundingKey.value);
    const publicKey = privateKey.toPublicKey();
    const address = publicKey.toAddress();

    // Create transaction
    const tx = new Transaction();

    // Add outputs
    for (const output of outputs) {
      tx.addOutput({
        satoshis: output.satoshis,
        lockingScript: Script.fromHex(output.script),
      });
    }

    // Calculate total required (outputs + estimated fee)
    const outputTotal = outputs.reduce((sum, p) => sum + p.satoshis, 0);
    const estimatedFee = 300; // Estimate fee initially
    const totalRequired = outputTotal + estimatedFee;

    // Fetch UTXOs using SPV store
    const { getSpvService } = await import('../../services/spvService');
    const spvService = getSpvService();
    if (!spvService.isInitialized()) {
      await spvService.initialize('default', [address], 'mainnet');
      // Start sync in background with progress tracking
      spvService.startSync(syncManager.getProgressHandler()).catch(err => console.error('[sendTx] Sync error:', err));
    }
    const spvUtxos = await spvService.getUtxos(address);
    const utxos = spvUtxos.map(txo => ({
      txid: txo.outpoint.txid,
      vout: txo.outpoint.vout,
      satoshis: Number(txo.satoshis), // Convert bigint to number
      script: Buffer.from(txo.script).toString('base64')
    }));

    // Sort UTXOs by value descending
    const sortedUtxos = utxos.sort((a, b) => b.satoshis - a.satoshis);

    // Select UTXOs
    const selectedUtxos = [];
    let selectedAmount = 0;

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      selectedAmount += utxo.satoshis;
      if (selectedAmount >= totalRequired) break;
    }

    if (selectedAmount < totalRequired) {
      throw new Error(`Insufficient funds. Required: ${totalRequired}, Available: ${selectedAmount}`);
    }

    // Add inputs
    for (const utxo of selectedUtxos) {
      tx.addInput({
        sourceTXID: utxo.txid,
        sourceOutputIndex: utxo.vout,
        unlockingScript: Script.fromASM(`${privateKey.sign(tx.toHex()).toString()} ${publicKey.toString()}`),
      });
    }

    // Add change output if needed
    const change = selectedAmount - totalRequired;
    if (change > 0) {
      tx.addOutput({
        satoshis: change,
        lockingScript: new P2PKH().lock(address),
      });
    }

    // Sign all inputs
    await tx.sign();

    // Broadcast transaction
    const broadcastResponse = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txhex: tx.toHex() }),
    });

    if (!broadcastResponse.ok) {
      throw new Error(`Failed to broadcast transaction: ${await broadcastResponse.text()}`);
    }

    const { txid } = await broadcastResponse.json();

    return {
      txid,
      hex: tx.toHex(),
    };
  } catch (error) {
    vsApi.window.showErrorMessage(
      `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
