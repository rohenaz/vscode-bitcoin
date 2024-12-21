import vsApi from './vsShim';

export interface BapIdentity {
  '@context': string;
  '@type': string;
  alternateName?: string;
  banner?: string;
  description?: string;
  homeLocation?: {
    '@type': string;
    name: string;
  };
  image?: string;
  paymail?: string;
  url?: string;
}

export interface BapAddress {
  address: string;
  txId: string;
  block: number;
}

export interface BapProfile {
  idKey: string;
  firstSeen: number;
  rootAddress: string;
  currentAddress: string;
  addresses: BapAddress[];
  identity: BapIdentity;
}

export interface BapResponse {
  status: string;
  result: BapProfile;
}

export class BapService {
  private readonly baseUrl: string;

  constructor() {
    // Get the configured BAP indexer URL or use default
    this.baseUrl = vsApi.workspace
      .getConfiguration('bitcoin')
      .get('bapIndexerUrl', 'https://api.sigmaidentity.com');
  }

  async getProfile(idKey: string): Promise<BapProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/identity/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idKey }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as BapResponse;

      if (data.status !== 'OK' || !data.result) {
        throw new Error('Failed to fetch BAP profile');
      }

      return data.result;
    } catch (error) {
      throw new Error(
        `Failed to fetch BAP profile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async validateByAddress(address: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/identity/validByAddress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as { status: string };
      return data.status === 'OK';
    } catch (error) {
      throw new Error(
        `Failed to validate address: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
