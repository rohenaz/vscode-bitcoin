import { PrivateKey, Utils } from '@bsv/sdk';
import { MemberID } from 'bsv-bap';
import type { IdentityAttributes } from 'bsv-bap';
import type { KeyVault } from '../../keyVault';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';

const { toArray, toHex } = Utils;

interface SignOpReturnDataParams {
  data: number[][];
}

export async function signOpReturnData(keyVault: KeyVault, params?: SignOpReturnDataParams) {
  // If no params provided, throw error
  if (!params) {
    throw new Error('No data provided');
  }

  await keyVault.checkUnlock();
  
  // Get the identity key
  const identityKey = await keyVault.getIdentityKey();
  if (!identityKey) {
    throw new Error('No identity key set. Please set one in the Key Vault first.');
  }

  try {
    // Convert the identity key to a private key based on its stored format
    const privateKey = PrivateKey.fromWif(identityKey.value);

    // Initialize MemberID with the identity key
    const memberId = MemberID.fromBackup({
      derivedPrivateKey: privateKey.toWif(),
      name: 'BAP ID 1',
      description: 'BAP ID 1', 
      address: privateKey.toAddress(),
      identityAttributes: {} as IdentityAttributes
    });

    // Sign the data
    const data = memberId.signOpReturnWithAIP(params.data);

    return {
      data,
      type: 'signatures',
      name: 'signature'
    };
  } catch (error) {
    vsApi.window.showErrorMessage(
      `Failed to sign OP_RETURN data: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
} 