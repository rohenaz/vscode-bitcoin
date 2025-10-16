import { PrivateKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import type { KeyVault } from '../../keyVault';

/**
 * generatePublicKey:
 * - If autoStore is disabled, we simply return the public key's *string*
 *   as we did before. But let's store and return the private key as "public" data was overshadowing
 *   the extension's main usage. We'll incorporate the new parent/child relationship:
 *   - generate random private key
 *   - store parent if autoStore == true
 *   - store child (public) referencing parentId
 *   - return the public key
 */
export async function generatePublicKey(
  output: OutputManager,
  keyVault: KeyVault,
) {
  // Step 1) Generate a random private key
  const privKey = PrivateKey.fromRandom();
  const pubKey = privKey.toPublicKey();

  // If the user has "keyVault.autoStore = false", do not store in the vault.
  if (!keyVault.isAutoStoreEnabled()) {
    // Return the public key data only
    return {
      data: pubKey.toString(),
      type: 'keys' as const,
      name: 'pubkey',
    };
  }

  // Otherwise, store parent private
  const parentId = await keyVault.storeKey({
    type: 'private',
    value: privKey.toString(), // hex
    label: 'Parent of generated public key',
    metadata: {},
  });

  // Then store child public
  await keyVault.storeKey({
    type: 'public',
    value: pubKey.toString(),
    label: 'Generated Public Key',
    metadata: { parentId },
  });

  // Finally, return the PUBLIC key data
  return {
    data: pubKey.toString(),
    type: 'keys' as const,
    name: 'pubkey',
  };
}