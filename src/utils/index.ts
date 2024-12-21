import { Utils } from '@bsv/sdk';
const { toArray, toHex, toBase64 } = Utils;
import { Buffer } from 'buffer';

/**
 * The supported data formats we can detect and convert between.
 */
export type DataFormat = 'hex' | 'base64' | 'binary' | 'utf8';

/**
 * Checks if input is a valid binary array: "[1,2,3]"
 */
function isBinaryArray(input: string): boolean {
  if (!input.startsWith('[') || !input.endsWith(']')) return false;
  try {
    const arr = JSON.parse(input);
    if (!Array.isArray(arr) || arr.length === 0) return false;
    return arr.every(
      (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255,
    );
  } catch {
    return false;
  }
}

/**
 * Determines the data format, falling back to undefined for ambiguous cases
 */
export function detectFormat(input: string): DataFormat | undefined {
  if (!input || input.trim().length === 0) return undefined;

  // Check for binary array (most specific format)
  if (isBinaryArray(input)) return 'binary';

  // Check for clear text (must be obviously text)
  if (
    /[a-zA-Z]/.test(input) &&
    /[a-zA-Z][,!?.\s]|[,!?.\s][a-zA-Z]/.test(input) &&
    !/^[0-9A-Fa-f]+$/.test(input) &&
    !/^[A-Za-z0-9+/=]+$/.test(input) &&
    !/^[0-9-]+$/.test(input) &&
    !/^[a-zA-Z]+[0-9]+$/.test(input) &&
    !/^[0-9]+[a-zA-Z]+$/.test(input) &&
    !input.includes('[') &&
    !input.includes(']')
  ) {
    return 'utf8';
  }

  // For hex and base64, just validate the format and let user decide if ambiguous
  try {
    // Try hex first (if it's valid hex length and chars)
    if (input.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(input)) {
      return undefined;
    }

    // Try base64 (if it's valid base64 chars and padding)
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
      return undefined;
    }
  } catch {
    // Fall through
  }

  // Fall back to undefined for anything ambiguous
  return undefined;
}

/**
 * Converts data between formats using Buffer
 */
export function convertData(
  input: string,
  fromFormat: DataFormat,
  toFormat: DataFormat,
): string {
  if (fromFormat === toFormat) return input;

  let buffer: Buffer;

  // Convert input to Buffer
  switch (fromFormat) {
    case 'utf8': {
      buffer = Buffer.from(input, 'utf8');
      break;
    }
    case 'hex': {
      // Just validate basic hex format
      if (input.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(input)) {
        throw new Error('Invalid hex string');
      }
      buffer = Buffer.from(input, 'hex');
      break;
    }
    case 'base64': {
      // Must be valid base64 chars and padding
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
        throw new Error('Invalid base64 string');
      }
      // Add padding if missing
      let paddedInput = input;
      while (paddedInput.length % 4 !== 0) {
        paddedInput += '=';
      }
      try {
        buffer = Buffer.from(paddedInput, 'base64');
      } catch {
        throw new Error('Invalid base64 string');
      }
      break;
    }
    case 'binary': {
      if (!isBinaryArray(input)) throw new Error('Invalid binary array');
      buffer = Buffer.from(JSON.parse(input));
      break;
    }
    default:
      throw new Error(`Unsupported input format: ${fromFormat}`);
  }

  // Convert Buffer to output format
  switch (toFormat) {
    case 'utf8':
      return buffer.toString('utf8');
    case 'hex':
      return buffer.toString('hex');
    case 'base64':
      return buffer.toString('base64');
    case 'binary':
      return JSON.stringify(Array.from(buffer));
    default:
      throw new Error(`Unsupported output format: ${toFormat}`);
  }
}
