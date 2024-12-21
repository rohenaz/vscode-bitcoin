import { describe, expect, test, mock } from 'bun:test';
import vscode from '../../test/setup';
import { convertData } from '.';
import type { OutputManager } from '../../output';
import { detectFormat, type DataFormat } from '../../utils';

// Create a minimal mock that only implements what we need
const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

// Data conversion tests
describe('Data Conversion', () => {
  test('Format detection', () => {
    // Test hex detection
    expect(detectFormat('48656c6c6f')).toBe('hex');
    expect(detectFormat('not-hex-123')).toBeUndefined();

    // Test base64 detection
    expect(detectFormat('SGVsbG8=')).toBe('base64');
    expect(detectFormat('not-base64!')).toBeUndefined();

    // Test binary array detection
    expect(detectFormat('[72,101,108,108,111]')).toBe('binary');
    expect(detectFormat('[1,2,invalid]')).toBeUndefined();
  });

  test('Hex conversions', () => {
    const hex = '48656c6c6f'; // "Hello" in hex

    // Hex to base64
    expect(convertData(hex, 'hex', 'base64')).toBe('SGVsbG8=');

    // Hex to binary
    expect(convertData(hex, 'hex', 'binary')).toBe('[72,101,108,108,111]');
  });

  test('Base64 conversions', () => {
    const base64 = 'SGVsbG8='; // "Hello" in base64

    // Base64 to hex
    expect(convertData(base64, 'base64', 'hex')).toBe('48656c6c6f');

    // Base64 to binary
    expect(convertData(base64, 'base64', 'binary')).toBe(
      '[72,101,108,108,111]',
    );
  });

  test('Binary array conversions', () => {
    const binary = '[72,101,108,108,111]'; // "Hello" as byte array

    // Binary to hex
    expect(convertData(binary, 'binary', 'hex')).toBe('48656c6c6f');

    // Binary to base64
    expect(convertData(binary, 'binary', 'base64')).toBe('SGVsbG8=');
  });

  test('Error handling', () => {
    // Invalid hex
    expect(() => convertData('not-hex', 'hex', 'base64')).toThrow();

    // Invalid base64
    expect(() => convertData('not-base64!', 'base64', 'hex')).toThrow();

    // Invalid binary array
    expect(() => convertData('[1,2,invalid]', 'binary', 'hex')).toThrow();

    // Test with invalid format by casting (to test runtime behavior)
    expect(() => convertData('48656c6c6f', 'hex', 'xyz' as DataFormat)).toThrow(
      'Unsupported output format',
    );
    expect(() => convertData('48656c6c6f', 'xyz' as DataFormat, 'hex')).toThrow(
      'Unsupported input format',
    );
  });

  test('Round trip conversions', () => {
    const originalHex = '48656c6c6f';

    // Hex -> Base64 -> Hex
    expect(
      convertData(convertData(originalHex, 'hex', 'base64'), 'base64', 'hex'),
    ).toBe(originalHex);

    // Hex -> Binary -> Hex
    expect(
      convertData(convertData(originalHex, 'hex', 'binary'), 'binary', 'hex'),
    ).toBe(originalHex);

    // Base64 -> Binary -> Base64
    const originalBase64 = 'SGVsbG8=';
    expect(
      convertData(
        convertData(originalBase64, 'base64', 'binary'),
        'binary',
        'base64',
      ),
    ).toBe(originalBase64);
  });
});