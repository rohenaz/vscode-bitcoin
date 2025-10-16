/**
 * Script format conversion utilities
 */

/**
 * Convert hex script to space-separated byte chunks
 * Example: "76a914...88ac" → "76 a9 14 ... 88 ac"
 */
export function hexToChunked(hex: string): string {
  if (!hex) return '';
  return hex.match(/.{1,2}/g)?.join(' ') || hex;
}

/**
 * Convert ASM to SASM (shortened ASM - lowercase, no OP_ prefix)
 * Example: "OP_DUP OP_HASH160" → "dup hash160"
 */
export function asmToSasm(asm: string): string {
  if (!asm) return '';

  return asm
    .split(' ')
    .map(part => {
      // Remove OP_ prefix and convert to lowercase
      if (part.startsWith('OP_')) {
        return part.substring(3).toLowerCase();
      }
      // Keep data pushes as-is (hex values)
      return part;
    })
    .join(' ');
}

/**
 * Convert SASM back to ASM (add OP_ prefix, uppercase opcodes)
 * Example: "dup hash160" → "OP_DUP OP_HASH160"
 */
export function sasmToAsm(sasm: string): string {
  if (!sasm) return '';

  const opcodes = new Set([
    'dup', 'hash160', 'hash256', 'sha1', 'sha256', 'ripemd160',
    'checksig', 'checksigverify', 'checkmultisig', 'checkmultisigverify',
    'equal', 'equalverify', 'verify', 'return', 'if', 'else', 'endif',
    'notif', 'toaltstack', 'fromaltstack', 'drop', 'dup', 'nip', 'over',
    'pick', 'roll', 'rot', 'swap', 'tuck', 'cat', 'split', 'num2bin',
    'bin2num', 'size', 'invert', 'and', 'or', 'xor', 'add', 'sub', 'mul',
    'div', 'mod', 'lshift', 'rshift', 'booland', 'boolor', 'numequal',
    'numequalverify', 'numnotequal', 'lessthan', 'greaterthan',
    'lessthanorequal', 'greaterthanorequal', 'min', 'max', 'within',
    'abs', 'not', 'notequal', 'negate', 'sign', 'nop', 'false', 'true',
    'pushdata1', 'pushdata2', 'pushdata4', 'codeseparator'
  ]);

  return sasm
    .split(' ')
    .map(part => {
      const lower = part.toLowerCase();
      // If it's a known opcode, add OP_ prefix and uppercase
      if (opcodes.has(lower)) {
        return `OP_${lower.toUpperCase()}`;
      }
      // Otherwise it's data, keep as-is
      return part;
    })
    .join(' ');
}

/**
 * Detect if a string is valid hex
 */
export function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]*$/.test(str);
}

/**
 * Format script for display with syntax highlighting hints
 * Returns array of {type, value} for rendering
 */
export interface ScriptToken {
  type: 'opcode' | 'data' | 'separator';
  value: string;
}

export function tokenizeAsm(asm: string): ScriptToken[] {
  if (!asm) return [];

  return asm.split(' ').map(part => {
    if (part.startsWith('OP_')) {
      return { type: 'opcode' as const, value: part };
    } else if (isValidHex(part) && part.length > 2) {
      return { type: 'data' as const, value: part };
    } else {
      return { type: 'separator' as const, value: part };
    }
  });
}
