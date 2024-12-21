import { Utils } from '@bsv/sdk';
const { toArray, toHex, toBase64 } = Utils;

/**
 * Checks if a string is valid hex.
 */
export function isHex(str: string): boolean {
  return /^[0-9A-Fa-f]*$/.test(str);
}

/**
 * Checks if a string is valid base64 (using atob/btoa).
 */
export function isBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

/**
 * Detects if the input is a JSON-encoded array of bytes (0-255).
 */
function isBinaryArray(input: string): boolean {
  try {
    const arr = JSON.parse(input);
    return (
      Array.isArray(arr) &&
      arr.every((n: unknown) => typeof n === 'number' && n >= 0 && n <= 255)
    );
  } catch {
    return false;
  }
}

export type DataFormat = 'hex' | 'base64' | 'binary';

/**
 * Determines the data format: hex, base64, binary, or undefined.
 */
export function detectFormat(input: string): DataFormat | undefined {
  // Check if it's a binary array string
  if (input.startsWith('[') && input.endsWith(']')) {
    try {
      const arr = JSON.parse(input);
      if (
        Array.isArray(arr) &&
        arr.every((n) => typeof n === 'number' && n >= 0 && n <= 255)
      ) {
        return 'binary';
      }
    } catch {}
  }

  // Check if it's hex
  if (isHex(input)) {
    return 'hex';
  }

  // Check if it's base64
  if (isBase64(input)) {
    return 'base64';
  }

  return undefined;
}

/**
 * Converts data between hex, base64, or binary representations.
 */
export function convertData(
  input: string,
  fromFormat: DataFormat,
  toFormat: DataFormat,
): string {
  let bytes: number[];

  // Convert input to bytes
  switch (fromFormat) {
    case 'hex':
      if (!isHex(input)) {
        throw new Error('Invalid hex string');
      }
      bytes = toArray(Buffer.from(input, 'hex'));
      break;

    case 'base64':
      if (!isBase64(input)) {
        throw new Error('Invalid base64 string');
      }
      bytes = toArray(Buffer.from(input, 'base64'));
      break;

    case 'binary':
      if (!isBinaryArray(input)) {
        throw new Error('Invalid binary array');
      }
      bytes = JSON.parse(input);
      break;

    default:
      throw new Error(`Unsupported input format: ${fromFormat}`);
  }

  // Convert bytes to desired output format
  switch (toFormat) {
    case 'hex':
      return toHex(bytes);
    case 'base64':
      return toBase64(bytes);
    case 'binary':
      return JSON.stringify(bytes);
    default:
      throw new Error(`Unsupported output format: ${toFormat}`);
  }
}