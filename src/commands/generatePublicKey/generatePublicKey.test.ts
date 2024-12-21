import { describe, expect, mock, test } from 'bun:test';
import { PublicKey } from '@bsv/sdk';
import type { OutputManager } from '../../output';
import { generatePublicKey } from './index';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

describe('generatePublicKey', () => {
  test('generates valid public key', async () => {
    const result = await generatePublicKey(mockOutput);

    // Check return value format
    expect(result).toEqual({
      data: expect.any(String),
      type: 'keys',
      name: 'pubkey',
    });

    // Verify it's a valid public key
    const pubKey = PublicKey.fromString(result.data);
    expect(pubKey.toString()).toBe(result.data);
  });
});
