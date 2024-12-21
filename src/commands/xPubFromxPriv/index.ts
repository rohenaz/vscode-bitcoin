import { HD } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';

export async function handleXPubFromXPrivCommand(
  _outputManager: OutputManager,
) {
  const xPriv = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: xprv9s21ZrQH143K...',
    validateInput: (text) => {
      return text.length !== 111 ? 'Invalid private key!' : null;
    },
  });

  if (!xPriv) {
    return undefined;
  }

  const hdPrivKey = HD.fromString(xPriv);
  const hdPubKey = hdPrivKey.toPublic();
  return {
    data: hdPubKey.toString(),
    type: 'keys',
    name: 'derived_hdpubkey',
  };
}
