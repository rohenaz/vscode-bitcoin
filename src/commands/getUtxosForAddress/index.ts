import { P2PKH, Utils } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';

const { fromBase58Check } = Utils;

interface Utxo {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
}

interface ApiError {
  message: string;
}

const API_HOST = 'https://ordinals.gorillapool.io/api';

const fetchPayUtxos = async (
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
      .catch(() => ({ message: payRes.statusText }))) as ApiError;
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

export async function handleGetUtxosForAddressCommand(
  outputManager: OutputManager,
) {
  const address = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    validateInput: (text) => {
      if (!text) return 'Address cannot be empty';
      // Basic address validation - should start with 1 and be 26-35 chars
      if (!/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(text)) {
        return 'Invalid address format';
      }
      return null;
    },
  });

  if (!address) {
    return undefined;
  }

  try {
    const utxos = await fetchPayUtxos(address, 'hex');

    // Handle empty response
    if (!utxos || !Array.isArray(utxos)) {
      return {
        data: JSON.stringify(
          {
            address,
            utxoCount: 0,
            totalSatoshis: 0,
            utxos: [],
          },
          null,
          2,
        ),
        type: 'utxos',
        name: `utxos_${address}`,
      };
    }

    const result = {
      address,
      utxoCount: utxos.length,
      totalSatoshis: utxos.reduce((sum, utxo) => sum + (utxo.satoshis || 0), 0),
      utxos: utxos.map((utxo) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.satoshis,
        scriptPubKey: utxo.script,
      })),
    };

    return {
      data: JSON.stringify(result, null, 2),
      type: 'utxos',
      name: `utxos_${address}`,
    };
  } catch (error) {
    console.error('UTXO fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to fetch UTXOs from ${API_HOST}/txos/address/${address}/unspent?bsv20=false\nError: ${errorMessage}`,
    );
  }
}
