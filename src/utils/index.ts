import { Utils } from '@bsv/sdk';
const { toArray, toHex, toBase64 } = Utils;
import { Buffer } from 'node:buffer';

/**
 * The supported data formats we can detect and convert between.
 */
export type DataFormat = 'hex' | 'base64' | 'binary' | 'utf8' | 'decimal';

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
 * Probability-based format detection system.
 * Each format gets a score (0.0 to 1.0) based on various rules.
 * Returns the format with highest score above threshold (0.5).
 */
export function detectFormat(input: string): DataFormat | undefined {
  if (!input || input.trim().length === 0) return undefined;

  const trimmed = input.trim();
  const scores: Record<DataFormat, number> = {
    binary: 0,
    hex: 0,
    base64: 0,
    utf8: 0,
    decimal: 0,
  };

  // BINARY ARRAY - Check first for definitive match
  if (isBinaryArray(trimmed)) {
    return 'binary'; // 100% definitive, BREAK
  }

  // UTF-8 TEXT scoring
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  const hasPunctuation = /[,!?.]/.test(trimmed);
  const hasSpaces = /\s/.test(trimmed);
  const letterPunctPattern = /[a-zA-Z][,!?.\s]|[,!?.\s][a-zA-Z]/.test(trimmed);
  const onlyLetters = /^[a-zA-Z]+$/.test(trimmed);

  if (hasLetters && hasPunctuation) scores.utf8 += 0.5;
  if (hasLetters && hasSpaces) scores.utf8 += 0.4;
  if (letterPunctPattern) scores.utf8 += 0.3;
  if (onlyLetters) scores.utf8 += 0.2;

  // BASE64 scoring
  const hasEquals = /=$/.test(trimmed);
  const hasPlusOrSlash = /[+/]/.test(trimmed);
  const plusSlashCount = (trimmed.match(/[+/]/g) || []).length;
  const hasGtoZ = /[g-zG-Z]/.test(trimmed);
  const validBase64Chars = /^[A-Za-z0-9+/]*={0,2}$/.test(trimmed);
  const lengthMod4 = trimmed.length % 4 === 0;

  // Only score base64 if it has valid base64 character pattern
  if (validBase64Chars) {
    if (hasEquals) scores.base64 += 0.5;
    if (hasPlusOrSlash) {
      if (plusSlashCount >= 3) {
        return 'base64'; // Multiple +/- chars = 100% base64, BREAK
      }
      scores.base64 += 0.5;
    }
    if (hasGtoZ) scores.base64 += 0.4; // Boost for G-Z (not valid hex)
    scores.base64 += 0.15; // Base score for valid chars
    if (lengthMod4) scores.base64 += 0.1;
  } else {
    // Invalid base64 format - exclude
    scores.base64 = 0;
  }

  // HEX scoring
  const hasAtoF = /[A-Fa-f]/.test(trimmed);
  const evenLength = trimmed.length % 2 === 0;
  const onlyHexChars = /^[0-9A-Fa-f]+$/.test(trimmed);
  const hasGtoZ_hex = /[g-zG-Z]/.test(trimmed);
  const hexLetterCount = (trimmed.match(/[A-Fa-f]/g) || []).length;
  const has0xPrefix = /^0x/i.test(trimmed);

  // Definitive hex markers
  if (has0xPrefix) {
    return 'hex'; // BREAK - 100% definitive (0x prefix)
  }

  if (hasAtoF && evenLength) {
    scores.hex += 0.5; // Strong indicator
    // More hex letters = more likely hex
    if (hexLetterCount >= 3) scores.hex += 0.3;
    if (hexLetterCount >= 6) scores.hex += 0.2; // Very likely hex
  } else if (hasAtoF) {
    scores.hex += 0.3; // Has hex chars but odd length
  }

  if (onlyHexChars && evenLength) scores.hex += 0.2;
  if (!evenLength) scores.hex -= 0.2; // Penalty for odd length

  // Exclude hex if has G-Z letters
  if (hasGtoZ_hex) scores.hex = 0;

  // DECIMAL scoring
  const allDigits = /^\d+$/.test(trimmed);
  const digitCount = trimmed.length;

  if (allDigits) {
    scores.decimal += 0.4; // Base score for all digits

    // Length-based likelihood
    if (digitCount >= 1 && digitCount <= 3) scores.decimal += 0.1; // Small numbers likely decimal
    if (digitCount >= 4 && digitCount <= 9) scores.decimal += 0.2; // Medium numbers
    if (digitCount >= 10 && digitCount <= 15) scores.decimal += 0.4; // Large numbers very likely decimal
    if (digitCount > 15) {
      // Very large numbers = almost definitely decimal (not practical hex)
      return 'decimal'; // BREAK - 100% definitive
    }
  } else {
    // Has letters or special chars - exclude decimal
    scores.decimal = 0;
  }

  // Clamp scores to 0.0-1.0
  for (const format of Object.keys(scores) as DataFormat[]) {
    scores[format] = Math.max(0, Math.min(1, scores[format]));
  }

  // Find highest scoring format above threshold (0.5 = 50%)
  const THRESHOLD = 0.5;
  let maxScore = 0;
  let detected: DataFormat | undefined = undefined;

  for (const [format, score] of Object.entries(scores)) {
    if (score > maxScore && score >= THRESHOLD) {
      maxScore = score;
      detected = format as DataFormat;
    }
  }

  return detected;
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
    case 'decimal': {
      // Parse decimal number and convert to buffer
      const trimmed = input.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        throw new Error('Invalid decimal number');
      }
      const num = BigInt(trimmed);
      if (num < 0n) {
        throw new Error('Negative numbers are not supported');
      }

      // Convert to hex string first, then to buffer
      const hexStr = num.toString(16);
      // Ensure even length
      const paddedHex = hexStr.length % 2 === 0 ? hexStr : '0' + hexStr;
      buffer = Buffer.from(paddedHex, 'hex');
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
    case 'decimal': {
      // Convert buffer to decimal (big-endian unsigned integer)
      const hexStr = buffer.toString('hex');
      if (hexStr.length === 0) {
        return '0';
      }
      return BigInt('0x' + hexStr).toString(10);
    }
    default:
      throw new Error(`Unsupported output format: ${toFormat}`);
  }
}
