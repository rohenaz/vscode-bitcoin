import vsApi from './vsShim';
import type { OutputManager } from '../../output';
import { detectFormat } from '../../utils';
import { Utils } from '@bsv/sdk';
const { toArray, toHex, toBase64 } = Utils;

function isHex(str: string): boolean {
  return /^[0-9A-Fa-f]*$/.test(str);
}

function isBase64(str: string): boolean {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
}

export function convertData(
  input: string,
  fromFormat: string,
  toFormat: string,
): string {
  let bytes: number[];

  // First convert input to byte array using toArray
  switch (fromFormat) {
    case 'hex':
      try {
        if (!isHex(input)) {
          throw new Error('Invalid hex string');
        }
        bytes = toArray(Buffer.from(input, 'hex'));
      } catch (e) {
        throw new Error('Invalid hex input');
      }
      break;
    case 'base64':
      try {
        if (!isBase64(input)) {
          throw new Error('Invalid base64 string');
        }
        bytes = toArray(Buffer.from(input, 'base64'));
      } catch (e) {
        throw new Error('Invalid base64 input');
      }
      break;
    case 'binary':
      try {
        const arr = JSON.parse(input);
        if (
          !Array.isArray(arr) ||
          !arr.every((n) => typeof n === 'number' && n >= 0 && n <= 255)
        ) {
          throw new Error('Invalid binary array');
        }
        bytes = arr;
      } catch (e) {
        throw new Error('Invalid binary array input');
      }
      break;
    default:
      throw new Error('Unsupported input format');
  }

  // Then convert byte array to desired output format using Utils functions
  switch (toFormat) {
    case 'hex':
      return toHex(bytes);
    case 'base64':
      return toBase64(bytes);
    case 'binary':
      return JSON.stringify(bytes);
    default:
      throw new Error('Unsupported output format');
  }
}