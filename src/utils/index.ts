import { Utils } from '@bsv/sdk';

export function detectFormat(input: string): 'hex' | 'base64' | 'binary' | undefined {
  // Check if it's hex
  if (/^[0-9a-fA-F]+$/.test(input)) {
    try {
      // Try to decode hex
      const bytes = Utils.toArray(input);
      if (bytes.every(b => b >= 0 && b <= 255)) {
        return 'hex';
      }
    } catch {
      // Not valid hex
    }
  }

  // Check if it's base64
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
    try {
      // Try to decode base64
      Buffer.from(input, 'base64');
      return 'base64';
    } catch {
      // Not valid base64
    }
  }

  // Check if it's binary (must be a valid JSON array of numbers)
  try {
    const arr = JSON.parse(input);
    if (Array.isArray(arr) && arr.every(n => typeof n === 'number' && n >= 0 && n <= 255)) {
      return 'binary';
    }
  } catch {
    // Not valid binary
  }

  return undefined;
} 