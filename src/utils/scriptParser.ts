import { Script, LockingScript, UnlockingScript, Utils, OP } from '@bsv/sdk';

/**
 * Get opcode name from opcode number
 * Shared utility to avoid duplication across codebase
 */
export function getOpcodeName(opcode: number): string {
  // Opcodes 1-75 are implicit data pushes - just show the data, not an opcode name
  if (opcode >= 1 && opcode <= 75) {
    return `<${opcode} bytes>`;
  }

  // Find the opcode name by searching through OP object keys
  for (const [key, value] of Object.entries(OP)) {
    if (value === opcode) {
      return key;
    }
  }
  return `OP_UNKNOWN_${opcode}`;
}

/**
 * Build proper ASM from script chunks
 * Fixes BSV SDK bug where OP_0 OP_RETURN scripts merge pushdatas into one blob
 */
export function buildAsmFromChunks(script: LockingScript | UnlockingScript): string {
  const chunks = script.chunks;
  const parts: string[] = [];

  for (const chunk of chunks) {
    // Handle opcodes
    if (chunk.op === 0) {
      parts.push('OP_0');
    } else if (chunk.op === 106) {
      // OP_RETURN - check if data field has merged pushdatas
      parts.push("OP_RETURN");
      
      if (chunk.data && chunk.data.length > 0) {
        // Parse the merged data field to extract individual pushdatas
        const returnScript = Script.fromBinary(chunk.data);
        const asm = returnScript.toASM();
        parts.push(asm);
      }
    } else if (chunk.data) {
      // Regular data push
      parts.push(Utils.toHex(chunk.data));
    } else {
      // Other opcodes - use proper opcode name lookup
      parts.push(getOpcodeName(chunk.op));
    }
  }

  return parts.join(' ');
}
