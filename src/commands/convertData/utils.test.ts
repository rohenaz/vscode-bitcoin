import { describe, expect, test } from 'bun:test';
import { type DataFormat, convertData, detectFormat } from '../../utils';

// Data conversion tests
describe('Data Conversion', () => {
  test('Format detection - probability-based scoring', () => {
    // Binary array - DEFINITIVE (100%)
    expect(detectFormat('[72,101,108,108,111]')).toBe('binary');
    expect(detectFormat('[1,2,3]')).toBe('binary');
    expect(detectFormat('[255,0,128]')).toBe('binary');

    // UTF-8 with punctuation - HIGH SCORE (>50%)
    expect(detectFormat('Hello, world!')).toBe('utf8');
    expect(detectFormat('Test 123')).toBe('utf8');
    expect(detectFormat('Hello!')).toBe('utf8');
    expect(detectFormat('Test. Done')).toBe('utf8');
    expect(detectFormat('What?')).toBe('utf8');

    // Base64 with special chars - DEFINITIVE or HIGH SCORE
    expect(detectFormat('SGVsbG8=')).toBe('base64'); // Has = padding
    expect(detectFormat('aGVsbG8+')).toBe('base64'); // Has + char
    expect(detectFormat('aGVs/G8=')).toBe('base64'); // Has / char
    expect(detectFormat('A+/+/=')).toBe('base64'); // Multiple +/- = 100%

    // Hex with A-F (even length) - HIGH SCORE
    expect(detectFormat('48656c6c6f')).toBe('hex'); // Has a-f, even length
    expect(detectFormat('DEADBEEF')).toBe('hex'); // Has A-F, even length
    expect(detectFormat('ff00aa')).toBe('hex'); // Has a-f
    expect(detectFormat('0123456789abcdef')).toBe('hex'); // Many hex letters
    expect(detectFormat('0xDEADBEEF')).toBe('hex'); // 0x prefix = 100%
    expect(detectFormat('0xff')).toBe('hex'); // 0x prefix = 100%

    // Base64 with G-Z - HIGH SCORE
    expect(detectFormat('SGVsbG8')).toBe('base64'); // Has G-Z letters
    expect(detectFormat('aGVsbG9Xb3JsZA')).toBe('base64'); // Typical base64

    // Decimal - scored by length
    expect(detectFormat('841')).toBe('decimal'); // 3 digits = 0.5 score
    expect(detectFormat('12345')).toBe('decimal'); // 5 digits = 0.6 score
    expect(detectFormat('1234567890')).toBe('decimal'); // 10 digits = 0.8 score
    expect(detectFormat('12345678901234567')).toBe('decimal'); // >15 digits = 100%

    // Ambiguous - scores below threshold
    expect(detectFormat('00')).toBe('decimal'); // 2 digits = decimal wins
    expect(detectFormat('abc')).toBeUndefined(); // Odd length hex, low score
    expect(detectFormat('def12')).toBeUndefined(); // Odd length, below threshold

    // Invalid/excluded cases
    expect(detectFormat('[1,2,invalid]')).toBe('utf8'); // Letters win
    expect(detectFormat('[]')).toBeUndefined();
    expect(detectFormat('[256]')).toBeUndefined();
    expect(detectFormat('[-1]')).toBeUndefined();
    expect(detectFormat('not-base64!')).toBe('utf8'); // Letters + ! = utf8
    expect(detectFormat('SGVsbG8===')).toBeUndefined(); // Too much padding
    expect(detectFormat('123#456')).toBeUndefined(); // Invalid char #
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

  test('Decimal to other formats', () => {
    // Decimal 255 (single byte)
    expect(convertData('255', 'decimal', 'hex')).toBe('ff');
    expect(convertData('255', 'decimal', 'binary')).toBe('[255]');

    // Decimal 256 (two bytes)
    expect(convertData('256', 'decimal', 'hex')).toBe('0100');
    expect(convertData('256', 'decimal', 'binary')).toBe('[1,0]');

    // Larger decimal number
    expect(convertData('123456', 'decimal', 'hex')).toBe('01e240');
    expect(convertData('123456', 'decimal', 'binary')).toBe('[1,226,64]');

    // Very large number
    expect(convertData('1234567890123', 'decimal', 'hex')).toBe('011f71fb04cb');
  });

  test('Other formats to decimal', () => {
    // Hex to decimal
    expect(convertData('ff', 'hex', 'decimal')).toBe('255');
    expect(convertData('0100', 'hex', 'decimal')).toBe('256');
    expect(convertData('01e240', 'hex', 'decimal')).toBe('123456');

    // Binary to decimal
    expect(convertData('[255]', 'binary', 'decimal')).toBe('255');
    expect(convertData('[1,0]', 'binary', 'decimal')).toBe('256');
    expect(convertData('[1,226,64]', 'binary', 'decimal')).toBe('123456');

    // Base64 to decimal
    expect(convertData('AQ==', 'base64', 'decimal')).toBe('1');
    expect(convertData('/w==', 'base64', 'decimal')).toBe('255');
  });

  test('Decimal error handling', () => {
    // Invalid decimal format
    expect(() => convertData('abc', 'decimal', 'hex')).toThrow('Invalid decimal number');
    expect(() => convertData('12.34', 'decimal', 'hex')).toThrow('Invalid decimal number');
    expect(() => convertData('12-34', 'decimal', 'hex')).toThrow('Invalid decimal number');

    // Negative numbers not supported
    expect(() => convertData('-123', 'decimal', 'hex')).toThrow('Negative numbers are not supported');
  });

  test('Decimal round trip conversions', () => {
    const originalDecimal = '123456';

    // Decimal -> Hex -> Decimal
    expect(
      convertData(convertData(originalDecimal, 'decimal', 'hex'), 'hex', 'decimal'),
    ).toBe(originalDecimal);

    // Decimal -> Binary -> Decimal
    expect(
      convertData(convertData(originalDecimal, 'decimal', 'binary'), 'binary', 'decimal'),
    ).toBe(originalDecimal);

    // Decimal -> Base64 -> Decimal
    expect(
      convertData(convertData(originalDecimal, 'decimal', 'base64'), 'base64', 'decimal'),
    ).toBe(originalDecimal);
  });

  test('Edge cases for decimal', () => {
    // Zero
    expect(convertData('0', 'decimal', 'hex')).toBe('00');
    expect(convertData('00', 'hex', 'decimal')).toBe('0');

    // Single digit
    expect(convertData('1', 'decimal', 'hex')).toBe('01');
    expect(convertData('9', 'decimal', 'hex')).toBe('09');

    // Powers of 2
    expect(convertData('1024', 'decimal', 'hex')).toBe('0400');
    expect(convertData('65536', 'decimal', 'hex')).toBe('010000');
  });
});
