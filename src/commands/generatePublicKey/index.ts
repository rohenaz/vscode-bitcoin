import { PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';

export async function generatePublicKey(output: OutputManager) {
  const privKey = PrivateKey.fromRandom();
  const publicKey = privKey.toPublicKey();

  return {
    data: publicKey.toString(),
    type: 'keys' as const,
    name: 'pubkey',
  };
}
