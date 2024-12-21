import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';

export async function handleGetTxCommand(outputManager: OutputManager): Promise<{ data: string; type: string; name?: string } | undefined> {
  const txid = await vsApi.window.showInputBox({
    value: '',
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

  // TODO: Implement actual transaction fetching and format conversion
  return {
    data: `Transaction ${txid} in ${format.value} format`,
    type: 'transactions',
    name: txid
  };
}
