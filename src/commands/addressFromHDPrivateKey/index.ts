import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';
import { HD, PrivateKey } from '@bsv/sdk';

export async function handleAddressFromHDPrivateKeyCommand(outputManager: OutputManager) {
  const xPriv = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: xprv...',
    validateInput: (text) => {
      return text.length !== 111 ? 'Invalid extended private key!' : null;
    },
  });

  const path = await vsApi.window.showInputBox({
    value: 'm/0/0',
    placeHolder: 'Ex: m/0/0',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!xPriv || !path) {
    return undefined;
  }

  const hdPrivKey = HD.fromString(xPriv);
  const derivedKey = hdPrivKey.derive(path);
  const privKey = PrivateKey.fromHex(derivedKey.privKey.toString());
  const pubKey = privKey.toPublicKey();
  const address = pubKey.toAddress();

  return {
    data: address,
    type: 'addresses',
    name: `from_hdprivkey_${path.replace(/\//g, '_')}`,
  };
} 