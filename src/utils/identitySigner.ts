import { PrivateKey } from '@bsv/sdk';
import type { LocalSigner } from 'js-1sat-ord';

/**
 * Create identity signer for signing transactions (SIGMA protocol)
 *
 * Converts a PrivateKey to a LocalSigner for use with js-1sat-ord transaction configs.
 *
 * This enables SIGMA signatures on all transactions, providing:
 * - Provenance: Proof of who created/transferred items
 * - Attribution: On-chain identity verification
 * - Trust: Verifiable authenticity of inscriptions and transfers
 *
 * SECURITY: This function should ONLY be called on the backend.
 * NEVER pass private keys over network or from frontend to backend.
 *
 * @param identityKey - The user's identity PrivateKey (from KeyVault)
 * @returns LocalSigner for use in transaction configs
 */
export function createIdentitySigner(identityKey: PrivateKey): LocalSigner {
  return {
    idKey: identityKey
  };
}
