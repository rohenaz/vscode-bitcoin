import fetch from 'node-fetch';
import { API_HOST } from '../../constants';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';
interface Inscription {
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
  };
}

async function fetchInscriptionData(outpoint: string): Promise<Inscription> {
  const inscriptionRes = await fetch(`${API_HOST}/txos/${outpoint}`);
  if (!inscriptionRes.ok) {
    let message = inscriptionRes.statusText;
    try {
      const errorBody = (await inscriptionRes.json()) as { message?: string };
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch {
      // ignore
    }
    throw new Error(
      `Failed to fetch inscription from ${API_HOST}/txos/${outpoint}\nError: ${message}`,
    );
  }
  return (await inscriptionRes.json()) as Inscription;
}

async function fetchInscriptionContent(
  inscription: Inscription,
): Promise<string | undefined> {
  if (!inscription.data?.insc) {
    return undefined;
  }

  const contentRes = await fetch(`${API_HOST}/content/${inscription.outpoint}`);
  if (!contentRes.ok) {
    let message = contentRes.statusText;
    try {
      const errorBody = (await contentRes.json()) as { message?: string };
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch {
      // ignore
    }
    throw new Error(
      `Failed to fetch inscription content from ${API_HOST}/content/${
        inscription.outpoint
      }\nError: ${message}`,
    );
  }

  return contentRes.text();
}

export async function handleFetchOrdinalsInscriptionCommand(
  outputManager: OutputManager,
) {
  const outpoint = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: 027cea24351db7081089108b59916e5c5e90893233a872266c013f7665c53758_1',
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to fetch inscription from ${API_HOST}/txos/${outpoint}\nError: ${errorMessage}`,
    );
  }
}
