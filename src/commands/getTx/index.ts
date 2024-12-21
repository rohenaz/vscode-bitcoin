import { JUNGLEBUS_API_HOST } from '../../constants';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';
import { BobTx, TransformTx } from 'bmapjs';
import { parse } from 'bpu-ts';
import { Transaction, Utils } from '@bsv/sdk';
const { toHex, toArray } = Utils;

export async function handleGetTxCommand(
  outputManager: OutputManager,
): Promise<{ data: string; type: string; name?: string } | undefined> {
  // Get selected text if any
  const editor = vsApi.window.activeTextEditor;
  const selectedText = editor?.selection && !editor.selection.isEmpty
    ? editor.document.getText(editor.selection)
    : undefined;

  // Debug logging
  console.log('Selected text:', selectedText);
  console.log('Selection empty:', editor?.selection.isEmpty);
  console.log('Has editor:', !!editor);

  // If selected text is valid txid, use it directly
  const isValidTxid = selectedText?.match(/^[a-fA-F0-9]{64}$/);
  console.log('Is valid txid:', !!isValidTxid);

  // If no valid selection, prompt for input
  const txid = isValidTxid ? selectedText : await vsApi.window.showInputBox({
    value: selectedText || '',
    placeHolder: 'Ex: 4d03ff9062ac2e6...',
    validateInput: (text) => {
      return text.match(/^[a-fA-F0-9]{64}$/)
        ? null
        : 'Invalid transaction ID format. Expected: 64 character hex string';
    },
  });

  if (!txid) {
    return undefined;
  }

  const formats = [
    {
      label: 'Hex (Raw Transaction)',
      value: 'hex',
      description: 'Raw transaction hex',
    },
    {
      label: 'Base64',
      value: 'base64',
      description: 'Raw transaction base64 encoded',
    },
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
  ];

  const format = await vsApi.window.showQuickPick(formats, {
    placeHolder: 'Select output format',
  });

  if (!format) {
    return undefined;
  }
  // https://junglebus.gorillapool.io/v1/transaction/get/a8bc344411926cd7fca25da319a0a79c10431a11c96228417bb8970b12439f49
  // fetch the raw transaction
  const url = `${JUNGLEBUS_API_HOST}/transaction/get/${txid}`;
  console.log({ url })
  const tx = await fetch(url);
  const txData = await tx.json();
  console.log({ txData })
  const rawTx = toHex(toArray(txData.transaction, 'base64'))

  try {
    // First validate it's a valid transaction
    const tx = Transaction.fromHex(rawTx);
    if (!tx) {
      throw new Error('Invalid transaction format');
    }
    console.log({ rawTx })
    const bob = await parse({
      tx: { r: rawTx },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });

    if (!bob || !bob.out || !Array.isArray(bob.out)) {
      return {
        data: JSON.stringify({ tx: { h: tx.hash().toString() } }, null, 2),
        type: 'transactions',
        name: `bob_${new Date().toISOString().replace(/[:.]/g, '-')}`,
      };
    }

    const bmapTx = await TransformTx(bob as BobTx);
    console.log({ bmapTx })
    return {
      data: JSON.stringify(bmapTx, null, 2),
      type: 'transactions',
      name: `${txid}_bmap_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    };
  } catch (error) {
    console.error('BOB parsing error:', error);
    throw new Error(
      `Failed to parse transaction: ${error instanceof Error ? error.message : String(error)
      }. Please ensure the transaction hex is valid.`,
    );
  }



  // // Get BOB format
  // const bob = await parse({
  //   tx: { r: toHex(toArray(txData.trnsaction, 'base64')) },
  //   split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
  // }) as BobTx;
  // console.log({bob})
  // // convert the transaction to the selected format
  // const convertedTx = await TransformTx(bob);
  // console.log({convertedTx})
  // return {
  //   data: JSON.stringify(convertedTx, null, 2),
  //   type: 'transactions',
  //   name: txid,
  // };
}
