/**
 * Low-level Bitcoin transaction parser
 * Parses raw hex byte-by-byte with manual field boundary adjustment
 *
 * Based on: https://wiki.bitcoinsv.io/index.php/Bitcoin_Transactions
 *
 * Transaction Format:
 * - Version (4 bytes)
 * - Input Count (VarInt)
 * - Inputs (variable)
 *   - Previous TX Hash (32 bytes)
 *   - Previous TX Index (4 bytes)
 *   - Script Length (VarInt)
 *   - ScriptSig (variable)
 *   - Sequence (4 bytes)
 * - Output Count (VarInt)
 * - Outputs (variable)
 *   - Value (8 bytes)
 *   - Script Length (VarInt)
 *   - ScriptPubKey (variable)
 * - Locktime (4 bytes)
 */

import { Script } from '@bsv/sdk';
import { buildAsmFromChunks } from './scriptParser';

export interface ParsedField {
  name: string;
  startByte: number;
  endByte: number;
  hex: string;
  value: string | number | bigint;
  color: string;
  error?: string;
  description?: string;
  asm?: string; // ASM representation for scripts
}

export interface ParseResult {
  fields: ParsedField[];
  totalBytes: number;
  errors: string[];
  warnings: string[];
}

export class TransactionParser {
  private hex: string;
  private bytes: Uint8Array;
  private pos: number = 0;

  constructor(hexString: string) {
    this.hex = hexString.replace(/\s/g, '');
    this.bytes = new Uint8Array(this.hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  }

  /**
   * Parse entire transaction with error recovery
   */
  parse(): ParseResult {
    const fields: ParsedField[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    this.pos = 0;

    try {
      // Version (4 bytes, little-endian)
      fields.push(this.parseVersion());

      // Input Count (VarInt)
      const inputCount = this.parseVarInt('Input Count', '#FF6B6B');
      fields.push(inputCount);

      // Parse inputs
      const numInputs = typeof inputCount.value === 'number' ? inputCount.value : Number(inputCount.value);
      for (let i = 0; i < numInputs; i++) {
        try {
          fields.push(...this.parseInput(i));
        } catch (error) {
          errors.push(`Failed to parse input ${i}: ${error}`);
          break;
        }
      }

      // Output Count (VarInt)
      const outputCount = this.parseVarInt('Output Count', '#4ECDC4');
      fields.push(outputCount);

      // Parse outputs
      const numOutputs = typeof outputCount.value === 'number' ? outputCount.value : Number(outputCount.value);
      for (let i = 0; i < numOutputs; i++) {
        try {
          fields.push(...this.parseOutput(i));
        } catch (error) {
          errors.push(`Failed to parse output ${i}: ${error}`);
          break;
        }
      }

      // Locktime (4 bytes, little-endian)
      if (this.pos + 4 <= this.bytes.length) {
        fields.push(this.parseLocktime());
      } else {
        errors.push('Missing locktime (expected 4 bytes)');
      }

      // Check for extra bytes
      if (this.pos < this.bytes.length) {
        warnings.push(`${this.bytes.length - this.pos} extra bytes at end of transaction`);
        fields.push({
          name: 'Extra Bytes',
          startByte: this.pos,
          endByte: this.bytes.length,
          hex: this.getHexRange(this.pos, this.bytes.length),
          value: 'Unknown data',
          color: '#95A5A6',
          error: 'Unexpected data after locktime'
        });
      }

    } catch (error) {
      errors.push(`Fatal parsing error: ${error}`);
    }

    return {
      fields,
      totalBytes: this.bytes.length,
      errors,
      warnings
    };
  }

  private parseVersion(): ParsedField {
    const start = this.pos;
    if (this.pos + 4 > this.bytes.length) {
      throw new Error('Insufficient bytes for version');
    }

    const version = this.readUInt32LE();
    return {
      name: 'Version',
      startByte: start,
      endByte: this.pos,
      hex: this.getHexRange(start, this.pos),
      value: version,
      color: '#9B59B6',
      description: `Transaction version: ${version}`
    };
  }

  private parseVarInt(name: string, color: string): ParsedField {
    const start = this.pos;
    if (this.pos >= this.bytes.length) {
      throw new Error(`Insufficient bytes for ${name}`);
    }

    const first = this.bytes[this.pos++];
    let value: number;

    if (first < 0xfd) {
      value = first;
    } else if (first === 0xfd) {
      value = this.readUInt16LE();
    } else if (first === 0xfe) {
      value = this.readUInt32LE();
    } else {
      // 0xff - 64-bit (not commonly used)
      value = Number(this.readUInt64LE());
    }

    return {
      name,
      startByte: start,
      endByte: this.pos,
      hex: this.getHexRange(start, this.pos),
      value,
      color,
      description: `${name}: ${value}`
    };
  }

  private parseInput(index: number): ParsedField[] {
    const fields: ParsedField[] = [];

    // Previous TX Hash (32 bytes, reversed for display)
    const hashStart = this.pos;
    if (this.pos + 32 > this.bytes.length) {
      throw new Error('Insufficient bytes for input txid');
    }
    const txidBytes = this.bytes.slice(this.pos, this.pos + 32);
    this.pos += 32;
    const txid = Array.from(txidBytes).reverse().map(b => b.toString(16).padStart(2, '0')).join('');

    fields.push({
      name: `Input ${index} - TXID`,
      startByte: hashStart,
      endByte: this.pos,
      hex: this.getHexRange(hashStart, this.pos),
      value: txid,
      color: '#FF6B6B',
      description: `Previous transaction ID`
    });

    // Previous TX Output Index (4 bytes)
    const voutStart = this.pos;
    const vout = this.readUInt32LE();
    fields.push({
      name: `Input ${index} - vout`,
      startByte: voutStart,
      endByte: this.pos,
      hex: this.getHexRange(voutStart, this.pos),
      value: vout,
      color: '#FF8E8E',
      description: `Output index: ${vout}`
    });

    // Script Length (VarInt)
    const scriptLen = this.parseVarInt(`Input ${index} - Script Length`, '#FFB3B3');
    fields.push(scriptLen);

    // ScriptSig (variable length)
    const scriptStart = this.pos;
    const scriptLength = typeof scriptLen.value === 'number' ? scriptLen.value : Number(scriptLen.value);
    if (this.pos + scriptLength > this.bytes.length) {
      throw new Error(`Insufficient bytes for input ${index} script (need ${scriptLength}, have ${this.bytes.length - this.pos})`);
    }
    const scriptHex = this.getHexRange(this.pos, this.pos + scriptLength);
    this.pos += scriptLength;

    // Parse script to ASM
    let asm: string | undefined;
    try {
      if (scriptHex.length > 0) {
        const script = Script.fromHex(scriptHex);
        asm = buildAsmFromChunks(script as any);
      }
    } catch (err) {
      // If script parsing fails, that's okay - we'll just show the hex
    }

    fields.push({
      name: `Input ${index} - ScriptSig`,
      startByte: scriptStart,
      endByte: this.pos,
      hex: scriptHex,
      value: `${scriptLength} bytes`,
      color: '#FFD6D6',
      description: `Unlocking script`,
      asm
    });

    // Sequence (4 bytes)
    const seqStart = this.pos;
    const sequence = this.readUInt32LE();
    fields.push({
      name: `Input ${index} - Sequence`,
      startByte: seqStart,
      endByte: this.pos,
      hex: this.getHexRange(seqStart, this.pos),
      value: sequence,
      color: '#FFEBEB',
      description: `Sequence: ${sequence === 0xffffffff ? '0xffffffff (final)' : `0x${sequence.toString(16)}`}`
    });

    return fields;
  }

  private parseOutput(index: number): ParsedField[] {
    const fields: ParsedField[] = [];

    // Value (8 bytes, little-endian)
    const valueStart = this.pos;
    if (this.pos + 8 > this.bytes.length) {
      throw new Error(`Insufficient bytes for output ${index} value`);
    }
    const satoshis = this.readUInt64LE();

    let error: string | undefined;
    if (satoshis > BigInt(21_000_000 * 100_000_000)) {
      error = `Value exceeds max supply: ${satoshis} satoshis`;
    }

    fields.push({
      name: `Output ${index} - Value`,
      startByte: valueStart,
      endByte: this.pos,
      hex: this.getHexRange(valueStart, this.pos),
      value: satoshis,
      color: '#4ECDC4',
      description: `${satoshis} satoshis (${Number(satoshis) / 100_000_000} BSV)`,
      error
    });

    // Script Length (VarInt)
    const scriptLen = this.parseVarInt(`Output ${index} - Script Length`, '#70D7CF');
    fields.push(scriptLen);

    // ScriptPubKey (variable length)
    const scriptStart = this.pos;
    const scriptLength = typeof scriptLen.value === 'number' ? scriptLen.value : Number(scriptLen.value);

    if (scriptLength === 0) {
      fields.push({
        name: `Output ${index} - ScriptPubKey`,
        startByte: scriptStart,
        endByte: this.pos,
        hex: '',
        value: 'EMPTY',
        color: '#95E1D7',
        error: 'Output has empty locking script!',
        description: 'Empty locking script - INVALID'
      });
    } else {
      if (this.pos + scriptLength > this.bytes.length) {
        throw new Error(`Insufficient bytes for output ${index} script (need ${scriptLength}, have ${this.bytes.length - this.pos})`);
      }
      const scriptHex = this.getHexRange(this.pos, this.pos + scriptLength);
      this.pos += scriptLength;

      // Parse script to ASM
      let asm: string | undefined;
      try {
        if (scriptHex.length > 0) {
          const script = Script.fromHex(scriptHex);
          asm = buildAsmFromChunks(script as any);
        }
      } catch (err) {
        // If script parsing fails, that's okay - we'll just show the hex
      }

      fields.push({
        name: `Output ${index} - ScriptPubKey`,
        startByte: scriptStart,
        endByte: this.pos,
        hex: scriptHex,
        value: `${scriptLength} bytes`,
        color: '#95E1D7',
        description: `Locking script`,
        asm
      });
    }

    return fields;
  }

  private parseLocktime(): ParsedField {
    const start = this.pos;
    const locktime = this.readUInt32LE();

    let description = `Locktime: ${locktime}`;
    if (locktime === 0) {
      description += ' (not locked)';
    } else if (locktime < 500000000) {
      description += ' (block height)';
    } else {
      description += ` (timestamp: ${new Date(locktime * 1000).toISOString()})`;
    }

    return {
      name: 'Locktime',
      startByte: start,
      endByte: this.pos,
      hex: this.getHexRange(start, this.pos),
      value: locktime,
      color: '#F39C12',
      description
    };
  }

  // Read helpers
  private readUInt32LE(): number {
    if (this.pos + 4 > this.bytes.length) {
      throw new Error('Buffer overflow reading UInt32LE');
    }
    const value = this.bytes[this.pos] |
      (this.bytes[this.pos + 1] << 8) |
      (this.bytes[this.pos + 2] << 16) |
      (this.bytes[this.pos + 3] << 24);
    this.pos += 4;
    return value >>> 0; // Convert to unsigned
  }

  private readUInt16LE(): number {
    if (this.pos + 2 > this.bytes.length) {
      throw new Error('Buffer overflow reading UInt16LE');
    }
    const value = this.bytes[this.pos] | (this.bytes[this.pos + 1] << 8);
    this.pos += 2;
    return value;
  }

  private readUInt64LE(): bigint {
    if (this.pos + 8 > this.bytes.length) {
      throw new Error('Buffer overflow reading UInt64LE');
    }

    let value = BigInt(0);
    for (let i = 0; i < 8; i++) {
      value |= BigInt(this.bytes[this.pos + i]) << BigInt(i * 8);
    }
    this.pos += 8;
    return value;
  }

  private getHexRange(start: number, end: number): string {
    return Array.from(this.bytes.slice(start, end))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
