import { describe, expect, test } from 'bun:test';
import { type DataFormat, convertData, detectFormat } from '../../utils';

// Data conversion tests
describe('Data Conversion', () => {
  test('Format detection', () => {
    // Test hex detection (should be undefined since it's ambiguous)
    expect(detectFormat('48656c6c6f')).toBeUndefined();
    expect(detectFormat('not-hex-123')).toBeUndefined();
    expect(detectFormat('123')).toBeUndefined(); // Odd length hex
    expect(detectFormat('48656c6c6f00')).toBeUndefined();
    expect(detectFormat('0123456789abcdef')).toBeUndefined();

    // Test base64 detection (should be undefined since it's ambiguous)
    expect(detectFormat('SGVsbG8=')).toBeUndefined();
    expect(detectFormat('not-base64!')).toBeUndefined();
    expect(detectFormat('SGVsbG8')).toBeUndefined();
    expect(detectFormat('SGVsbG8===')).toBeUndefined();
    expect(detectFormat('A+/=')).toBeUndefined();

    // Test binary array detection (should be definite)
    expect(detectFormat('[72,101,108,108,111]')).toBe('binary');
    expect(detectFormat('[1,2,invalid]')).toBeUndefined();
    expect(detectFormat('[1,2,3]')).toBe('binary');
    expect(detectFormat('[]')).toBeUndefined();
    expect(detectFormat('[256]')).toBeUndefined();
    expect(detectFormat('[-1]')).toBeUndefined();

    // Test UTF-8 detection (should be definite for clear text)
    expect(detectFormat('Hello, world!')).toBe('utf8');
    expect(detectFormat('not-hex-123')).toBeUndefined();
    expect(detectFormat('Test 123')).toBe('utf8');
    expect(detectFormat('123-456')).toBeUndefined();
    expect(detectFormat('abc123')).toBeUndefined();
    expect(detectFormat('Test@123')).toBeUndefined();
    expect(detectFormat('Hello!')).toBe('utf8');
    expect(detectFormat('Test_123')).toBeUndefined();
    expect(detectFormat('123_test')).toBeUndefined();
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
    expect(() => convertData('not-hex', 'hex', 'base64')).toThrow(
      'Invalid hex string',
    );

    // Invalid base64
    expect(() => convertData('not-base64!', 'base64', 'hex')).toThrow(
      'Invalid base64 string',
    );

    // Invalid binary array
    expect(() => convertData('[1,2,invalid]', 'binary', 'hex')).toThrow(
      'Invalid binary array',
    );

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
