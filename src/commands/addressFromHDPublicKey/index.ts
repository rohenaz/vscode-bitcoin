import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';
import { HD } from '@bsv/sdk';

export async function handleAddressFromHDPublicKeyCommand(outputManager: OutputManager) {
  const xPub = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: xpub...',
    validateInput: (text) => {
      return text.length !== 111 ? 'Invalid extended public key!' : null;
    },
  });

  const path = await vsApi.window.showInputBox({
    value: 'm/0/0',
    placeHolder: 'Ex: m/0/0',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!xPub || !path) {
    return undefined;
  }

  const hdPubKey = HD.fromString(xPub);
  const derivedPubKey = hdPubKey.derive(path);
  const address = derivedPubKey.pubKey.toAddress();

  return {
    data: address,
    type: 'addresses',
    name: `from_hdpubkey_${path.replace(/\//g, '_')}`,
  };
} 