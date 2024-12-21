import { PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';

export async function handleAddressFromPrivateKeyCommand(
  outputManager: OutputManager,
) {
  const privKey = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: L...',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!privKey) {
    return undefined;
  }

  const privateKey = PrivateKey.fromString(privKey);
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress();

  return {
    data: address,
    type: 'addresses',
    name: 'from_privkey',
  };
}
