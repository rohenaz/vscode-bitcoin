import { Transaction } from '@bsv/sdk';
import { parse } from 'bpu-ts';
import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';

export async function handleRawTxToBobCommand(outputManager: OutputManager) {
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

  try {
    // First validate it's a valid transaction
    const tx = Transaction.fromHex(rawTxHex);
    if (!tx) {
      throw new Error('Invalid transaction format');
    }

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
  } catch (error) {
    console.error('BOB parsing error:', error);
    throw new Error(
      `Failed to parse transaction: ${error instanceof Error ? error.message : String(error)}. Please ensure the transaction hex is valid.`,
    );
  }
}
