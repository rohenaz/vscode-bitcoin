import {
  type CreateOrdinalsConfig,
  type Destination,
  type Inscription,
  type PreMAP,
  type Utxo,
  createOrdinals,
  type DeployBsv21TokenConfig,
  type Distribution,
  type IconInscription,
  type ImageContentType,
  deployBsv21Token
} from 'js-1sat-ord';
import { PrivateKey, Transaction } from '@bsv/sdk';

export interface MintNftConfig {
  fileData: string; // base64
  contentType: string;
  metadata?: Record<string, string>;
  paymentUtxos: Utxo[];
  paymentPk: PrivateKey;
  ordAddress: string;
}

export interface MintBsv21Config {
  symbol: string;
  iconData: string; // base64
  iconType: string;
  maxSupply: number;
  decimals: number;
  paymentUtxos: Utxo[];
  paymentPk: PrivateKey;
  ordAddress: string;
}

export interface MintResult {
  tx: Transaction;
  spentOutpoints: string[];
  payChange?: Utxo;
  tokenChange?: any;
  fee: number;
}

class MintService {
  /**
   * Mint an NFT ordinal
   */
  async mintNft(config: MintNftConfig): Promise<MintResult> {
    const {
      fileData,
      contentType,
      metadata,
      paymentUtxos,
      paymentPk,
      ordAddress
    } = config;

    // Build inscription
    const inscription: Inscription = {
      dataB64: fileData,
      contentType
    };

    // Build metadata if provided
    let metaData: PreMAP | undefined;
    if (metadata && Object.keys(metadata).length > 0) {
      metaData = {
        ...metadata,
        app: 'vscode-bitcoin',
        type: 'ord'
      };
    }

    // Build destinations
    const destinations: Destination[] = [
      {
        address: ordAddress,
        inscription
      }
    ];

    // Create ordinals
    const ordinalsConfig: CreateOrdinalsConfig = {
      utxos: paymentUtxos,
      destinations,
      paymentPk,
      metaData
    };

    const { tx, spentOutpoints, payChange } = await createOrdinals(ordinalsConfig);

    return {
      tx,
      spentOutpoints,
      payChange,
      fee: tx.getFee()
    };
  }

  /**
   * Deploy a BSV21 token
   */
  async mintBsv21(config: MintBsv21Config): Promise<MintResult> {
    const {
      symbol,
      iconData,
      iconType,
      maxSupply,
      decimals,
      paymentUtxos,
      paymentPk,
      ordAddress
    } = config;

    // Build icon
    const icon: IconInscription = {
      dataB64: iconData,
      contentType: iconType as ImageContentType
    };

    // Build distribution (mint entire supply to ordinals address)
    const initialDistribution: Distribution = {
      address: ordAddress,
      tokens: maxSupply
    };

    // Deploy token
    const deployConfig: DeployBsv21TokenConfig = {
      paymentPk,
      symbol,
      icon,
      utxos: paymentUtxos,
      initialDistribution,
      destinationAddress: ordAddress,
      decimals
    };

    const { tx, spentOutpoints, payChange, tokenChange } = await deployBsv21Token(deployConfig);

    return {
      tx,
      spentOutpoints,
      payChange,
      tokenChange,
      fee: tx.getFee()
    };
  }

}

export const mintService = new MintService();
