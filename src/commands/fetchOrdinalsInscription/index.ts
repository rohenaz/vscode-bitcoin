import fetch from 'node-fetch';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';
const API_HOST = 'https://ordinals.gorillapool.io/api';

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
    const error = await inscriptionRes
      .json()
      .catch(() => ({ message: inscriptionRes.statusText }));
    throw new Error(
      `Failed to fetch inscription from ${API_HOST}/txos/${outpoint}\nError: ${
        error.message || inscriptionRes.statusText
      }`,
    );
  }
  return inscriptionRes.json();
}

async function fetchInscriptionContent(
  inscription: Inscription,
): Promise<string | undefined> {
  if (!inscription.data?.insc) {
    return undefined;
  }

  const contentRes = await fetch(`${API_HOST}/content/${inscription.outpoint}`);
  if (!contentRes.ok) {
    const error = await contentRes
      .json()
      .catch(() => ({ message: contentRes.statusText }));
    throw new Error(
      `Failed to fetch inscription content from ${API_HOST}/content/${
        inscription.outpoint
      }\nError: ${error.message || contentRes.statusText}`,
    );
  }

  return contentRes.text();
}

export async function handleFetchOrdinalsInscriptionCommand(
  outputManager: OutputManager,
) {
  const outpoint = await vsApi.window.showInputBox({
    value: '',
    placeHolder: 'Ex: txid_vout',
    validateInput: (_text) => {
      return null;
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
