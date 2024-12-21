import { Utils } from '@bsv/sdk';

function isHex(input: string): boolean {
  // Quick length check: hex must be even length
  if (input.length % 2 !== 0) return false;
  // Strictly match allowed hex chars
  if (!/^[0-9a-fA-F]+$/.test(input)) return false;

  try {
    // Parse into bytes using Utils.toArray
    const bytes = Utils.toArray(input);
    // Check for valid byte range
    return bytes.every(b => b >= 0 && b <= 255);
  } catch {
    return false;
  }
}

function isBase64(input: string): boolean {
  // Base64 regex, allowing up to two padding '='
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input)) return false;

  try {
    // Decode and re-encode to ensure it's valid base64
    const decoded = Buffer.from(input, 'base64');
    return decoded.toString('base64') === input;
  } catch {
    return false;
  }
}

function isBinary(input: string): boolean {
  try {
    const arr = JSON.parse(input);
    return Array.isArray(arr) && arr.every(n => typeof n === 'number' && n >= 0 && n <= 255);
  } catch {
    return false;
  }
}

export function detectFormat(input: string): 'hex' | 'base64' | 'binary' | undefined {
  if (isHex(input)) return 'hex';
  if (isBase64(input)) return 'base64';
  if (isBinary(input)) return 'binary';
  return undefined;
} 