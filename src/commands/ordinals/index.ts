import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';

const API_HOST = 'https://ordinals.gorillapool.io/api';

export interface Inscription {
  txid: string;
  vout: number;
  outpoint: string;
  data?: {
    insc?: {
      file?: {
        hash: string;
        size: number;
        type: string;
      };
      json?: Record<string, unknown>;
    };
    types?: string[];
    bsv20?: {
      id: string;
      op: 'transfer' | 'mint' | 'deploy+mint' | 'burn';
      amt: number;
      listing?: boolean;
    };
  };
  origin?: {
    data?: {
      insc?: {
        file?: {
          hash: string;
          size: number;
          type: string;
        };
        json?: Record<string, unknown>;
      };
    };
    num?: string;
  };
}

async function fetchInscriptionData(outpoint: string): Promise<Inscription> {
  const url = `${API_HOST}/txos/${outpoint}`;
  console.log({ url });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Error fetching inscription: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data as Inscription;
}

async function fetchInscriptionContent(
  inscription: Inscription,
): Promise<string | undefined> {
  // First check if content is in the inscription data
  if (inscription.data?.insc?.json) {
    return JSON.stringify(inscription.data.insc.json, null, 2);
  }

  // If not, try to fetch from content endpoint
  const url = `${API_HOST}/content/${inscription.outpoint}`;
  console.log({ url });
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      return undefined;
    }
    throw new Error(
      `Error fetching inscription content: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

export async function fetchOrdinalsInscription(
  _outputManager: OutputManager,
): Promise<{ data: string; type: string; name?: string } | undefined> {
  const outpoint = await vsApi.window.showInputBox({
    value: '',
    placeHolder:
      'Ex: 027cea24351db7081089108b59916e5c5e90893233a872266c013f7665c53758_1',
    validateInput: (text) => {
      return text.match(/^[a-fA-F0-9]{64}_[0-9]+$/)
        ? null
        : 'Invalid outpoint format. Expected: txid_vout';
    },
  });

  if (!outpoint) {
    return undefined;
  }

  try {
    // First fetch inscription metadata
    const inscription = await fetchInscriptionData(outpoint);

    // Then fetch or extract the content
    const content = await fetchInscriptionContent(inscription);

    if (!content) {
      throw new Error('No inscription content found');
    }

    // Try to parse as JSON for formatting
    try {
      const jsonContent = JSON.parse(content);
      return {
        data: JSON.stringify(jsonContent, null, 2),
        type: 'inscriptions',
        name: `inscription_${outpoint.replace('_', '-')}`,
      };
    } catch {
      // Not JSON, return as is
      return {
        data: content,
        type: 'inscriptions',
        name: `inscription_${outpoint.replace('_', '-')}`,
      };
    }
  } catch (error) {
    console.error('Inscription fetch error:', error);
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to fetch inscription from ${API_HOST}/txos/${outpoint}\nError: ${errorMessage}`,
    );
  }
}
