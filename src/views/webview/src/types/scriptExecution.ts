/**
 * Script execution types for step-by-step debugging
 */

export interface ExecutionStep {
  stepNumber: number
  context: 'UnlockingScript' | 'LockingScript'
  programCounter: number
  opcode: number
  opcodeName: string
  opcodeHex: string
  data?: number[] // Data associated with the opcode (for push operations)
  stack: number[][] // Snapshot of main stack after this step
  altStack: number[][] // Snapshot of alt stack after this step
  ifStack: boolean[] // Snapshot of IF stack after this step
  stackMem: number // Memory used by main stack
  altStackMem: number // Memory used by alt stack
  description: string // Human-readable description of what happened
  stackDiff: StackDiff // What changed in this step
  success: boolean // Whether the step executed successfully
  error?: string // Error message if failed
  isComplete?: boolean // Whether this is the final step of execution
  breakpointHit?: boolean // Whether a breakpoint was hit at this step
}

/**
 * Breakpoint configuration
 */
export interface Breakpoint {
  context: 'UnlockingScript' | 'LockingScript'
  index: number
  enabled: boolean
}

/**
 * Helper to generate breakpoint key for fast lookup
 * Format: "context:index" (e.g., "LockingScript:5")
 */
export function getBreakpointKey(context: 'UnlockingScript' | 'LockingScript', index: number): string {
  return `${context}:${index}`
}

/**
 * Parse breakpoint key back to components
 */
export function parseBreakpointKey(key: string): { context: 'UnlockingScript' | 'LockingScript'; index: number } | null {
  const parts = key.split(':')
  if (parts.length !== 2) return null

  const context = parts[0] as 'UnlockingScript' | 'LockingScript'
  const index = parseInt(parts[1], 10)

  if (isNaN(index)) return null
  if (context !== 'UnlockingScript' && context !== 'LockingScript') return null

  return { context, index }
}

export interface StackDiff {
  mainStackChanges: StackChange[]
  altStackChanges: StackChange[]
  ifStackChanges: IFStackChange[]
}

export interface StackChange {
  type: 'push' | 'pop' | 'modify'
  index: number // Position in stack (0 = top)
  value?: number[] // New value (for push/modify)
  oldValue?: number[] // Old value (for pop/modify)
}

export interface IFStackChange {
  type: 'push' | 'pop' | 'flip'
  value?: boolean
}

export interface SpendParams {
  sourceTXID: string
  sourceOutputIndex: number
  sourceSatoshis: number
  lockingScript: string // Hex
  transactionVersion: number
  otherInputs: Array<{
    sourceTXID: string
    sourceOutputIndex: number
    sequence: number
  }>
  outputs: Array<{
    satoshis: number
    lockingScript: string // Hex
  }>
  unlockingScript: string // Hex
  inputSequence: number
  inputIndex: number
  lockTime: number
  memoryLimit?: number
}

export interface ExecutionState {
  context: 'UnlockingScript' | 'LockingScript'
  programCounter: number
  stack: number[][]
  altStack: number[][]
  ifStack: boolean[]
  stackMem: number
  altStackMem: number
}

export interface OpcodeInfo {
  code: number
  name: string
  hex: string
  category: 'data' | 'stack' | 'flow' | 'crypto' | 'arithmetic' | 'logic' | 'disabled'
  description: string
  stackEffect: string
  example?: string
}
