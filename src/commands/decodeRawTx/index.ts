import { Transaction } from '@bsv/sdk';
import { TransformTx } from 'bmapjs';
import type { BobTx } from 'bmapjs';
import { parse } from 'bpu-ts';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';

export async function handleDecodeRawTxCommand(outputManager: OutputManager) {
  const rawTxHex = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'paste raw tx hex',
    validateInput: (text) => {
      // Basic hex validation
      if (!text) return 'Transaction hex cannot be empty';
      if (!/^[0-9a-fA-F]*$/.test(text)) return 'Invalid hex format';
      if (text.length < 10) return 'Transaction hex too short';
      return null;
    },
  });

  if (!rawTxHex) {
    return undefined;
  }

  const formats = [
    {
      label: 'JSON (Parsed)',
      value: 'json',
      description: 'Parsed transaction data',
    },
    {
      label: 'BOB (Parsed)',
      value: 'bob',
      description: 'Bitcoin OP_RETURN Bytecode format',
    },
    {
      label: 'BMAP (Parsed)',
      value: 'bmap',
      description: 'Bitcoin Message Action Protocol format',
    },
    {
      label: 'Base64',
      value: 'base64',
      description: 'Raw transaction base64 encoded',
    },
  ];

  const format = await vsApi.window.showQuickPick(formats, {
    placeHolder: 'Select output format',
  });

  if (!format) {
    return undefined;
  }

  try {
    // First validate it's a valid transaction
    const tx = Transaction.fromHex(rawTxHex);
    if (!tx) {
      throw new Error('Invalid transaction format');
    }

    switch (format.value) {
      case 'base64': {
        const base64 = Buffer.from(rawTxHex, 'hex').toString('base64');
        return {
          data: base64,
          type: 'transactions',
          name: `tx_base64_${new Date().toISOString().replace(/[:.]/g, '-')}`,
        };
      }

      case 'bob': {
        const bob = await parse({
          tx: { r: rawTxHex },
          split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
        });

        if (!bob || !bob.out || !Array.isArray(bob.out)) {
          return {
            data: JSON.stringify({ tx: { h: tx.hash().toString() } }, null, 2),
            type: 'transactions',
            name: `bob_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          };
        }

        return {
          data: JSON.stringify(bob, null, 2),
          type: 'transactions',
          name: `bob_${new Date().toISOString().replace(/[:.]/g, '-')}`,
        };
      }

      case 'bmap': {
        const bob = await parse({
          tx: { r: rawTxHex },
          split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
        });

        if (!bob || !bob.out || !Array.isArray(bob.out)) {
          return {
            data: JSON.stringify({ tx: { h: tx.hash().toString() } }, null, 2),
            type: 'transactions',
            name: `bmap_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          };
        }

        const bmapTx = await TransformTx(bob as BobTx);
        return {
          data: JSON.stringify(bmapTx, null, 2),
          type: 'transactions',
          name: `bmap_${new Date().toISOString().replace(/[:.]/g, '-')}`,
        };
      }

      default: {
        const txObj = {
          version: tx.version,
          inputs: tx.inputs.map((input) => ({
            prevTxId: input.sourceTXID?.toString() || '',
            outputIndex: input.sourceOutputIndex,
            script: input.unlockingScript ? input.unlockingScript.toASM() : '',
            sequence: input.sequence,
          })),
          outputs: tx.outputs.map((output) => ({
            satoshis: output.satoshis,
            script: output.lockingScript.toASM(),
          })),
          lockTime: tx.lockTime,
        };

        return {
          data: JSON.stringify(txObj, null, 2),
          type: 'transactions',
          name: `decoded_${new Date().toISOString().replace(/[:.]/g, '-')}`,
        };
      }
    }
  } catch (error) {
    console.error('Transaction decode error:', error);
    throw new Error(
      `Failed to decode transaction: ${
        error instanceof Error ? error.message : String(error)
      }. Please ensure the transaction hex is valid.`,
    );
  }
}
