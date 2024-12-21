import { Transaction } from '@bsv/sdk';
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

  try {
    const tx = Transaction.fromHex(rawTxHex);
    const txObj = {
      version: tx.version,
      inputs: tx.inputs.map((input) => ({
        prevTxId: input.sourceTXID?.toString() || '',
        outputIndex: input.sourceOutputIndex,
        script: input.unlockingScript ? input.unlockingScript.toString() : '',
        sequence: input.sequence,
      })),
      outputs: tx.outputs.map((output) => ({
        satoshis: output.satoshis,
        script: output.lockingScript.toString(),
      })),
      lockTime: tx.lockTime,
    };

    return {
      data: JSON.stringify(txObj, null, 2),
      type: 'transactions',
      name: `decoded_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    };
  } catch (error) {
    console.error('Transaction decode error:', error);
    throw new Error(
      `Failed to decode transaction: ${
        error instanceof Error ? error.message : String(error)
      }. Please ensure the transaction hex is valid.`,
    );
  }
}
