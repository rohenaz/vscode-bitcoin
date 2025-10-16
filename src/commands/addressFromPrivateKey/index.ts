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
  const address = publicKey.toAddress('mainnet');

  return {
    data: address,
    type: 'addresses',
    name: 'from_privkey',
  };
}

export async function handleAddressFromPrivateKeyTestnetCommand(
  outputManager: OutputManager,
) {
  const privKey = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: (hex private key) ...',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!privKey) {
    return undefined;
  }

  const privateKey = PrivateKey.fromString(privKey);
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress('testnet');

  return {
    data: address,
    type: 'addresses',
    name: 'from_privkey_testnet',
  };
}
